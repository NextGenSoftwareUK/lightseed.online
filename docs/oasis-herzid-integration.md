# OASIS Avatar & HerzID Integration

**Ring:** 2026-09-20  
**Status:** Implementation complete — awaiting `.env` configuration and first-user bootstrap.

---

## What this is

lightseed uses Firebase as its identity backbone and keeps it. OASIS identity is **optional and additive**: a signed-in user may link their OASIS Avatar once, and from that point their profile displays karma from the OASIS network and — if they register — a HerzID.

Nothing in the core session (Firebase uid, chains, links, guardianships) changes. The OASIS layer is a display enrichment, not an auth replacement.

---

## Architecture

```
Browser                     Firestore                   OASIS API
──────                      ─────────                   ─────────
useOasisIdentity()
  │
  ├─ link()           ──►  users/{uid}.oasisIdentity  ──►  POST /api/avatar/login
  ├─ syncKarma()      ──►  users/{uid}.oasisIdentity  ──►  GET  /api/karma/{id}
  ├─ registerHerzId() ──►  users/{uid}.oasisIdentity  ──►  POST /api/herzid/register
  └─ unlink()         ──►  users/{uid}.oasisIdentity = null
```

### Files added

| File | Role |
|------|------|
| `src/domain/oasis.ts` | Pure types and display helpers — no backend, no React |
| `src/services/oasis.ts` | Plain-fetch OASIS API client (honours the network monitor) |
| `src/services/firebase/oasis.ts` | Firestore read/write for the linked identity |
| `src/hooks/useOasisIdentity.ts` | React hook — the single seam components use |
| `src/components/OasisIdentityPanel.tsx` | Settings UI — link, HerzID registration, karma sync |
| `tests/oasis.test.ts` | Domain logic tests (tiers, labels, display) |

### Firestore schema (users/{uid})

```json
{
  "oasisIdentity": {
    "avatarId": "uuid-from-oasis-api",
    "avatarUsername": "display-name",
    "linkedAt": "2026-09-20T12:00:00.000Z",
    "karmaScore": 1234,
    "karmaSyncedAt": "2026-09-20T12:00:00.000Z",
    "herzId": "052·0·000·000·001·R",
    "herzClearanceLevel": 3,
    "herzCountryCode": "052",
    "herzJoinedAt": "2026-09-20"
  }
}
```

`oasisIdentity` is absent (not null) when no avatar is linked. Setting it to `null` unlinks.  
The OASIS JWT is **never** stored here — it is held server-side only.

---

## Environment variable

Add to `.env` (or Railway environment variables for the deployed app):

```
VITE_OASIS_API_URL=https://oasisweb4.one/api
```

The service falls back to `https://oasisweb4.one/api` if the variable is absent, so development works without any `.env` changes.

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

Every new HerzID requires a voucher who is already a member. Each holder starts with 12 vouches; Founders have unlimited. This means **at least one Founder account must be seeded before any lightseed user can register a HerzID** — see Bootstrap below.

The QEA seal is computed server-side by the OASIS API using HMAC-SHA256 over the sequence number, country code, profile fields, and a private seed (`QeaPrivateSeed` in `OASIS_DNA.json`).

---

## How to use it in the UI

Drop `<OasisIdentityPanel />` on any settings or profile page:

```tsx
import { OasisIdentityPanel } from '../components/OasisIdentityPanel';

// Inside a settings page:
<OasisIdentityPanel />
```

The panel is self-contained — it manages its own form state and calls `useOasisIdentity()` internally.

To read identity data elsewhere (e.g. to show karma on a profile card):

```tsx
import { useOasisIdentity } from '../hooks/useOasisIdentity';

const { identity } = useOasisIdentity();
// identity?.karmaScore, identity?.herzId, identity?.herzClearanceLevel
```

---

## Bootstrap: seeding the first Founder

Before any user can register a HerzID from lightseed, a Founder HerzID must exist on the OASIS side. Steps:

1. Create an OASIS Avatar account for the Enlightened Nations founder (via the OASIS API or web UI).
2. Register a Founder HerzID for that account (clearance level 9, no voucher required — set via the OASIS admin console or by calling `POST /api/herzid/register` with a founder-enabled avatar).
3. That founder's HerzID can then vouch for the first wave of lightseed users.

The founder does NOT need to be a lightseed user — they can vouch for lightseed users by sharing their HerzID string, which the registering user enters in the voucher field.

---

## Security notes

- **JWT never stored in the browser.** The OASIS Bearer token is obtained, used for a single request (login → fetch display fields), and discarded. Any future mutation that needs a token (karma sync, HerzID registration) requires the user to re-enter credentials. A Cloud Function (`functions/src/oasis.ts`) can be added later to cache the token server-side via the admin SDK and expose a `refreshOasisToken` callable, removing the credential re-entry requirement.
- **Firestore rules.** `users/{uid}` is already owner-writable for all profile fields. The `oasisIdentity` map follows the same rule — no new rule needed, but a comment was added to make the intent explicit.
- **Credentials are never logged.** `src/services/oasis.ts` uses plain `fetch` with no debug logging of request bodies.

---

## What is NOT yet implemented

| Item | Notes |
|------|-------|
| Cloud Function JWT cache | Future: store OASIS token server-side so users don't re-enter credentials for karma sync and HerzID ops |
| Biometric voice enrolment | The OASIS `BiometricController` exists; a lightseed UI panel for it is not yet built |
| HerzID vouch-from-lightseed | `oasisHerzVouch()` is in `services/oasis.ts`; no UI panel yet |
| Vouch chain visualisation | `oasisHerzVouchChain()` is exposed; rendering the tree is future work |
| OIDC "Login with OASIS" | `sso.html` is already in the repo for the reverse flow; a full OIDC inbound login is a separate initiative |
