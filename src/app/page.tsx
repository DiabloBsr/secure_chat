import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="flex-1 flex flex-col">
      {/* Header bar — wordmark monospace */}
      <header className="border-b border-[color:var(--line)]">
        <div className="mx-auto max-w-6xl px-6 py-5 flex items-center justify-between">
          <Wordmark />
          <nav className="flex items-center gap-6 text-[13px] font-[family-name:var(--font-geist-mono)] text-[color:var(--muted)]">
            <Link
              href="/login"
              className="hover:text-[color:var(--ink)] transition"
            >
              connexion
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-3 py-1.5 hairline rounded-full hover:bg-[color:var(--accent-soft)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] transition"
            >
              <Dot />
              créer un compte
            </Link>
          </nav>
        </div>
      </header>

      <section className="flex-1 mx-auto max-w-6xl w-full px-6 py-16 sm:py-24 grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-14 items-start">
        {/* Headline column */}
        <div className="md:col-span-7 fade-up">
          <p className="small-caps text-[11px] text-[color:var(--muted)] font-[family-name:var(--font-geist-mono)]">
            № 001 — chiffrement bout en bout
          </p>
          <h1 className="mt-5 font-[family-name:var(--font-instrument-serif)] text-[clamp(2.75rem,7vw,5.5rem)] leading-[0.95] tracking-tight text-[color:var(--ink)]">
            Une conversation
            <br />
            <em className="italic text-[color:var(--accent)]">scellée</em> entre
            <br />
            deux personnes.
          </h1>
          <p className="mt-8 max-w-xl text-[color:var(--ink-soft)] text-[17px] leading-relaxed">
            Vos messages sont chiffrés sur votre appareil avant de quitter le
            réseau. Le serveur ne voit que du ciphertext — illisible sans la clé
            qui ne quitte jamais votre navigateur.
          </p>

          <div
            className="mt-10 flex flex-col sm:flex-row gap-3 fade-up"
            style={{ animationDelay: '120ms' }}
          >
            <Link
              href="/signup"
              className="group inline-flex items-center justify-center gap-3 rounded-full bg-[color:var(--accent)] px-6 py-3 text-[14px] font-medium text-[color:var(--accent-ink)] hover:opacity-90 transition"
            >
              <span>Ouvrir un compte</span>
              <Arrow />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-full hairline px-6 py-3 text-[14px] font-medium text-[color:var(--ink)] hover:border-[color:var(--ink)] transition"
            >
              J’ai déjà un compte
            </Link>
          </div>

          <div
            className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] font-[family-name:var(--font-geist-mono)] text-[color:var(--muted)] fade-up"
            style={{ animationDelay: '220ms' }}
          >
            <Tag>ecdh · p-256</Tag>
            <Tag>aes-gcm · 256</Tag>
            <Tag>pbkdf2 · 600 000</Tag>
            <Tag>realtime · supabase</Tag>
          </div>
        </div>

        {/* Visual column — "Wax seal" / cipher card */}
        <div
          className="md:col-span-5 fade-up"
          style={{ animationDelay: '60ms' }}
        >
          <SealCard />
        </div>
      </section>

      <section className="border-t border-[color:var(--line)]">
        <div className="mx-auto max-w-6xl px-6 py-14 grid grid-cols-1 md:grid-cols-3 gap-10">
          <Feature
            number="01"
            title="Zéro-connaissance"
            body="Votre clé privée est dérivée de votre mot de passe et chiffrée localement. Elle ne quitte jamais le navigateur en clair, jamais."
          />
          <Feature
            number="02"
            title="Temps réel"
            body="Les messages arrivent instantanément via Supabase Realtime — chiffrés en transit, chiffrés au repos, illisibles côté serveur."
          />
          <Feature
            number="03"
            title="Multiplateforme"
            body="PWA installable sur ordinateur et mobile. Pas d’app store, pas de tracking, pas de tiers entre vous deux."
          />
        </div>
      </section>

      <footer className="border-t border-[color:var(--line)]">
        <div className="mx-auto max-w-6xl px-6 py-6 flex items-center justify-between text-[11px] font-[family-name:var(--font-geist-mono)] text-[color:var(--muted)]">
          <span>secure / chat — confidentialité de bout en bout</span>
          <span className="flex items-center gap-2">
            <Dot />
            session locale uniquement
          </span>
        </div>
      </footer>
    </main>
  );
}

