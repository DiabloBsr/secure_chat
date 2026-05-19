'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { unwrapPrivateKey } from '@/lib/crypto/keys';
import { setIdentityPrivateKey } from '@/lib/crypto/session';
import {
  AuthShell,
  Field,
  Notice,
  Submit,
} from '@/app/(auth)/auth-shell';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      if (!data.user) throw new Error('Connexion échouée.');

      const { data: keyData, error: keyError } = await supabase
        .from('user_keys')
        .select('encrypted_private_key, iv, salt')
        .eq('user_id', data.user.id)
        .single();
      if (keyError) throw keyError;
      if (!keyData) {
        throw new Error(
          'Aucune clé de chiffrement trouvée pour ce compte. Recrée ton compte ou contacte le support.',
        );
      }

      const privateKey = await unwrapPrivateKey(
        {
          ciphertext: keyData.encrypted_private_key,
          iv: keyData.iv,
          salt: keyData.salt,
        },
        password,
      ).catch(() => {
        throw new Error(
          'Impossible de déchiffrer ta clé : mot de passe incorrect ou clés corrompues.',
        );
      });

      setIdentityPrivateKey(privateKey);
      router.replace('/chat');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow="№ acte 2 — retour"
      title="Reprendre la"
      italicWord="conversation"
      intro="Votre mot de passe déverrouille votre clé localement. Aucune copie n’est envoyée au serveur."
      footer={
        <div className="flex justify-between gap-4">
          <Link
            href="/forgot"
            className="text-[color:var(--muted)] hover:text-[color:var(--ink)]"
          >
            Mot de passe oublié ?
          </Link>
          <Link
            href="/signup"
            className="text-[color:var(--accent)] hover:underline"
          >
            Créer un compte
          </Link>
        </div>
      }
    >
      <form onSubmit={onSubmit} className="space-y-6">
        <Field
          label="email"
          type="email"
          placeholder="alice@example.com"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          autoFocus
        />
        <Field
          label="mot de passe"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />

        {error && <Notice tone="danger">{error}</Notice>}

        <Submit loading={loading} loadingLabel="Connexion…" label="Entrer" />
      </form>
    </AuthShell>
  );
}
