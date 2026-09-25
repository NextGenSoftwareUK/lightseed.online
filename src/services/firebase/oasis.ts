// Firebase aggregate: OASIS linked identity.
//
// Reads and writes the `oasisIdentity` map on users/{uid} — the Firestore-side record of
// which OASIS Avatar (and HerzID) is linked to this lightseed account. This is the only
// file allowed to touch that key; everything else reads through useOasisIdentity().
//
// The JWT returned by OASIS login is deliberately NOT stored here. It is held by the Cloud
// Function (functions/src/oasis.ts), which stores it in a secure server-side session and
// exposes a `refreshOasisToken` callable. The browser never persists the raw token.

import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './core';
import type { LinkedOasisIdentity } from '../../domain/oasis';

// ── Firestore path helpers ─────────────────────────────────────────────────────────────────
const userRef = (uid: string) => doc(db, 'users', uid);

// ── Read ───────────────────────────────────────────────────────────────────────────────────

// Returns the linked OASIS identity for a user, or null if none has been linked.
export const getLinkedOasisIdentity = async (uid: string): Promise<LinkedOasisIdentity | null> => {
    const snap = await getDoc(userRef(uid));
    if (!snap.exists()) return null;
    const data = snap.data() as Record<string, unknown>;
    return (data.oasisIdentity as LinkedOasisIdentity) ?? null;
};

// ── Write ──────────────────────────────────────────────────────────────────────────────────

// Saves (or replaces) the linked OASIS identity on users/{uid}.
// Called after a successful OASIS Avatar login — the browser writes the safe display fields;
// the Cloud Function writes the JWT separately via the admin SDK.
export const saveLinkedOasisIdentity = async (
    uid: string,
    identity: LinkedOasisIdentity,
): Promise<void> => {
    await setDoc(userRef(uid), {
        oasisIdentity: identity,
        updatedAt: serverTimestamp(),
    }, { merge: true });
};

// Updates only the karma fields (called by the karma sync path).
export const updateOasisKarma = async (
    uid: string,
    karmaScore: number,
): Promise<void> => {
    await setDoc(userRef(uid), {
        'oasisIdentity.karmaScore': karmaScore,
        'oasisIdentity.karmaSyncedAt': new Date().toISOString(),
        updatedAt: serverTimestamp(),
    }, { merge: true });
};

// Updates the HerzID fields after successful registration.
export const saveHerzId = async (
    uid: string,
    herzId: string,
    clearanceLevel: number,
    countryCode: string,
    joinedAt: string,
): Promise<void> => {
    await setDoc(userRef(uid), {
        'oasisIdentity.herzId': herzId,
        'oasisIdentity.herzClearanceLevel': clearanceLevel,
        'oasisIdentity.herzCountryCode': countryCode,
        'oasisIdentity.herzJoinedAt': joinedAt,
        updatedAt: serverTimestamp(),
    }, { merge: true });
};

// Unlinks the OASIS identity (removes the entire oasisIdentity map).
export const unlinkOasisIdentity = async (uid: string): Promise<void> => {
    await setDoc(userRef(uid), {
        oasisIdentity: null,
        updatedAt: serverTimestamp(),
    }, { merge: true });
};