function Wordmark() {
  return (
    <Link href="/" className="group inline-flex items-center gap-2.5">
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
        <circle cx="12" cy="15.5" r="1.2" fill="currentColor" stroke="none" />
      </svg>
      <span className="font-[family-name:var(--font-geist-mono)] text-[13px] tracking-[0.12em] uppercase text-[color:var(--ink)]">
        secure<span className="text-[color:var(--muted)]"> / </span>chat
      </span>
    </Link>
  );
}

function Dot() {
  return (
    <span className="size-1.5 rounded-full bg-[color:var(--accent)] inline-block" />
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-1 rounded-full bg-[color:var(--accent)]" />
      {children}
    </span>
  );
}

function Arrow() {
  return (
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
  );
}

function Feature({
  number,
  title,
  body,
}: {
  number: string;
  title: string;
  body: string;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-3 mb-3">
        <span className="font-[family-name:var(--font-geist-mono)] text-[11px] text-[color:var(--muted)] tabular">
          {number}
        </span>
        <span className="h-px flex-1 bg-[color:var(--line)] translate-y-1" />
      </div>
      <h3 className="font-[family-name:var(--font-instrument-serif)] text-2xl tracking-tight text-[color:var(--ink)]">
        {title}
      </h3>
      <p className="mt-2 text-[14px] leading-relaxed text-[color:var(--ink-soft)]">
        {body}
      </p>
    </div>
  );
}

function SealCard() {
  return (
    <div className="relative">
      <div
        className="absolute -inset-3 rounded-2xl pointer-events-none opacity-50"
        style={{
          background:
            'radial-gradient(60% 60% at 50% 40%, var(--accent-soft), transparent 70%)',
        }}
      />
      <div className="relative rounded-2xl hairline bg-[color:var(--surface)] p-6 shadow-[0_0_0_1px_var(--line),0_30px_60px_-30px_rgba(0,0,0,0.25)]">
        <div className="flex items-center justify-between text-[10px] font-[family-name:var(--font-geist-mono)] text-[color:var(--muted)] uppercase tracking-[0.18em]">
          <span>session · alice → bob</span>
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-[color:var(--accent)] animate-pulse" />
            live
          </span>
        </div>

        <div className="mt-5 space-y-2.5">
          <Bubble side="them">Le contrat est prêt à signer.</Bubble>
          <Bubble side="me">Parfait. Je te l’envoie en chiffré.</Bubble>
          <Bubble side="them">
            <span className="font-[family-name:var(--font-geist-mono)] text-[11px]">
              7gQ3 · L0pXn · 2eKf · vT9w · Mc1Z
            </span>
          </Bubble>
          <Bubble side="me">Reçu et déchiffré. ✓</Bubble>
        </div>

        <div className="mt-6 pt-4 border-t border-[color:var(--line)] flex items-center justify-between text-[10px] font-[family-name:var(--font-geist-mono)] text-[color:var(--muted)]">
          <span>iv · 7b32f1c0…</span>
          <span>aes-gcm-256</span>
        </div>
      </div>
    </div>
  );
}

function Bubble({
  children,
  side,
}: {
  children: React.ReactNode;
  side: 'me' | 'them';
}) {
  const isMe = side === 'me';
  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-[13px] leading-snug ${
          isMe
            ? 'bg-[color:var(--accent)] text-[color:var(--accent-ink)] rounded-br-sm'
            : 'bg-[color:var(--bg-elev)] text-[color:var(--ink)] hairline rounded-bl-sm'
        }`}
      >
        {children}
      </div>
    </div>
  );
}
