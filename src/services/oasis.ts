// OASIS API client — thin wrapper over @oasisomniverse/web4-api.
//
// Creates a single OASISClient pointed at the configured base URL and re-exports
// the subset of operations that lightseed's browser layer needs (public reads only —
// all authenticated mutations go through Cloud Functions in functions/src/oasis.ts).
//
// Import the client directly for ad-hoc calls:
//   import { oasisClient } from '../services/oasis';
//   const res = await oasisClient.herzId.vouchChain({ herzId: '...' });

import OASISClient from '@oasisomniverse/web4-api';

const getBase = (): string => {
    const meta = import.meta as unknown as { env?: Record<string, string> };
    return (meta.env?.['VITE_OASIS_API_URL'] ?? 'https://oasisweb4.one/api').replace(/\/$/, '');
};

// Singleton — one client per app session.
export const oasisClient = new OASISClient({ baseUrl: getBase() });

// ── Public (no-auth) convenience re-exports ───────────────────────────────────────────────
// Used directly by UI components for read-only lookups (vouch chain, QEA verify).

export const oasisHerzVouchChain = (herzId: string) =>
    oasisClient.herzId.vouchChain({ herzId });

export const oasisHerzVerify = (herzId: string) =>
    oasisClient.herzId.verify({ herzId });

export const oasisHerzProfile = (herzId: string) =>
    oasisClient.herzId.profile({ herzId });

// ── HerzRegisterRequest type (used by useOasisIdentity for type safety) ───────────────────
export interface HerzRegisterRequest {
    countryCode: string;
    voucherHerzId?: string;
}
