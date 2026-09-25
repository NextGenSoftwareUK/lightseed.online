// Firebase aggregate: OASIS linked identity (ring 2026-09-25).
//
// Since ring 2026-09-25 all writes go through Cloud Functions (functions/src/oasis.ts).
// The only client-side Firestore read remaining here is `getLinkedOasisIdentity`,
// used by useOasisIdentity() on mount to hydrate local state.
//
// The JWT is stored in `oasisTokens/{uid}` — admin-SDK-only, no client rules.

import { doc, getDoc } from 'firebase/firestore';
import { db } from './core';
import type { LinkedOasisIdentity } from '../../domain/oasis';

const userRef = (uid: string) => doc(db, 'users', uid);

// Returns the linked OASIS identity for a user, or null if none has been linked.
export const getLinkedOasisIdentity = async (uid: string): Promise<LinkedOasisIdentity | null> => {
    const snap = await getDoc(userRef(uid));
    if (!snap.exists()) return null;
    const data = snap.data() as Record<string, unknown>;
    return (data.oasisIdentity as LinkedOasisIdentity) ?? null;
};
