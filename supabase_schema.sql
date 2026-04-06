-- ============================================================
-- Luna AI — Supabase Schema (safe to re-run)
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Profiles table (extends Supabase Auth users)
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  name            text not null default '',
  dob             text not null default '',
  coins           integer not null default 5,
  last_free_claim text not null default ''
);

-- 2. Messages table
create table if not exists public.messages (
  id         bigserial primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       text not null,
  content    text not null,
  persona    text not null default 'luna',
  created_at timestamptz not null default now()
);

-- 3. Enable Row-Level Security
alter table public.profiles enable row level security;
alter table public.messages  enable row level security;

-- 4. Drop existing policies first (safe to re-run)
drop policy if exists "Users can view own profile"   on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can view own messages"  on public.messages;
drop policy if exists "Users can insert own messages" on public.messages;
drop policy if exists "Users can delete own messages" on public.messages;

-- 5. Recreate RLS Policies for profiles
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- 6. Recreate RLS Policies for messages
create policy "Users can view own messages"
  on public.messages for select
  using (auth.uid() = user_id);

create policy "Users can insert own messages"
  on public.messages for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own messages"
  on public.messages for delete
  using (auth.uid() = user_id);

-- Done! ✅
