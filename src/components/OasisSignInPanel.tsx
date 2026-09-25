import { useState } from 'react';
import { signInWithOasis } from '../hooks/useOasisIdentity';

// OasisSignInPanel — "Sign in with OASIS" (inbound OIDC, ring 2026-09-25).
//
// Sends OASIS credentials to the `signInWithOasis` Cloud Function, which verifies them,
// finds or creates the corresponding Firebase account, and returns a custom token.
// signInWithCustomToken() completes the Firebase sign-in. The browser never touches the
// OASIS JWT.
//
// Drop this panel alongside (or instead of) the standard Google sign-in button.
// onSuccess is called after a successful Firebase sign-in; onCancel is optional.

interface Props {
    onSuccess?: () => void;
    onCancel?: () => void;
}

export const OasisSignInPanel = ({ onSuccess, onCancel }: Props) => {
    const [email,  setEmail]  = useState('');
    const [pass,   setPass]   = useState('');
    const [busy,   setBusy]   = useState(false);
    const [error,  setError]  = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true); setError(null);
        try {
            await signInWithOasis(email, pass);
            setEmail(''); setPass('');
            onSuccess?.();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="space-y-4 text-sm">
            <div className="flex items-center gap-2">
                <span className="text-violet-600 dark:text-violet-400 text-lg leading-none">✦</span>
                <h3 className="font-semibold text-base">Sign in with OASIS</h3>
            </div>

            <p className="text-zinc-500 dark:text-zinc-400 text-xs">
                Use your OASIS Avatar credentials to sign in. A lightseed account will be
                created for you automatically if one doesn't exist yet.
            </p>

            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700
                                rounded p-3 text-red-700 dark:text-red-300 text-xs">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
                <input
                    type="email" placeholder="OASIS email" value={email}
                    onChange={e => setEmail(e.target.value)} required autoComplete="username"
                    className="w-full border border-zinc-300 dark:border-zinc-600 rounded px-3 py-2
                               bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
                <input
                    type="password" placeholder="OASIS password" value={pass}
                    onChange={e => setPass(e.target.value)} required autoComplete="current-password"
                    className="w-full border border-zinc-300 dark:border-zinc-600 rounded px-3 py-2
                               bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
                <div className="flex gap-2">
                    <button type="submit" disabled={busy}
                        className="flex-1 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded font-medium
                                   disabled:opacity-50 transition-colors">
                        {busy ? 'Signing in…' : 'Sign in with OASIS'}
                    </button>
                    {onCancel && (
                        <button type="button" onClick={onCancel}
                            className="px-4 py-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 text-sm">
                            Cancel
                        </button>
                    )}
                </div>
            </form>
        </div>
    );
};
