-- West Amman Property Manager / Supabase schema v16
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null default '',
  role text not null default 'admin' check (role in ('owner','admin')),
  permissions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_state (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.app_state enable row level security;

create or replace function public.is_owner()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'owner');
$$;

create or replace function public.is_member()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists(select 1 from public.profiles where id = auth.uid());
$$;

revoke all on function public.is_owner() from public;
grant execute on function public.is_owner() to authenticated;
revoke all on function public.is_member() from public;
grant execute on function public.is_member() to authenticated;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated" on public.profiles
for select to authenticated
using (auth.uid() = id or public.is_owner());

drop policy if exists "profiles_owner_write" on public.profiles;
create policy "profiles_owner_write" on public.profiles
for all to authenticated
using (auth.uid() = id or public.is_owner())
with check (auth.uid() = id or public.is_owner());

drop policy if exists "app_state_authenticated" on public.app_state;
create policy "app_state_authenticated" on public.app_state
for all to authenticated
using (public.is_member())
with check (public.is_member());

insert into storage.buckets (id,name,public)
values ('property-images','property-images',true)
on conflict (id) do nothing;

-- After creating the first owner in Authentication > Users, copy its UUID and run:
-- insert into public.profiles(id,name,email,role,permissions)
-- values (
--   'AUTH_USER_UUID',
--   'المالك',
--   'YOUR_EMAIL',
--   'owner',
--   '["dashboard","properties","tenants","reports","settings","admins","messages"]'::jsonb
-- )
-- on conflict (id) do update set
--   role=excluded.role, name=excluded.name, email=excluded.email,
--   permissions=excluded.permissions;
