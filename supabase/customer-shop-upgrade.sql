-- AFKProbably customer-shop upgrade
-- Run once in Supabase > SQL Editor before testing commissions.

create table if not exists public.commission_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  project_type text not null,
  budget text,
  desired_deadline date,
  reference_links text,
  description text not null,
  status text not null default 'new' check (status in ('new','reviewing','quoted','accepted','declined','completed')),
  created_at timestamptz not null default now()
);

alter table public.commission_requests enable row level security;

-- Admin can review requests from the authenticated Supabase dashboard/client.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'commission_requests' and policyname = 'authenticated read commissions'
  ) then
    create policy "authenticated read commissions"
      on public.commission_requests for select to authenticated using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'commission_requests' and policyname = 'authenticated update commissions'
  ) then
    create policy "authenticated update commissions"
      on public.commission_requests for update to authenticated using (true) with check (true);
  end if;
end $$;
