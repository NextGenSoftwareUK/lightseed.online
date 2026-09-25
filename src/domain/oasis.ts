// OASIS identity domain — pure types and logic, no backend, no React.
//
// An OASIS Avatar is a portable identity that lives outside Firebase. A lightseed user may
// LINK their Firebase account to an OASIS Avatar (optional, one-time), after which their
// profile carries karma from the OASIS network and — if registered — a HerzID.
//
// A HerzID is a credentialed identity within the Enlightened Nations / HerzWorld ecosystem.
// Format: <3-digit-country>·<10-digit-sequential>·<QEA-seal>
// Example: 052·0·000·000·001·✦  (the ✦ glyph is display-only; the stored seal is A-Z0-9)
//
// This file owns the pure domain: types, clearance tiers, display helpers. Nothing here
// imports from Firebase, React, or the OASIS network layer.

// ── Clearance tiers ───────────────────────────────────────────────────────────────────────
export const HERZ_TIER_LABELS: Record<number, string> = {
    1: 'Explorer',
    2: 'Wanderer',
    3: 'Tribe Member',
    4: 'Contributor',
    5: 'Ally',
    6: 'Guardian',
    7: 'Elder',
    8: 'Flame Keeper',
    9: 'Sovereign / Founder',
};

export const herzTierLabel = (level: number): string =>
    HERZ_TIER_LABELS[level] ?? `Level ${level}`;

// ── Linked OASIS identity (stored under users/{uid} in Firestore) ─────────────────────────
// We store only the non-sensitive fields. The OASIS JWT is kept server-side (Cloud Function);
// the browser only ever holds what is safe to display.
export interface LinkedOasisIdentity {
    // OASIS Avatar id (UUID from the OASIS API)
    avatarId: string;
    // Display name as stored in OASIS (may differ from the lightseed displayName)
    avatarUsername: string;
    // ISO timestamp of when the link was created
    linkedAt: string;
    // Karma score from the last successful sync
    karmaScore?: number;
    // ISO timestamp of the last karma sync
    karmaSyncedAt?: string;
    // HerzID string if the user has registered one (e.g. "052·0·000·000·001·R")
    herzId?: string;
    // HerzID clearance level (1–9)
    herzClearanceLevel?: number;
    // ISO date the HerzID was registered
    herzJoinedAt?: string;
    // HerzID country code (3-digit string, e.g. "052")
    herzCountryCode?: string;
}

// ── OASIS API response shapes (raw, before mapping) ───────────────────────────────────────
export interface OasisAuthResult {
    isSuccess: boolean;
    message?: string;
    result?: {
        id: string;
        username: string;
        email: string;
        token: string;
        // Karma is optional — not all avatar responses include it
        karmaScore?: number;
    };
}

export interface OasisKarmaResult {
    isSuccess: boolean;
    result?: { karmaScore: number };
}

export interface OasisHerzRegisterResult {
    isSuccess: boolean;
    message?: string;
    result?: {
        herzId: string;
        clearanceLevel: number;
        countryCode: string;
        joinedAt: string;
    };
}

export interface OasisHerzProfileResult {
    isSuccess: boolean;
    result?: {
        herzId: string;
        clearanceLevel: number;
        countryCode: string;
        joinedAt: string;
        vouchesRemaining: number;
        totalVouched: number;
    };
}

// ── Display helpers ────────────────────────────────────────────────────────────────────────

// Formats a HerzID for display, inserting the glyph. The stored form has no glyph; we add ✦.
// "052·0000000001·R" → "052·0·000·000·001·✦"  (the last char becomes the glyph position)
// The raw herzId from the API already uses the ✦ display form; we just return it.
export const displayHerzId = (herzId: string): string => herzId;

// Returns a short human-readable label for a clearance level, e.g. "Ally (5)"
export const herzClearanceLabel = (level: number): string =>
    `${herzTierLabel(level)} (${level})`;
