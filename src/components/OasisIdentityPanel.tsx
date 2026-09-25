import { useState } from 'react';
import { useOasisIdentity } from '../hooks/useOasisIdentity';
import { herzClearanceLabel, displayHerzId } from '../domain/oasis';
import type { HerzRegisterRequest } from '../services/oasis';

// OasisIdentityPanel — the UI face for OASIS / HerzID identity.
//
// Rendered on a user's own profile settings page (or wherever the keeper chooses to place it).
// Three states:
//   1. Not linked — shows a "Link OASIS Avatar" form (OASIS email + password).
//   2. Linked, no HerzID — shows avatar info, karma, and a "Register HerzID" form.
//   3. Linked with HerzID — shows the full HerzID card with clearance tier.
//
// Credentials entered here are used once to call the OASIS API and are never stored in the
// browser (no localStorage, no state after the request completes).

export const OasisIdentityPanel = () => {
    const { identity, busy, error, link, unlink, registerHerzId, syncKarma, clearError } =
        useOasisIdentity();

    // Link form state
    const [linkEmail, setLinkEmail] = useState('');
    const [linkPass, setLinkPass] = useState('');

    // HerzID registration form state
    const [showHerzForm, setShowHerzForm] = useState(false);
    const [herzCountry, setHerzCountry] = useState('');
    const [herzVoucher, setHerzVoucher] = useState('');
    const [herzRegEmail, setHerzRegEmail] = useState('');
    const [herzRegPass, setHerzRegPass] = useState('');

    // Karma sync form state
    const [showSyncForm, setShowSyncForm] = useState(false);
    const [syncEmail, setSyncEmail] = useState('');
    const [syncPass, setSyncPass] = useState('');

    const handleLink = async (e: React.FormEvent) => {
        e.preventDefault();
        await link(linkEmail, linkPass);
        setLinkEmail(''); setLinkPass('');
    };

    const handleHerzRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        const req: HerzRegisterRequest & { oasisEmail: string; oasisPassword: string } = {
            countryCode: herzCountry.trim(),
            voucherHerzId: herzVoucher.trim() || undefined,
            oasisEmail: herzRegEmail,
            oasisPassword: herzRegPass,
        };
        await registerHerzId(req);
        setShowHerzForm(false);
        setHerzCountry(''); setHerzVoucher(''); setHerzRegEmail(''); setHerzRegPass('');
    };

    const handleSyncKarma = async (e: React.FormEvent) => {
        e.preventDefault();
        await syncKarma(syncEmail, syncPass);
        setShowSyncForm(false);
        setSyncEmail(''); setSyncPass('');
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
                    </p>
                    <input
                        type="email"
                        placeholder="OASIS email"
                        value={linkEmail}
                        onChange={e => setLinkEmail(e.target.value)}
                        required
                        className="w-full border border-zinc-300 dark:border-zinc-600 rounded px-3 py-2
                                   bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                    <input
                        type="password"
                        placeholder="OASIS password"
                        value={linkPass}
                        onChange={e => setLinkPass(e.target.value)}
                        required
                        className="w-full border border-zinc-300 dark:border-zinc-600 rounded px-3 py-2
                                   bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                    <button
                        type="submit"
                        disabled={busy}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded
                                   disabled:opacity-50 transition-colors"
                    >
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
                            <button
                                onClick={() => unlink()}
                                disabled={busy}
                                className="text-xs text-zinc-400 hover:text-red-500 transition-colors disabled:opacity-50"
                            >
                                Unlink
                            </button>
                        </div>
                        <div className="text-zinc-500 dark:text-zinc-400 text-xs">{identity.avatarId}</div>
                        {identity.karmaScore != null && (
                            <div className="flex items-center gap-2 mt-2">
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                    ✦ {identity.karmaScore.toLocaleString()} karma
                                </span>
                                <button
                                    onClick={() => setShowSyncForm(v => !v)}
                                    className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                                >
                                    sync
                                </button>
                            </div>
                        )}
                        {identity.karmaSyncedAt && (
                            <div className="text-xs text-zinc-400">
                                Synced {new Date(identity.karmaSyncedAt).toLocaleDateString()}
                            </div>
                        )}
                    </div>

                    {/* Karma sync form */}
                    {showSyncForm && (
                        <form onSubmit={handleSyncKarma} className="space-y-2 pl-2 border-l-2 border-emerald-200">
                            <p className="text-zinc-500 text-xs">Re-enter OASIS credentials to sync karma.</p>
                            <input type="email" placeholder="OASIS email" value={syncEmail}
                                onChange={e => setSyncEmail(e.target.value)} required
                                className="w-full border border-zinc-300 dark:border-zinc-600 rounded px-3 py-1.5
                                           bg-white dark:bg-zinc-800 text-xs" />
                            <input type="password" placeholder="OASIS password" value={syncPass}
                                onChange={e => setSyncPass(e.target.value)} required
                                className="w-full border border-zinc-300 dark:border-zinc-600 rounded px-3 py-1.5
                                           bg-white dark:bg-zinc-800 text-xs" />
                            <div className="flex gap-2">
                                <button type="submit" disabled={busy}
                                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs
                                               rounded disabled:opacity-50">
                                    {busy ? 'Syncing…' : 'Sync'}
                                </button>
                                <button type="button" onClick={() => setShowSyncForm(false)}
                                    className="px-3 py-1 text-zinc-500 text-xs hover:text-zinc-700">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    )}

                    {/* HerzID card */}
                    {identity.herzId ? (
                        <div className="rounded border border-violet-200 dark:border-violet-700
                                        bg-violet-50 dark:bg-violet-900/20 p-4 space-y-1">
                            <div className="text-xs font-semibold uppercase tracking-wide
                                            text-violet-500 dark:text-violet-400">HerzID</div>
                            <div className="font-mono text-lg font-bold text-violet-800 dark:text-violet-200">
                                {displayHerzId(identity.herzId)}
                            </div>
                            {identity.herzClearanceLevel != null && (
                                <div className="text-xs text-violet-600 dark:text-violet-300">
                                    {herzClearanceLabel(identity.herzClearanceLevel)}
                                </div>
                            )}
                            {identity.herzJoinedAt && (
                                <div className="text-xs text-zinc-400">
                                    Joined {new Date(identity.herzJoinedAt).toLocaleDateString()}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <button
                                onClick={() => setShowHerzForm(v => !v)}
                                className="text-sm text-violet-600 dark:text-violet-400
                                           hover:underline transition-colors"
                            >
                                {showHerzForm ? 'Cancel' : '+ Register a HerzID'}
                            </button>

                            {showHerzForm && (
                                <form onSubmit={handleHerzRegister}
                                    className="space-y-2 pl-2 border-l-2 border-violet-200">
                                    <p className="text-xs text-zinc-500">
                                        A HerzID requires a voucher who is already a member,
                                        unless you are a Founder.
                                    </p>
                                    <input
                                        placeholder="Country code (e.g. 052)"
                                        value={herzCountry}
                                        onChange={e => setHerzCountry(e.target.value)}
                                        required maxLength={3}
                                        className="w-full border border-zinc-300 dark:border-zinc-600 rounded
                                                   px-3 py-1.5 bg-white dark:bg-zinc-800 text-xs" />
                                    <input
                                        placeholder="Voucher HerzID (optional for Founders)"
                                        value={herzVoucher}
                                        onChange={e => setHerzVoucher(e.target.value)}
                                        className="w-full border border-zinc-300 dark:border-zinc-600 rounded
                                                   px-3 py-1.5 bg-white dark:bg-zinc-800 text-xs" />
                                    <input type="email" placeholder="OASIS email"
                                        value={herzRegEmail}
                                        onChange={e => setHerzRegEmail(e.target.value)} required
                                        className="w-full border border-zinc-300 dark:border-zinc-600 rounded
                                                   px-3 py-1.5 bg-white dark:bg-zinc-800 text-xs" />
                                    <input type="password" placeholder="OASIS password"
                                        value={herzRegPass}
                                        onChange={e => setHerzRegPass(e.target.value)} required
                                        className="w-full border border-zinc-300 dark:border-zinc-600 rounded
                                                   px-3 py-1.5 bg-white dark:bg-zinc-800 text-xs" />
                                    <button type="submit" disabled={busy}
                                        className="px-3 py-1 bg-violet-600 hover:bg-violet-700 text-white
                                                   text-xs rounded disabled:opacity-50">
                                        {busy ? 'Registering…' : 'Register HerzID'}
                                    </button>
                                </form>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
