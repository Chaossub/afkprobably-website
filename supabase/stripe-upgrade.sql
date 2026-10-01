-- AFKProbably Stripe checkout upgrade
-- Run this once in Supabase > SQL Editor after the original schema.sql.

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  stripe_checkout_session_id text not null unique,
  stripe_payment_intent_id text,
  product_id uuid not null references public.products(id) on delete restrict,
  license_type text not null check (license_type in ('personal','commercial')),
  amount_total_cents integer,
  customer_email text,
  payment_status text not null default 'paid',
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'orders' and policyname = 'authenticated read orders'
  ) then
    create policy "authenticated read orders"
      on public.orders for select to authenticated using (true);
  end if;
end $$;
