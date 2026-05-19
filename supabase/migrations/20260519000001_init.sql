-- ============================================================================
-- Secure Chat - Schema initial
-- ============================================================================
-- - profiles : profil utilisateur + clé publique ECDH (pour E2E)
-- - conversations : conversation 1-to-1 entre deux utilisateurs
-- - messages : messages chiffrés (ciphertext + IV en base64)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  public_key jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint username_format check (username ~ '^[a-z0-9_]{3,30}$')
);

alter table public.profiles enable row level security;

create policy "profiles_select_all_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

-- ---------------------------------------------------------------------------
-- user_keys : clé privée ECDH chiffrée avec mot de passe (PBKDF2 + AES-GCM)
-- Séparée de profiles car SELECT restreint à l'utilisateur lui-même
-- ---------------------------------------------------------------------------
create table public.user_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  encrypted_private_key text not null,
  iv text not null,
  salt text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_keys enable row level security;

create policy "user_keys_select_own"
  on public.user_keys for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "user_keys_insert_own"
  on public.user_keys for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "user_keys_update_own"
  on public.user_keys for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- conversations (1-to-1)
-- user_a < user_b pour garantir l'unicité d'une conversation entre deux users
-- ---------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint user_a_lt_user_b check (user_a < user_b),
  unique (user_a, user_b)
);

alter table public.conversations enable row level security;

create policy "conversations_select_participants"
  on public.conversations for select
  to authenticated
  using ((select auth.uid()) = user_a or (select auth.uid()) = user_b);

create policy "conversations_insert_participants"
  on public.conversations for insert
  to authenticated
  with check ((select auth.uid()) = user_a or (select auth.uid()) = user_b);

-- ---------------------------------------------------------------------------
-- messages (chiffrés côté client avec AES-GCM)
-- ---------------------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  ciphertext text not null,
  iv text not null,
  created_at timestamptz not null default now()
);

create index messages_conversation_created_idx
  on public.messages (conversation_id, created_at desc);

alter table public.messages enable row level security;

create policy "messages_select_conversation_participants"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and ((select auth.uid()) = c.user_a or (select auth.uid()) = c.user_b)
    )
  );

create policy "messages_insert_self_as_sender"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and ((select auth.uid()) = c.user_a or (select auth.uid()) = c.user_b)
    )
  );

-- ---------------------------------------------------------------------------
-- Trigger : créer un profil automatiquement à la création d'un user
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', 'user_' || substr(new.id::text, 1, 8)),
    coalesce(new.raw_user_meta_data ->> 'display_name', new.email)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Trigger updated_at sur profiles
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Realtime : autoriser la réplication des nouveaux messages
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.messages;
