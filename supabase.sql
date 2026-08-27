-- قاعدة البيانات الخاصة بمشروع عقارات غرب عمّان
-- نفّذ هذا الملف في Supabase SQL Editor مرة واحدة.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'admin' check (role in ('owner','admin')),
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.areas (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null default 'شقة',
  owner_name text default '',
  area text default '',
  address text default '',
  property_type text default 'شقة',
  status text not null default 'متاحة',
  price numeric default 0,
  rooms integer default 0,
  bathrooms integer default 0,
  salon text default 'لا',
  balcony text default 'لا',
  size numeric default 0,
  description text default '',
  start_date date,
  end_date date,
  available_date date,
  alert_days integer default 7,
  whatsapp text default '',
  images jsonb not null default '[]'::jsonb,
  video_url text default '',
  primary_image text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text default '',
  id_number text default '',
  property_id uuid references public.properties(id) on delete set null,
  contract_id uuid,
  notes text default '',
  created_at timestamptz not null default now()
);

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete set null,
  tenant_id uuid references public.tenants(id) on delete set null,
  start_date date,
  end_date date,
  rent numeric default 0,
  deposit numeric default 0,
  notes text default '',
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  sender_name text default '',
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.search_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  label text not null,
  query jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.areas enable row level security;
alter table public.properties enable row level security;
alter table public.tenants enable row level security;
alter table public.contracts enable row level security;
alter table public.messages enable row level security;
alter table public.search_history enable row level security;

-- المستخدم المسجل يستطيع قراءة وكتابة بيانات النظام.
-- عدّل السياسات لاحقاً إذا أردت صلاحيات أكثر تشدداً حسب كل دور.
drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read" on public.profiles for select to authenticated using (id=auth.uid());

drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles for update to authenticated using (id=auth.uid());

drop policy if exists "areas auth all" on public.areas;
create policy "areas auth all" on public.areas for all to authenticated using (true) with check (true);

drop policy if exists "properties auth all" on public.properties;
create policy "properties auth all" on public.properties for all to authenticated using (true) with check (true);

drop policy if exists "tenants auth all" on public.tenants;
create policy "tenants auth all" on public.tenants for all to authenticated using (true) with check (true);

drop policy if exists "contracts auth all" on public.contracts;
create policy "contracts auth all" on public.contracts for all to authenticated using (true) with check (true);

drop policy if exists "messages auth all" on public.messages;
create policy "messages auth all" on public.messages for all to authenticated using (true) with check (true);

drop policy if exists "search history own" on public.search_history;
create policy "search history own" on public.search_history for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

-- التخزين: bucket عام للصور والفيديو لتظهر الروابط مباشرة.
insert into storage.buckets (id,name,public) values ('property-media','property-media',true)
on conflict (id) do update set public=true;

drop policy if exists "media auth insert" on storage.objects;
create policy "media auth insert" on storage.objects for insert to authenticated with check (bucket_id='property-media');

drop policy if exists "media auth update" on storage.objects;
create policy "media auth update" on storage.objects for update to authenticated using (bucket_id='property-media');

drop policy if exists "media auth delete" on storage.objects;
create policy "media auth delete" on storage.objects for delete to authenticated using (bucket_id='property-media');

drop policy if exists "media public read" on storage.objects;
create policy "media public read" on storage.objects for select to public using (bucket_id='property-media');

-- بعد إنشاء حساب المالك من Authentication > Users،
-- أضف صفه إلى profiles:
-- insert into public.profiles(id,full_name,role) values ('USER_UUID','المالك','owner');