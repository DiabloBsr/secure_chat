import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Callback OAuth / confirmation email.
 * Note : pour la réinitialisation de mot de passe on utilise /auth/reset
 * directement (la page exchange le code elle-même pour pouvoir aussi
 * regénérer les clés E2E).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/chat';

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, url),
    );
  }
  return NextResponse.redirect(new URL(next, url));
}
