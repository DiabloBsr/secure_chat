'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  generateIdentityKeyPair,
  exportPublicJwk,
  wrapPrivateKey,
} from '@/lib/crypto/keys';
import { setIdentityPrivateKey } from '@/lib/crypto/session';
import {
  AuthShell,
  Field,
  Notice,
  Submit,
} from '@/app/(auth)/auth-shell';

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthShell eyebrow="№ scellement" title="Validation du lien…">
          <p className="text-[13px] text-[color:var(--muted)]">
            Vérification en cours.
          </p>
        </AuthShell>
      }
    >
      <ResetPasswordInner />
    </Suspense>
  );
}

function ResetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = params.get('code');
    if (!code) {
      setError(
        'Lien invalide ou expiré. Demande un nouveau lien de réinitialisation.',
      );
      setReady(true);
      return;
    }
    (async () => {
      const supabase = createClient();
      const { error: exchangeError } =
        await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        setError(`Échec de validation du lien : ${exchangeError.message}`);
      }
      setReady(true);
    })();
  }, [params]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 10) {
      setError('Le mot de passe doit faire au moins 10 caractères.');
      return;
    }
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: userData, error: updateError } =
        await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      if (!userData.user) throw new Error('User indisponible.');

      const keyPair = await generateIdentityKeyPair();
      const publicJwk = await exportPublicJwk(keyPair.publicKey);
      const wrapped = await wrapPrivateKey(keyPair.privateKey, password);

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ public_key: publicJwk })
        .eq('id', userData.user.id);
      if (profileError) throw profileError;

      const { error: keyError } = await supabase.from('user_keys').upsert({
        user_id: userData.user.id,
        encrypted_private_key: wrapped.ciphertext,
        iv: wrapped.iv,
        salt: wrapped.salt,
        updated_at: new Date().toISOString(),
      });
      if (keyError) throw keyError;

      setIdentityPrivateKey(keyPair.privateKey);
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
      eyebrow="№ nouveau sceau"
      title="Nouveau"
      italicWord="mot de passe"
      intro="Une nouvelle paire de clés sera générée. L’historique des messages reçus avant ce changement ne pourra plus être déchiffré — c’est la garantie du chiffrement bout en bout."
    >
      {!ready ? (
        <p className="text-[13px] text-[color:var(--muted)]">Validation du lien…</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-6">
          <Field
            label="nouveau mot de passe"
            hint="≥ 10 caractères"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            autoFocus
          />
          <Field
            label="confirme"
            type="password"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
          />
          {error && <Notice tone="danger">{error}</Notice>}
          <Submit loading={loading} loadingLabel="Mise à jour…" label="Mettre à jour" />
        </form>
      )}
    </AuthShell>
  );
}
