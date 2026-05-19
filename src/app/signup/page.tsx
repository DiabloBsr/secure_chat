'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

export default function SignupPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!/^[a-z0-9_]{3,30}$/.test(username)) {
      setError(
        'Username : 3 à 30 caractères, minuscules / chiffres / underscore uniquement.',
      );
      return;
    }
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
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username, display_name: username },
        },
      });
      if (signUpError) throw signUpError;
      if (!signUpData.user) {
        throw new Error('Inscription échouée (user nul).');
      }

      if (!signUpData.session) {
        setInfo(
          'Compte créé. Confirme ton email pour activer le chiffrement et te connecter.',
        );
        setLoading(false);
        return;
      }

      const keyPair = await generateIdentityKeyPair();
      const publicJwk = await exportPublicJwk(keyPair.publicKey);
      const wrapped = await wrapPrivateKey(keyPair.privateKey, password);

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ public_key: publicJwk })
        .eq('id', signUpData.user.id);
      if (profileError) throw profileError;

      const { error: keyError } = await supabase.from('user_keys').insert({
        user_id: signUpData.user.id,
        encrypted_private_key: wrapped.ciphertext,
        iv: wrapped.iv,
        salt: wrapped.salt,
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
      eyebrow="№ acte 1 — création"
      title="Sceller votre"
      italicWord="identité"
      intro="Votre mot de passe sert aussi à protéger votre clé de chiffrement. Choisissez-le fort — il ne peut pas être récupéré sans perdre l’historique."
      footer={
        <>
          Déjà inscrit ?{' '}
          <Link
            href="/login"
            className="text-[color:var(--accent)] hover:underline"
          >
            Connexion
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-6">
        <Field
          label="username"
          hint="public · 3 à 30 caractères"
          placeholder="alice_42"
          value={username}
          onChange={setUsername}
          autoComplete="username"
          autoFocus
        />
        <Field
          label="email"
          type="email"
          placeholder="alice@example.com"
          value={email}
          onChange={setEmail}
          autoComplete="email"
        />
        <Field
          label="mot de passe"
          hint="≥ 10 caractères"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
        />
        <Field
          label="confirme"
          type="password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
        />

        {error && <Notice tone="danger">{error}</Notice>}
        {info && <Notice tone="success">{info}</Notice>}

        <Submit
          loading={loading}
          loadingLabel="Création…"
          label="Créer mon compte"
        />
      </form>
    </AuthShell>
  );
}
