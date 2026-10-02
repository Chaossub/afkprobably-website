-- AFKProbably commission delivery upgrade
-- Run once in Supabase > SQL Editor before using commission file delivery.

create table if not exists public.commission_deliveries (
  id uuid primary key default gen_random_uuid(),
  commission_id uuid not null references public.commission_requests(id) on delete cascade,
  storage_path text not null,
  original_name text not null,
  file_size bigint,
  delivery_token uuid not null default gen_random_uuid() unique,
  emailed_at timestamptz,
  last_downloaded_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists commission_deliveries_commission_idx
  on public.commission_deliveries (commission_id, created_at desc);

create index if not exists commission_deliveries_token_idx
  on public.commission_deliveries (delivery_token);

alter table public.commission_deliveries enable row level security;

drop policy if exists "admin read commission deliveries" on public.commission_deliveries;
create policy "admin read commission deliveries"
  on public.commission_deliveries
  for select
  to authenticated
  using (
    lower(coalesce(auth.jwt() ->> 'email','')) = 'admin@afkprobably.com'
  );

-- Delivery rows are inserted and updated only by the server-side Worker.
-- The commission files themselves use the existing private mesh-files bucket.
