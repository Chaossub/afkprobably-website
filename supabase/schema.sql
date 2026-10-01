-- AFKProbably 3D shop foundation
-- Run this once in Supabase > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  category text,
  description text,
  print_notes text,
  personal_price_cents integer check (personal_price_cents is null or personal_price_cents >= 0),
  commercial_price_cents integer check (commercial_price_cents is null or commercial_price_cents >= 0),
  status text not null default 'draft' check (status in ('draft','published','hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null,
  public_url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.product_files (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null,
  original_name text not null,
  file_size bigint,
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_files enable row level security;

-- During private development, only authenticated users can read/write catalog data.
create policy "authenticated products" on public.products for all to authenticated using (true) with check (true);
create policy "authenticated product images" on public.product_images for all to authenticated using (true) with check (true);
create policy "authenticated product files" on public.product_files for all to authenticated using (true) with check (true);

-- Public product images bucket (safe to display on product cards).
insert into storage.buckets (id, name, public)
values ('product-images','product-images',true)
on conflict (id) do update set public = excluded.public;

-- Paid mesh files stay private. Never make this bucket public.
insert into storage.buckets (id, name, public)
values ('mesh-files','mesh-files',false)
on conflict (id) do update set public = excluded.public;

create policy "authenticated upload product images" on storage.objects
for insert to authenticated with check (bucket_id = 'product-images');
create policy "authenticated update product images" on storage.objects
for update to authenticated using (bucket_id = 'product-images') with check (bucket_id = 'product-images');
create policy "authenticated delete product images" on storage.objects
for delete to authenticated using (bucket_id = 'product-images');

create policy "authenticated upload mesh files" on storage.objects
for insert to authenticated with check (bucket_id = 'mesh-files');
create policy "authenticated read mesh files" on storage.objects
for select to authenticated using (bucket_id = 'mesh-files');
create policy "authenticated update mesh files" on storage.objects
for update to authenticated using (bucket_id = 'mesh-files') with check (bucket_id = 'mesh-files');
create policy "authenticated delete mesh files" on storage.objects
for delete to authenticated using (bucket_id = 'mesh-files');
