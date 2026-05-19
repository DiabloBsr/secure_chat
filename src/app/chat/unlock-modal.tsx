'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { unwrapPrivateKey } from '@/lib/crypto/keys';
import { setIdentityPrivateKey } from '@/lib/crypto/session';

export function UnlockModal({
  userId,
  onUnlocked,
  onSignOut,
}: {
  userId: string;
  onUnlocked: () => void;
  onSignOut: () => void;
}) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: keyError } = await supabase
        .from('user_keys')
        .select('encrypted_private_key, iv, salt')
        .eq('user_id', userId)
        .single();
      if (keyError) throw keyError;
      if (!data) throw new Error('Aucune clé trouvée pour ce compte.');

      const privateKey = await unwrapPrivateKey(
        {
          ciphertext: data.encrypted_private_key,
          iv: data.iv,
          salt: data.salt,
        },
        password,
      ).catch(() => {
        throw new Error('Mot de passe incorrect.');
      });

      setIdentityPrivateKey(privateKey);
      onUnlocked();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{ background: 'color-mix(in srgb, var(--bg) 80%, transparent)' }}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(40% 40% at 50% 30%, color-mix(in srgb, var(--accent-soft) 60%, transparent), transparent 70%)',
        }}
      />
      <div className="relative w-full max-w-md rounded-2xl bg-[color:var(--surface)] p-8 shadow-[0_0_0_1px_var(--line),0_40px_80px_-20px_rgba(0,0,0,0.35)]">
        <div className="flex items-center gap-2 text-[10px] font-[family-name:var(--font-geist-mono)] uppercase tracking-[0.18em] text-[color:var(--muted)]">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-[color:var(--accent)]"
          >
            <rect x="4" y="11" width="16" height="9" rx="1.5" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          session · verrouillée
        </div>
        <h2 className="mt-4 font-[family-name:var(--font-instrument-serif)] text-3xl tracking-tight">
          Déverrouille
          <br />
          ta <em className="italic text-[color:var(--accent)]">clé</em>.
        </h2>
        <p className="mt-3 text-[14px] leading-relaxed text-[color:var(--ink-soft)]">
          Ressaisis ton mot de passe pour décoder ta clé localement. Elle reste
          en mémoire jusqu’à la fermeture de l’onglet.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="small-caps text-[10px] font-[family-name:var(--font-geist-mono)] text-[color:var(--muted)]">
              mot de passe
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              autoFocus
              required
              className="mt-1.5 w-full bg-transparent border-0 border-b border-[color:var(--line-strong)] py-2 text-[15px] focus:border-[color:var(--accent)] focus:outline-none transition"
            />
          </label>
          {error && (
            <p className="text-[13px] rounded-xl bg-[color:var(--danger-soft)] text-[color:var(--danger)] px-3.5 py-2.5">
              {error}
            </p>
          )}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onSignOut}
              className="flex-1 rounded-full hairline-strong px-4 py-2.5 text-[13px] text-[color:var(--ink-soft)] hover:border-[color:var(--ink)] transition"
            >
              Se déconnecter
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-full bg-[color:var(--accent)] px-4 py-2.5 text-[13px] font-medium text-[color:var(--accent-ink)] hover:opacity-90 disabled:opacity-50 transition"
            >
              {loading ? 'Vérif…' : 'Déverrouiller'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
