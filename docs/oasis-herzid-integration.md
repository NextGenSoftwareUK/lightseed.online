# OASIS Avatar & HerzID Integration

**Ring:** 2026-09-25 (updated — all deferred items implemented)
**Status:** Feature-complete. Awaiting `.env` configuration and first-user bootstrap.

---

## What this is

lightseed uses Firebase as its identity backbone and keeps it. OASIS identity is **optional and additive**: a signed-in user may link their OASIS Avatar once, and from that point their profile displays karma from the OASIS network and — if they register — a HerzID.

Additionally, users may **sign in to lightseed using OASIS credentials directly** (inbound OIDC), which creates or reuses a Firebase account automatically.

Nothing in the core session (Firebase uid, chains, links, guardianships) changes. The OASIS layer is a display enrichment, not an auth replacement.

---

## Architecture

```
Browser                     Cloud Functions             Firestore / Auth
──────                      ───────────────             ────────────────
OasisSignInPanel
  signInWithOasis()    ──►  signInWithOasis         ──►  createCustomToken → signInWithCustomToken

OasisIdentityPanel
  link()               ──►  linkOasisAvatar         ──►  oasisTokens/{uid} (JWT, admin only)
                                                    ──►  users/{uid}.oasisIdentity (display fields)
  unlink()             ──►  unlinkOasisAvatarFn     ──►  deletes both
  syncKarma()          ──►  syncOasisKarma          ──►  users/{uid}.oasisIdentity.karmaScore
  registerHerzId()     ──►  registerOasisHerzId     ──►  users/{uid}.oasisIdentity.herzId …
  vouchForHerzId()     ──►  vouchForHerzId          →    (OASIS API only, no Firestore write)

OasisBiometricPanel
  enrollBiometric()    ──►  enrollBiometric         ──►  users/{uid}.oasisIdentity.biometricEnrolled
  verifyBiometric()    ──►  verifyBiometric         →    returns boolean

HerzVouchChainPanel    ──►  (direct OASIS API read — public, no JWT needed)
```

### Files

| File | Role |
|------|------|
| `src/domain/oasis.ts` | Pure types and display helpers |
| `src/services/oasis.ts` | Plain-fetch OASIS API client (public reads + biometric stubs) |
| `src/services/firebase/oasis.ts` | Client Firestore read (`getLinkedOasisIdentity`) |
| `src/hooks/useOasisIdentity.ts` | React hook — all mutations via Cloud Functions |
| `src/components/OasisIdentityPanel.tsx` | Link, karma sync, HerzID register, vouch UI |
| `src/components/HerzVouchChainPanel.tsx` | Public HerzID lookup + vouch chain visualisation |
| `src/components/OasisBiometricPanel.tsx` | Voice biometric enrolment and verification |
| `src/components/OasisSignInPanel.tsx` | "Sign in with OASIS" (inbound OIDC) |
| `functions/src/oasis.ts` | All Cloud Functions: link, sync, register, vouch, biometric, sign-in |
| `tests/oasis.test.ts` | Domain logic tests |

### Firestore schema (users/{uid})

```json
{
  "oasisIdentity": {
    "avatarId": "uuid-from-oasis-api",
    "avatarUsername": "display-name",
    "linkedAt": "2026-09-25T12:00:00.000Z",
    "karmaScore": 1234,
    "karmaSyncedAt": "2026-09-25T12:00:00.000Z",
    "herzId": "052·0·000·000·001·R",
    "herzClearanceLevel": 3,
    "herzCountryCode": "052",
    "herzJoinedAt": "2026-09-25",
    "biometricEnrolled": true
  }
}
```

### Firestore schema (oasisTokens/{uid}) — admin SDK only

```json
{
  "avatarId": "uuid-from-oasis-api",
  "token": "<OASIS-JWT>",
  "storedAt": "2026-09-25T12:00:00.000Z"
}
```

The `oasisTokens` collection has `allow read, write: if false` in Firestore rules — only the admin SDK can touch it.

---

## Environment variable

```
VITE_OASIS_API_URL=https://oasisweb4.one/api   # browser build (default: same value)
OASIS_API_URL=https://oasisweb4.one/api        # Cloud Functions runtime (process.env)
```

Both fall back to `https://oasisweb4.one/api` if absent.

---

