'use client';

import Link from 'next/link';

export function AuthShell({
  eyebrow,
  title,
  italicWord,
  intro,
  children,
  footer,
}: {
  eyebrow: string;
  title: React.ReactNode;
  italicWord?: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-[color:var(--line)]">
        <div className="mx-auto max-w-6xl px-6 py-5 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              className="text-[color:var(--accent)]"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <rect x="4" y="11" width="16" height="9" rx="1.5" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              <circle
                cx="12"
                cy="15.5"
                r="1.2"
                fill="currentColor"
                stroke="none"
              />
            </svg>
            <span className="font-[family-name:var(--font-geist-mono)] text-[13px] tracking-[0.12em] uppercase">
              secure<span className="text-[color:var(--muted)]"> / </span>chat
            </span>
          </Link>
          <Link
            href="/"
            className="text-[12px] font-[family-name:var(--font-geist-mono)] text-[color:var(--muted)] hover:text-[color:var(--ink)] transition"
          >
            ← retour
          </Link>
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-6xl w-full px-6 py-12 sm:py-20 grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-14 items-start">
        <div className="md:col-span-7 fade-up">
          <p className="small-caps text-[11px] font-[family-name:var(--font-geist-mono)] text-[color:var(--muted)]">
            {eyebrow}
          </p>
          <h1 className="mt-4 font-[family-name:var(--font-instrument-serif)] text-[clamp(2.25rem,5vw,3.75rem)] leading-[1] tracking-tight text-[color:var(--ink)]">
            {title}
            {italicWord && (
              <>
                {' '}
                <em className="italic text-[color:var(--accent)]">
                  {italicWord}
                </em>
              </>
            )}
          </h1>
          {intro && (
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-[color:var(--ink-soft)]">
              {intro}
            </p>
          )}
          <div
            className="mt-10 max-w-md fade-up"
            style={{ animationDelay: '90ms' }}
          >
            {children}
          </div>
          {footer && (
            <div className="mt-8 max-w-md text-[13px] text-[color:var(--muted)]">
              {footer}
            </div>
          )}
        </div>

        <aside
          className="hidden md:block md:col-span-5 fade-up"
          style={{ animationDelay: '60ms' }}
        >
          <div className="rounded-2xl hairline bg-[color:var(--surface)] p-6 shadow-[0_0_0_1px_var(--line),0_30px_60px_-30px_rgba(0,0,0,0.25)]">
            <div className="text-[10px] font-[family-name:var(--font-geist-mono)] uppercase tracking-[0.18em] text-[color:var(--muted)]">
              note · chiffrement
            </div>
            <p className="mt-4 font-[family-name:var(--font-instrument-serif)] text-2xl leading-snug text-[color:var(--ink)]">
              Votre mot de passe ne protège pas seulement votre compte —{' '}
              <em className="italic text-[color:var(--accent)]">
                il scelle votre clé privée
              </em>{' '}
              localement.
            </p>
            <ul className="mt-6 space-y-3 text-[13px] text-[color:var(--ink-soft)]">
              <CipherLine k="key.exchange" v="ecdh · p-256" />
              <CipherLine k="cipher" v="aes-gcm · 256" />
              <CipherLine k="kdf" v="pbkdf2-sha256 · 600 000" />
              <CipherLine k="iv" v="12 bytes · random" />
            </ul>
          </div>
        </aside>
      </main>
    </div>
  );
}

function CipherLine({ k, v }: { k: string; v: string }) {
  return (
    <li className="flex items-center justify-between font-[family-name:var(--font-geist-mono)] text-[12px]">
      <span className="text-[color:var(--muted)]">{k}</span>
      <span className="text-[color:var(--ink)]">{v}</span>
    </li>
  );
}

// ----------------------------------------------------------------------------
// Form primitives partagées
// ----------------------------------------------------------------------------

export function Field({
  label,
  hint,
  type = 'text',
  placeholder,
  value,
  onChange,
  autoComplete,
  autoFocus,
}: {
  label: string;
  hint?: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between">
        <span className="small-caps text-[10px] font-[family-name:var(--font-geist-mono)] text-[color:var(--muted)]">
          {label}
        </span>
        {hint && (
          <span className="text-[10px] font-[family-name:var(--font-geist-mono)] text-[color:var(--muted)]">
            {hint}
          </span>
        )}
      </span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        required
        className="mt-1.5 w-full bg-transparent border-0 border-b border-[color:var(--line-strong)] px-0 py-2 text-[15px] text-[color:var(--ink)] placeholder:text-[color:var(--muted)]/60 focus:border-[color:var(--accent)] focus:outline-none transition"
      />
    </label>
  );
}

export function Submit({
  loading,
  loadingLabel,
  label,
}: {
  loading: boolean;
  loadingLabel: string;
  label: string;
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="group w-full inline-flex items-center justify-center gap-3 rounded-full bg-[color:var(--accent)] px-6 py-3 text-[14px] font-medium text-[color:var(--accent-ink)] hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <span>{loading ? loadingLabel : label}</span>
      {!loading && (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition group-hover:translate-x-0.5"
        >
          <path d="M5 12h14" />
          <path d="M13 6l6 6-6 6" />
        </svg>
      )}
    </button>
  );
}

export function Notice({
  tone,
  children,
}: {
  tone: 'danger' | 'success' | 'warn';
  children: React.ReactNode;
}) {
  const colors = {
    danger: 'bg-[color:var(--danger-soft)] text-[color:var(--danger)]',
    success: 'bg-[color:var(--accent-soft)] text-[color:var(--accent)]',
    warn: 'bg-[color:var(--warn-soft)] text-[color:var(--warn)]',
  };
  return (
    <div
      className={`rounded-xl px-4 py-2.5 text-[13px] leading-snug ${colors[tone]}`}
    >
      {children}
    </div>
  );
}
