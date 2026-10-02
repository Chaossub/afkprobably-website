-- AFKProbably shop-wide commercial licensing
create table if not exists public.commercial_license_plans (
  plan_type text primary key check (plan_type in ('monthly','lifetime')),
  price_cents integer check (price_cents is null or price_cents >= 50),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.commercial_license_plans (plan_type, price_cents, active) values
  ('monthly', null, true),
  ('lifetime', null, true)
on conflict (plan_type) do nothing;

create table if not exists public.commercial_licenses (
  id uuid primary key default gen_random_uuid(),
  customer_email text not null,
  plan_type text not null check (plan_type in ('monthly','lifetime')),
  stripe_checkout_session_id text not null unique,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  status text not null default 'active',
  current_period_end bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists commercial_licenses_email_idx on public.commercial_licenses (lower(customer_email));

alter table public.commercial_license_plans enable row level security;
alter table public.commercial_licenses enable row level security;

drop policy if exists "admin read commercial plans" on public.commercial_license_plans;
drop policy if exists "admin update commercial plans" on public.commercial_license_plans;
drop policy if exists "admin insert commercial plans" on public.commercial_license_plans;
create policy "admin read commercial plans" on public.commercial_license_plans for select to authenticated using (lower(auth.jwt()->>'email') = 'admin@afkprobably.com');
create policy "admin update commercial plans" on public.commercial_license_plans for update to authenticated using (lower(auth.jwt()->>'email') = 'admin@afkprobably.com') with check (lower(auth.jwt()->>'email') = 'admin@afkprobably.com');
create policy "admin insert commercial plans" on public.commercial_license_plans for insert to authenticated with check (lower(auth.jwt()->>'email') = 'admin@afkprobably.com');

-- Commercial license records are server-managed only.
revoke all on public.commercial_licenses from anon, authenticated;
