// OASIS integration — Cloud Function layer (ring 2026-09-25).
//
// All server-side OASIS operations. Uses @oasisomniverse/web4-api for the HTTP layer
// so call shapes match the published SDK exactly. OASIS JWTs are stored in
// `oasisTokens/{uid}` (admin-SDK-only). The browser never sees a raw JWT.

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { OASISClient } = require("@oasisomniverse/web4-api");
import { db } from "./core";

const OASIS_BASE = (process.env.OASIS_API_URL ?? 'https://oasisweb4.one/api').replace(/\/$/, '');

// One shared client (no token) for public reads; authenticated calls use a per-request client.
const publicClient = new OASISClient({ baseUrl: OASIS_BASE });

function authedClient(token: string) {
    const c = new OASISClient({ baseUrl: OASIS_BASE });
    c.setToken(token);
    return c;
}

// ── Firestore path helpers ────────────────────────────────────────────────────────────────
const tokenRef = (uid: string) => db.collection('oasisTokens').doc(uid);
const userRef  = (uid: string) => db.collection('users').doc(uid);

async function getStoredToken(uid: string): Promise<{ avatarId: string; token: string }> {
    const snap = await tokenRef(uid).get();
    if (!snap.exists) throw new HttpsError('not-found', 'No OASIS Avatar linked. Link first.');
    return snap.data() as { avatarId: string; token: string };
}

function oasisError(res: { isError?: boolean; message?: string | null }, fallback: string): never {
    throw new HttpsError('internal', res.message ?? fallback);
}

// ── linkOasisAvatar ────────────────────────────────────────────────────────────────────────
export const linkOasisAvatar = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
    const { email, password } = request.data as { email?: string; password?: string };
    if (!email || !password) throw new HttpsError('invalid-argument', 'email and password required.');

    const c = new OASISClient({ baseUrl: OASIS_BASE });
    const loginRes = await c.auth.login({ username: email, password })
        .catch((e: Error) => { throw new HttpsError('internal', `OASIS login failed: ${e.message}`); });

    if (loginRes.isError || !loginRes.session) oasisError(loginRes, 'OASIS login failed.');
    const { avatarId, username: avatarUsername, jwtToken: token } = loginRes.session;

    // Fetch karma (best-effort)
    c.setToken(token);
    let karmaScore: number | undefined;
    try {
        const kr = await c.karma.getKarmaForAvatar({ avatarId });
        karmaScore = kr.result?.karmaScore ?? kr.result?.KarmaScore;
    } catch { /* optional */ }

    const now = new Date().toISOString();
    await tokenRef(request.auth.uid).set({ avatarId, token, storedAt: now });

    const identity = {
        avatarId,
        avatarUsername,
        linkedAt: now,
        ...(karmaScore != null ? { karmaScore, karmaSyncedAt: now } : {}),
    };
    await userRef(request.auth.uid).set({
        oasisIdentity: identity,
        updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return { identity };
});

// ── syncOasisKarma ────────────────────────────────────────────────────────────────────────
export const syncOasisKarma = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');

    const { avatarId, token } = await getStoredToken(request.auth.uid);
    const c = authedClient(token);

    const kr = await c.karma.getKarmaForAvatar({ avatarId })
        .catch((e: Error) => { throw new HttpsError('internal', `Karma fetch failed: ${e.message}`); });
    if (kr.isError) oasisError(kr, 'Karma sync failed.');

    const karmaScore: number = kr.result?.karmaScore ?? kr.result?.KarmaScore;
    const now = new Date().toISOString();
    await userRef(request.auth.uid).set({
        'oasisIdentity.karmaScore': karmaScore,
        'oasisIdentity.karmaSyncedAt': now,
        updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return { karmaScore, syncedAt: now };
});

// ── registerOasisHerzId ───────────────────────────────────────────────────────────────────
export const registerOasisHerzId = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
    const { countryCode, voucherHerzId } = request.data as { countryCode?: string; voucherHerzId?: string };
    if (!countryCode) throw new HttpsError('invalid-argument', 'countryCode required.');

    const { token } = await getStoredToken(request.auth.uid);
    const c = authedClient(token);

    const res = await c.herzId.register({ countryCode, voucherHerzId })
        .catch((e: Error) => { throw new HttpsError('internal', `HerzID registration failed: ${e.message}`); });
    if (res.isError || !res.result) oasisError(res, 'HerzID registration failed.');

    const { herzId, clearanceLevel, countryCode: cc, joinedAt } = res.result;
    await userRef(request.auth.uid).set({
        'oasisIdentity.herzId': herzId,
        'oasisIdentity.herzClearanceLevel': clearanceLevel,
        'oasisIdentity.herzCountryCode': cc,
        'oasisIdentity.herzJoinedAt': joinedAt,
        updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return { herzId, clearanceLevel, countryCode: cc, joinedAt };
});

