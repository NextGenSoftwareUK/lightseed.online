// useOasisIdentity — the React seam for OASIS / HerzID integration.
//
// Provides the current user's linked OASIS identity (if any), plus actions to link, unlink,
// register a HerzID, and sync karma. State is local to the hook; callers re-render on change.
//
// The hook is intentionally self-contained — it does not add fields to SessionContext. OASIS
// identity is optional and peripheral; the core session (Firebase uid, trees, admin flags)
// must not be coupled to an external API's availability.

import { useState, useEffect, useCallback } from 'react';
import { useSession } from '../contexts/SessionContext';
import type { LinkedOasisIdentity } from '../domain/oasis';
import {
    getLinkedOasisIdentity,
    saveLinkedOasisIdentity,
    updateOasisKarma,
    saveHerzId,
    unlinkOasisIdentity,
} from '../services/firebase/oasis';
import {
    oasisAvatarLogin,
    oasisGetKarma,
    oasisHerzRegister,
    type HerzRegisterRequest,
} from '../services/oasis';

type Status = 'idle' | 'loading' | 'error';

export interface OasisIdentityState {
    // The currently linked identity, or null if none.
    identity: LinkedOasisIdentity | null;
    // True while any async operation is in progress.
    busy: boolean;
    // The last error message, or null.
    error: string | null;
    // Link this Firebase account to an OASIS Avatar. Prompts for OASIS credentials.
    link: (oasisEmail: string, oasisPassword: string) => Promise<void>;
    // Remove the OASIS identity link.
    unlink: () => Promise<void>;
    // Register a HerzID for the linked avatar.
    // Credentials are required to obtain a fresh OASIS JWT for the mutation.
    registerHerzId: (req: HerzRegisterRequest & { oasisEmail: string; oasisPassword: string }) => Promise<void>;
    // Re-fetch karma from the OASIS API and update Firestore.
    syncKarma: (oasisEmail: string, oasisPassword: string) => Promise<void>;
    // Clear the error.
    clearError: () => void;
}

export const useOasisIdentity = (): OasisIdentityState => {
    const { lightseed } = useSession();
    const uid = lightseed?.uid ?? null;

    const [identity, setIdentity] = useState<LinkedOasisIdentity | null>(null);
    const [status, setStatus] = useState<Status>('idle');
    const [error, setError] = useState<string | null>(null);

    // Load on mount / user change.
    useEffect(() => {
        if (!uid) { setIdentity(null); return; }
        setStatus('loading');
        getLinkedOasisIdentity(uid)
            .then(id => { setIdentity(id); setStatus('idle'); })
            .catch(() => { setStatus('error'); setError('Could not load OASIS identity.'); });
    }, [uid]);

    const busy = status === 'loading';

    // ── Link ─────────────────────────────────────────────────────────────────────────────
    const link = useCallback(async (oasisEmail: string, oasisPassword: string) => {
        if (!uid) return;
        setStatus('loading'); setError(null);
        try {
            const res = await oasisAvatarLogin(oasisEmail, oasisPassword);
            if (!res.isSuccess || !res.result) throw new Error(res.message ?? 'Login failed.');

            const { id: avatarId, username: avatarUsername, token, karmaScore } = res.result;

            // Fetch karma if not already in the login response.
            let karma = karmaScore;
            if (karma == null) {
                const kr = await oasisGetKarma(avatarId, token).catch(() => null);
                karma = kr?.result?.karmaScore;
            }

            const linked: LinkedOasisIdentity = {
                avatarId,
                avatarUsername,
                linkedAt: new Date().toISOString(),
                karmaScore: karma,
                karmaSyncedAt: karma != null ? new Date().toISOString() : undefined,
            };
            await saveLinkedOasisIdentity(uid, linked);
            setIdentity(linked);
            setStatus('idle');
        } catch (e) {
            setError((e as Error).message);
            setStatus('error');
        }
    }, [uid]);

    // ── Unlink ────────────────────────────────────────────────────────────────────────────
    const unlink = useCallback(async () => {
        if (!uid) return;
        setStatus('loading'); setError(null);
        try {
            await unlinkOasisIdentity(uid);
            setIdentity(null);
            setStatus('idle');
        } catch (e) {
            setError((e as Error).message);
            setStatus('error');
        }
    }, [uid]);

    // ── Register HerzID ───────────────────────────────────────────────────────────────────
    // Requires the avatar to be already linked (we need a fresh JWT, so the user supplies
    // their OASIS credentials again). A future Cloud Function can store the token so the
    // user doesn't have to re-enter credentials for mutations.
    const registerHerzId = useCallback(async (req: HerzRegisterRequest & { oasisEmail: string; oasisPassword: string }) => {
        if (!uid || !identity) { setError('No OASIS Avatar linked.'); return; }
        setStatus('loading'); setError(null);
        try {
            // Obtain a fresh token.
            const authRes = await oasisAvatarLogin(req.oasisEmail, req.oasisPassword);
            if (!authRes.isSuccess || !authRes.result) throw new Error(authRes.message ?? 'Auth failed.');
            const { token } = authRes.result;

            const herzRes = await oasisHerzRegister({
                countryCode: req.countryCode,
                voucherHerzId: req.voucherHerzId,
            }, token);

            if (!herzRes.isSuccess || !herzRes.result) throw new Error(herzRes.message ?? 'HerzID registration failed.');

            const { herzId, clearanceLevel, countryCode, joinedAt } = herzRes.result;
            await saveHerzId(uid, herzId, clearanceLevel, countryCode, joinedAt);

            setIdentity(prev => prev ? {
                ...prev,
                herzId,
                herzClearanceLevel: clearanceLevel,
                herzCountryCode: countryCode,
                herzJoinedAt: joinedAt,
            } : prev);
            setStatus('idle');
        } catch (e) {
            setError((e as Error).message);
            setStatus('error');
        }
    }, [uid, identity]);

    // ── Sync karma ────────────────────────────────────────────────────────────────────────
    const syncKarma = useCallback(async (oasisEmail: string, oasisPassword: string) => {
        if (!uid || !identity) { setError('No OASIS Avatar linked.'); return; }
        setStatus('loading'); setError(null);
        try {
            const authRes = await oasisAvatarLogin(oasisEmail, oasisPassword);
            if (!authRes.isSuccess || !authRes.result) throw new Error(authRes.message ?? 'Auth failed.');
            const { token } = authRes.result;

            const kr = await oasisGetKarma(identity.avatarId, token);
            if (!kr.isSuccess || !kr.result) throw new Error('Karma sync failed.');

            await updateOasisKarma(uid, kr.result.karmaScore);
            setIdentity(prev => prev ? {
                ...prev,
                karmaScore: kr.result!.karmaScore,
                karmaSyncedAt: new Date().toISOString(),
            } : prev);
            setStatus('idle');
        } catch (e) {
            setError((e as Error).message);
            setStatus('error');
        }
    }, [uid, identity]);

    return {
        identity,
        busy,
        error,
        link,
        unlink,
        registerHerzId,
        syncKarma,
        clearError: () => setError(null),
    };
};
