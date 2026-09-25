// useOasisIdentity — the React seam for OASIS / HerzID integration.
//
// Provides the current user's linked OASIS identity (if any), plus actions to link, unlink,
// register a HerzID, sync karma, vouch for others, and manage biometrics.
//
// Since ring 2026-09-25: all mutations go through Cloud Functions. The OASIS JWT is stored
// server-side; the browser never touches it and never needs to re-enter credentials after
// the initial link. The hook remains self-contained — OASIS identity is optional and additive.

import { useState, useEffect, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { signInWithCustomToken } from 'firebase/auth';
import { useSession } from '../contexts/SessionContext';
import type { LinkedOasisIdentity } from '../domain/oasis';
import { getLinkedOasisIdentity } from '../services/firebase/oasis';
import { functions, auth } from '../services/firebase/core';

// ── Callable handles (created once, not per render) ───────────────────────────────────────
const callLink       = httpsCallable<{ email: string; password: string }, { identity: LinkedOasisIdentity }>(functions, 'linkOasisAvatar');
const callUnlink     = httpsCallable<Record<never, never>, { ok: boolean }>(functions, 'unlinkOasisAvatarFn');
const callSyncKarma  = httpsCallable<Record<never, never>, { karmaScore: number; syncedAt: string }>(functions, 'syncOasisKarma');
const callRegisterHz = httpsCallable<{ countryCode: string; voucherHerzId?: string },
    { herzId: string; clearanceLevel: number; countryCode: string; joinedAt: string }>(functions, 'registerOasisHerzId');
const callVouch      = httpsCallable<{ targetHerzId: string }, { ok: boolean }>(functions, 'vouchForHerzId');
const callEnroll     = httpsCallable<{ audioBase64: string }, { enrolled: boolean }>(functions, 'enrollBiometric');
const callVerify     = httpsCallable<{ audioBase64: string }, { verified: boolean }>(functions, 'verifyBiometric');
const callSignIn     = httpsCallable<{ email: string; password: string }, { customToken: string }>(functions, 'signInWithOasis');

type Status = 'idle' | 'loading' | 'error';

export interface OasisIdentityState {
    identity: LinkedOasisIdentity | null;
    busy: boolean;
    error: string | null;
    // Link this Firebase account to an OASIS Avatar (credentials sent to Cloud Function once).
    link: (oasisEmail: string, oasisPassword: string) => Promise<void>;
    // Remove the OASIS link server-side.
    unlink: () => Promise<void>;
    // Register a HerzID — no credentials needed (uses stored JWT).
    registerHerzId: (countryCode: string, voucherHerzId?: string) => Promise<void>;
    // Re-fetch karma from the OASIS API — no credentials needed.
    syncKarma: () => Promise<void>;
    // Vouch for another user's HerzID — no credentials needed.
    vouchForHerzId: (targetHerzId: string) => Promise<void>;
    // Enrol voice biometric — accepts a base64-encoded audio blob.
    enrollBiometric: (audioBase64: string) => Promise<void>;
    // Verify a voice sample against the enrolled biometric.
    verifyBiometric: (audioBase64: string) => Promise<boolean>;
    clearError: () => void;
}

// Standalone helper: "Sign in with OASIS" — verifies OASIS credentials server-side,
// then signs the browser into Firebase with a custom token. Call this from the sign-in UI.
export const signInWithOasis = async (oasisEmail: string, oasisPassword: string): Promise<void> => {
    const res = await callSignIn({ email: oasisEmail, password: oasisPassword });
    await signInWithCustomToken(auth, res.data.customToken);
};

export const useOasisIdentity = (): OasisIdentityState => {
    const { lightseed } = useSession();
    const uid = lightseed?.uid ?? null;

    const [identity, setIdentity] = useState<LinkedOasisIdentity | null>(null);
    const [status, setStatus]     = useState<Status>('idle');
    const [error, setError]       = useState<string | null>(null);

    useEffect(() => {
        if (!uid) { setIdentity(null); return; }
        setStatus('loading');
        getLinkedOasisIdentity(uid)
            .then(id => { setIdentity(id); setStatus('idle'); })
            .catch(() => { setStatus('error'); setError('Could not load OASIS identity.'); });
    }, [uid]);

    const busy = status === 'loading';

    const wrap = useCallback(async (fn: () => Promise<void>) => {
        setStatus('loading'); setError(null);
        try { await fn(); setStatus('idle'); }
        catch (e) { setError((e as Error).message); setStatus('error'); }
    }, []);

    const link = useCallback(async (oasisEmail: string, oasisPassword: string) => {
        if (!uid) return;
        await wrap(async () => {
            const res = await callLink({ email: oasisEmail, password: oasisPassword });
            setIdentity(res.data.identity);
        });
    }, [uid, wrap]);

    const unlink = useCallback(async () => {
        if (!uid) return;
        await wrap(async () => {
            await callUnlink({});
            setIdentity(null);
        });
    }, [uid, wrap]);

    const registerHerzId = useCallback(async (countryCode: string, voucherHerzId?: string) => {
        if (!uid) return;
        await wrap(async () => {
            const res = await callRegisterHz({ countryCode, voucherHerzId });
            const { herzId, clearanceLevel, countryCode: cc, joinedAt } = res.data;
            setIdentity(prev => prev ? { ...prev, herzId, herzClearanceLevel: clearanceLevel, herzCountryCode: cc, herzJoinedAt: joinedAt } : prev);
        });
    }, [uid, wrap]);

    const syncKarma = useCallback(async () => {
        if (!uid) return;
        await wrap(async () => {
            const res = await callSyncKarma({});
            setIdentity(prev => prev ? { ...prev, karmaScore: res.data.karmaScore, karmaSyncedAt: res.data.syncedAt } : prev);
        });
    }, [uid, wrap]);

    const vouchForHerzId = useCallback(async (targetHerzId: string) => {
        if (!uid) return;
        await wrap(async () => { await callVouch({ targetHerzId }); });
    }, [uid, wrap]);

    const enrollBiometric = useCallback(async (audioBase64: string) => {
        if (!uid) return;
        await wrap(async () => {
            await callEnroll({ audioBase64 });
            setIdentity(prev => prev ? { ...prev, biometricEnrolled: true } : prev);
        });
    }, [uid, wrap]);

    const verifyBiometric = useCallback(async (audioBase64: string): Promise<boolean> => {
        if (!uid) return false;
        try {
            setStatus('loading'); setError(null);
            const res = await callVerify({ audioBase64 });
            setStatus('idle');
            return res.data.verified;
        } catch (e) {
            setError((e as Error).message); setStatus('error');
            return false;
        }
    }, [uid]);

    return {
        identity, busy, error,
        link, unlink, registerHerzId, syncKarma, vouchForHerzId,
        enrollBiometric, verifyBiometric,
        clearError: () => setError(null),
    };
};
