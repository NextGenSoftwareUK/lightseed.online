// OasisIdentityPanel — link/unlink avatar + HerzID management.
// Avatar link form and card are lightseed-specific (Firebase + Cloud Functions).
// HerzID display, registration, karma sync, and vouching are delegated to
// @oasisomniverse/react's HerzIdPanel via callback overrides.
import { useState } from 'react';
import { HerzIdPanel } from '@oasisomniverse/react';
import { useOasisIdentity } from '../hooks/useOasisIdentity';

export const OasisIdentityPanel = () => {
    const { identity, busy, error, link, unlink, registerHerzId, syncKarma, vouchForHerzId, clearError } = useOasisIdentity();

    const [linkEmail, setLinkEmail] = useState('');
    const [linkPass,  setLinkPass]  = useState('');

    const handleLink = async (e: React.FormEvent) => {
        e.preventDefault();
        await link(linkEmail, linkPass);
        setLinkEmail(''); setLinkPass('');
    };

    return (
        <div className="space-y-4 text-sm">
            <h3 className="font-semibold text-base">OASIS Avatar & HerzID</h3>

            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700
                                rounded p-3 flex items-start gap-2 text-red-700 dark:text-red-300">
                    <span className="flex-1">{error}</span>
                    <button onClick={clearError} className="shrink-0 hover:opacity-70">✕</button>
                </div>
            )}

            {/* ── Not linked ─────────────────────────────────────────────────────────── */}
            {!identity && (
                <form onSubmit={handleLink} className="space-y-3">
                    <p className="text-zinc-500 dark:text-zinc-400">
                        Link your OASIS Avatar to display karma and optionally register a HerzID.
                        Credentials are sent once — no re-entry needed for sync or HerzID operations.
                    </p>
                    <input
                        type="email" placeholder="OASIS email" value={linkEmail}
                        onChange={e => setLinkEmail(e.target.value)} required
                        className="w-full border border-zinc-300 dark:border-zinc-600 rounded px-3 py-2
                                   bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                    <input
                        type="password" placeholder="OASIS password" value={linkPass}
                        onChange={e => setLinkPass(e.target.value)} required
                        className="w-full border border-zinc-300 dark:border-zinc-600 rounded px-3 py-2
                                   bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                    <button type="submit" disabled={busy}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded
                                   disabled:opacity-50 transition-colors">
                        {busy ? 'Linking…' : 'Link OASIS Avatar'}
                    </button>
                </form>
            )}

            {/* ── Linked ─────────────────────────────────────────────────────────────── */}
            {identity && (
                <div className="space-y-4">
                    {/* Avatar card */}
                    <div className="rounded border border-zinc-200 dark:border-zinc-700 p-4 space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="font-medium">{identity.avatarUsername}</span>
                            <button onClick={() => unlink()} disabled={busy}
                                className="text-xs text-zinc-400 hover:text-red-500 transition-colors disabled:opacity-50">
                                Unlink
                            </button>
                        </div>
                        <div className="text-zinc-500 dark:text-zinc-400 text-xs font-mono">{identity.avatarId}</div>
                        {identity.biometricEnrolled && (
                            <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                                🎙 Voice biometric enrolled
                            </div>
                        )}
                    </div>

                    {/* HerzID — generic panel with Cloud Function callbacks */}
                    <HerzIdPanel
                        herzId={identity.herzId}
                        clearanceLevel={identity.herzClearanceLevel}
                        countryCode={identity.herzCountryCode}
                        joinedAt={identity.herzJoinedAt}
                        karmaScore={identity.karmaScore}
                        karmaSyncedAt={identity.karmaSyncedAt}
                        onKarmaSync={async () => {
                            await syncKarma();
                            return { karmaScore: identity.karmaScore ?? 0 };
                        }}
                        onRegister={async ({ countryCode, voucherHerzId }) => {
                            await registerHerzId(countryCode, voucherHerzId);
                            // props will update via hook's setIdentity; no return value needed
                        }}
                        onVouch={vouchForHerzId}
                    />
                </div>
            )}
        </div>
    );
};