// ── vouchForHerzId ────────────────────────────────────────────────────────────────────────
export const vouchForHerzId = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
    const { targetHerzId } = request.data as { targetHerzId?: string };
    if (!targetHerzId) throw new HttpsError('invalid-argument', 'targetHerzId required.');

    const { token } = await getStoredToken(request.auth.uid);
    const c = authedClient(token);

    const res = await c.herzId.vouch({ herzId: targetHerzId })
        .catch((e: Error) => { throw new HttpsError('internal', `Vouch failed: ${e.message}`); });
    if (res.isError) oasisError(res, 'Vouch failed.');
    return { ok: true };
});

// ── enrollBiometric ───────────────────────────────────────────────────────────────────────
// Biometric endpoints use multipart/form-data (field: "audio"). The browser sends a
// base64-encoded blob; the Cloud Function converts it to a Buffer and posts via FormData,
// which the @oasisomniverse/web4-api HttpClient now supports natively.
export const enrollBiometric = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
    const { audioBase64 } = request.data as { audioBase64?: string };
    if (!audioBase64) throw new HttpsError('invalid-argument', 'audioBase64 required.');

    const { token } = await getStoredToken(request.auth.uid);
    const c = authedClient(token);

    const form = new FormData();
    form.append('audio', new Blob([Buffer.from(audioBase64, 'base64')], { type: 'audio/webm' }), 'voice.webm');

    // Use the raw http client with FormData — the SDK's HttpClient now passes FormData through.
    const res = await c.http.request('POST', 'api/biometric/voice/enroll', { body: form })
        .catch((e: Error) => { throw new HttpsError('internal', `Biometric enrolment failed: ${e.message}`); });
    if (res.isError) oasisError(res, 'Biometric enrolment failed.');

    await userRef(request.auth.uid).set({
        'oasisIdentity.biometricEnrolled': true,
        updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return { enrolled: true };
});

// ── verifyBiometric ───────────────────────────────────────────────────────────────────────
export const verifyBiometric = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
    const { audioBase64 } = request.data as { audioBase64?: string };
    if (!audioBase64) throw new HttpsError('invalid-argument', 'audioBase64 required.');

    const { token } = await getStoredToken(request.auth.uid);
    const c = authedClient(token);

    const form = new FormData();
    form.append('audio', new Blob([Buffer.from(audioBase64, 'base64')], { type: 'audio/webm' }), 'voice.webm');

    const res = await c.http.request('POST', 'api/biometric/voice/verify', { body: form })
        .catch((e: Error) => { throw new HttpsError('internal', `Biometric verification failed: ${e.message}`); });

    return { verified: !(res.isError) && Boolean(res.result?.verified ?? res.result?.Verified ?? !res.isError) };
});

// ── signInWithOasis ───────────────────────────────────────────────────────────────────────
export const signInWithOasis = onCall({ cors: true }, async (request) => {
    const { email, password } = request.data as { email?: string; password?: string };
    if (!email || !password) throw new HttpsError('invalid-argument', 'email and password required.');

    const c = new OASISClient({ baseUrl: OASIS_BASE });
    const loginRes = await c.auth.login({ username: email, password })
        .catch((e: Error) => { throw new HttpsError('internal', `OASIS login failed: ${e.message}`); });

    if (loginRes.isError || !loginRes.session) {
        throw new HttpsError('unauthenticated', loginRes.message ?? 'OASIS authentication failed.');
    }
    const { avatarId, username: avatarUsername, jwtToken: token } = loginRes.session;
    const fbAuth = getAuth();

    // 1. Look for existing linked account
    const linked = await db.collection('users')
        .where('oasisIdentity.avatarId', '==', avatarId)
        .limit(1)
        .get();

    let uid: string;
    if (!linked.empty) {
        uid = linked.docs[0].id;
        await tokenRef(uid).set({ avatarId, token, storedAt: new Date().toISOString() }, { merge: true });
    } else {
        // 2/3. Find or create Firebase user
        let firebaseUser;
        try { firebaseUser = await fbAuth.getUserByEmail(email); }
        catch { firebaseUser = await fbAuth.createUser({ email, displayName: avatarUsername }); }
        uid = firebaseUser.uid;

        const now = new Date().toISOString();
        await tokenRef(uid).set({ avatarId, token, storedAt: now });
        await userRef(uid).set({
            oasisIdentity: { avatarId, avatarUsername, linkedAt: now },
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
    }

    const customToken = await fbAuth.createCustomToken(uid, { oasisAvatarId: avatarId });
    return { customToken };
});

// ── unlinkOasisAvatarFn ───────────────────────────────────────────────────────────────────
export const unlinkOasisAvatarFn = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
    await Promise.all([
        tokenRef(request.auth.uid).delete(),
        userRef(request.auth.uid).set({
            oasisIdentity: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true }),
    ]);
    return { ok: true };
});

// publicClient is available for any future server-side public reads (e.g. QEA verify in a webhook).
export { publicClient as oasisPublicClient };
