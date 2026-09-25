// OASIS API service — plain fetch, no axios, honours lightseed's network monitor.
//
// This module is the single boundary between lightseed and the OASIS API. All OASIS HTTP calls
// go through here; nothing else in the app makes direct requests to the OASIS API. The base URL
// is read from VITE_OASIS_API_URL at build time (falls back to the dev Railway URL so the app
// works without any .env change during development).
//
// Lightseed uses Firebase Auth as its identity backbone. OASIS identity is optional and
// additive — a user links their OASIS Avatar once, and the returned JWT is stored securely
// server-side. The browser layer only ever sees display-safe fields.
//
// The JWT obtained from OASIS login is SHORT-LIVED. Long-term persistence is handled by the
// Cloud Function layer (functions/src/oasis.ts), which refreshes it as needed. The browser
// calls that Cloud Function rather than OASIS directly for any mutation that needs a token.

import type {
    OasisAuthResult,
    OasisKarmaResult,
    OasisHerzRegisterResult,
    OasisHerzProfileResult,
} from '../domain/oasis';

// ── Base URL ──────────────────────────────────────────────────────────────────────────────
const getBase = (): string => {
    const meta = import.meta as unknown as { env?: Record<string, string> };
    return (meta.env?.['VITE_OASIS_API_URL'] ?? 'https://oasisweb4.one/api').replace(/\/$/, '');
};

// ── Core request helper ────────────────────────────────────────────────────────────────────
// Uses window.fetch (already patched by services/network.ts for in-flight tracking).
async function oasisFetch<T>(
    path: string,
    options: RequestInit = {},
    jwt?: string,
): Promise<T> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> ?? {}),
    };
    if (jwt) headers['Authorization'] = `Bearer ${jwt}`;

    const res = await fetch(`${getBase()}${path}`, { ...options, headers });

    if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`OASIS ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
}

// ── Avatar auth ────────────────────────────────────────────────────────────────────────────

// Authenticates an OASIS Avatar with email + password.
// Returns the raw API result; callers should check `isSuccess` before reading `result`.
// The JWT inside result.result.token is intentionally NOT stored here — call the Cloud
// Function `linkOasisAvatar` instead, which stores it server-side.
export const oasisAvatarLogin = (email: string, password: string): Promise<OasisAuthResult> =>
    oasisFetch<OasisAuthResult>('/avatar/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    });

// Fetches the OASIS karma score for a given avatar id.
// The jwt parameter is the short-lived token returned by oasisAvatarLogin.
export const oasisGetKarma = (avatarId: string, jwt: string): Promise<OasisKarmaResult> =>
    oasisFetch<OasisKarmaResult>(`/karma/${avatarId}`, {}, jwt);

// ── HerzID ────────────────────────────────────────────────────────────────────────────────

export interface HerzRegisterRequest {
    countryCode: string;     // 3-digit ISO 3166-1 numeric, e.g. "052" (Barbados)
    voucherHerzId?: string;  // HerzID of the member vouching for the newcomer (required unless founder)
}

// Registers a new HerzID for the authenticated avatar.
// jwt is the OASIS Bearer token for the avatar being registered.
export const oasisHerzRegister = (
    req: HerzRegisterRequest,
    jwt: string,
): Promise<OasisHerzRegisterResult> =>
    oasisFetch<OasisHerzRegisterResult>('/herzid/register', {
        method: 'POST',
        body: JSON.stringify(req),
    }, jwt);

// Fetches the HerzID profile for a given herzId string (public — no auth required).
export const oasisHerzProfile = (herzId: string): Promise<OasisHerzProfileResult> =>
    oasisFetch<OasisHerzProfileResult>(`/herzid/profile/${encodeURIComponent(herzId)}`);

// Fetches the vouch chain for a herzId (public).
export const oasisHerzVouchChain = (herzId: string): Promise<unknown> =>
    oasisFetch(`/herzid/vouch-chain/${encodeURIComponent(herzId)}`);

// Posts a vouch for another herzId (authenticated).
export const oasisHerzVouch = (
    targetHerzId: string,
    jwt: string,
): Promise<{ isSuccess: boolean; message?: string }> =>
    oasisFetch('/herzid/vouch', {
        method: 'POST',
        body: JSON.stringify({ herzId: targetHerzId }),
    }, jwt);