## HerzID — how it works

A HerzID is a credentialed identity within the Enlightened Nations / HerzWorld ecosystem.

**Format:** `<3-digit-country>·<10-digit-sequential>·<QEA-seal>`
**Example:** `052·0·000·000·001·✦` (the `✦` glyph is display-only; the stored seal char is A–Z0–9)

### Clearance tiers

| Level | Title |
|-------|-------|
| 1 | Explorer |
| 2 | Wanderer |
| 3 | Tribe Member |
| 4 | Contributor |
| 5 | Ally |
| 6 | Guardian |
| 7 | Elder |
| 8 | Flame Keeper |
| 9 | Sovereign / Founder |

### Vouching

Every new HerzID requires a voucher who is already a member. Each holder starts with 12 vouches; Founders have unlimited. Users with a HerzID can vouch for others directly from the `OasisIdentityPanel`.

---

## How to use the components

```tsx
// Settings page — link avatar, manage HerzID, vouch
import { OasisIdentityPanel } from '../components/OasisIdentityPanel';
<OasisIdentityPanel />

// Voice biometric (shown only when avatar is linked)
import { OasisBiometricPanel } from '../components/OasisBiometricPanel';
<OasisBiometricPanel />

// Public HerzID lookup + vouch chain
import { HerzVouchChainPanel } from '../components/HerzVouchChainPanel';
<HerzVouchChainPanel initialHerzId="052·0·000·000·001·✦" />

// Sign-in page — "Sign in with OASIS" alongside Google
import { OasisSignInPanel } from '../components/OasisSignInPanel';
<OasisSignInPanel onSuccess={() => navigate('/')} />

// Reading identity elsewhere (e.g. profile card)
import { useOasisIdentity } from '../hooks/useOasisIdentity';
const { identity } = useOasisIdentity();
// identity?.karmaScore, identity?.herzId, identity?.biometricEnrolled
```

---

## Bootstrap: seeding the first Founder

Before any user can register a HerzID from lightseed, a Founder HerzID must exist on the OASIS side. Steps:

1. Create an OASIS Avatar account for the Enlightened Nations founder.
2. Register a Founder HerzID (clearance level 9, no voucher — via the OASIS admin console or `POST /api/herzid/register` with a founder-enabled avatar).
3. That founder's HerzID can vouch for the first wave of lightseed users. The founder does NOT need a lightseed account.

---

## "Sign in with OASIS" — account resolution

1. OASIS login → get `avatarId`.
2. Query Firestore for `users` where `oasisIdentity.avatarId == avatarId`.
3. Found → mint a custom token for that Firebase UID.
4. Not found → look up Firebase Auth by email; create user if absent.
5. Write `oasisIdentity` link and store JWT in `oasisTokens/{uid}`.
6. Return custom token → browser calls `signInWithCustomToken()`.

---

## Security notes

- **JWT never in the browser.** OASIS Bearer tokens live only in `oasisTokens/{uid}`, written by the admin SDK. The browser receives only display fields.
- **No credential re-entry after link.** All mutations (karma sync, HerzID ops, vouch, biometric) use the stored JWT. If the token expires, the user re-links once.
- **oasisTokens is rule-denied.** `allow read, write: if false` means no client path can reach it.
- **signInWithOasis creates accounts.** A new Firebase user is created if no account exists for the OASIS email. This is intentional — OASIS is a recognised identity provider for this network.
- **Biometric audio is not stored.** The base64 audio blob is passed through the Cloud Function to the OASIS API and discarded. Nothing is persisted except the `biometricEnrolled: true` flag.

---

## Biometric voice enrolment — endpoint notes

The OASIS BiometricController endpoints are assumed to follow the pattern:
- `POST /api/biometric/enrol` — body: `{ avatarId, audio: <base64> }`
- `POST /api/biometric/verify` — body: `{ avatarId, audio: <base64> }`

Confirm exact request/response shapes against the OASIS API docs before enabling in production.

---

## What is NOT yet implemented

| Item | Notes |
|------|-------|
| JWT refresh on expiry | When the stored token expires, mutations fail. The user must re-link. A background refresh callable could be added when the OASIS API exposes a token-refresh endpoint. |
| Full OIDC discovery doc | `/.well-known/openid-configuration` for OASIS is not yet served by this node. |
