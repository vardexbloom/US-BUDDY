-- Your AI: schema + row-level security. Every table is private to its owner.
create extension if not exists pgcrypto;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text, goals text, timezone text,
  style text not null default 'balanced' check (style in ('concise','balanced','detailed')),
  quiet_start time not null default '22:00', quiet_end time not null default '07:00',
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  content text not null check (char_length(content) <= 500),
  active boolean not null default true,
  source text not null default 'user' check (source in ('user','onboarding','ai_approved')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null, notes text,
  use_as_context boolean not null default true, done boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null, body text not null,
  feedback text check (feedback in ('useful','unhelpful')),
  dismissed boolean not null default false,
  created_at timestamptz not null default now()
);
-- Append-only audit trail: users can read and add rows, never edit or delete.
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  action text not null, detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
-- Approval bound to the exact payload. Execute only if sha256(payload) = approved_hash.
create table public.pending_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null check (type in ('send_message','read_data')),
  payload jsonb not null, payload_hash text not null,
  status text not null default 'pending' check (status in ('pending','approved','cancelled','executed')),
  approved_hash text, created_at timestamptz not null default now()
);

do $$ declare t text; begin
  foreach t in array array['profiles','memories','tasks','notifications','pending_actions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "owner_all" on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;
alter table public.activity_logs enable row level security;
create policy "owner_read" on public.activity_logs for select to authenticated using (auth.uid() = user_id);
create policy "owner_insert" on public.activity_logs for insert to authenticated with check (auth.uid() = user_id);

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin insert into public.profiles(user_id) values (new.id); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
