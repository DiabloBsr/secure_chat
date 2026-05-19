'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  AuthShell,
  Field,
  Notice,
  Submit,
} from '@/app/(auth)/auth-shell';

export default function ForgotPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        { redirectTo: `${window.location.origin}/auth/reset` },
      );
      if (resetError) throw resetError;
      setSent(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow="№ récupération"
      title="Réinitialiser le"
      italicWord="sceau"
      intro="Votre mot de passe protège votre clé. Le réinitialiser génèrera une nouvelle paire de clés et rendra l’historique passé illisible. C’est inévitable, et c’est ce que doit garantir le chiffrement bout en bout."
      footer={
        <Link
          href="/login"
          className="text-[color:var(--accent)] hover:underline"
        >
          ← Retour à la connexion
        </Link>
      }
    >
      {sent ? (
        <Notice tone="success">
          Si un compte existe pour <span className="font-medium">{email}</span>, un
          lien de réinitialisation vient d’être envoyé.
        </Notice>
      ) : (
        <form onSubmit={onSubmit} className="space-y-6">
          <Field
            label="email"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            autoFocus
          />
          {error && <Notice tone="danger">{error}</Notice>}
          <Submit
            loading={loading}
            loadingLabel="Envoi…"
            label="Envoyer le lien"
          />
        </form>
      )}
    </AuthShell>
  );
}
