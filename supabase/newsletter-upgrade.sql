-- AFKProbably optional marketing email list
-- Run this once in Supabase SQL Editor.
-- The signup checkbox is optional and unchecked by default.

create extension if not exists pgcrypto;

create table if not exists public.newsletter_subscribers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  subscribed boolean not null default false,
  subscribed_at timestamptz,
  unsubscribed_at timestamptz,
  unsubscribe_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists newsletter_subscribers_active_idx
  on public.newsletter_subscribers (subscribed, subscribed_at desc);

create index if not exists newsletter_subscribers_email_lower_idx
  on public.newsletter_subscribers (lower(email));

alter table public.newsletter_subscribers enable row level security;

-- A signed-in customer may read their own preference.
drop policy if exists "customer read own newsletter preference" on public.newsletter_subscribers;
create policy "customer read own newsletter preference"
on public.newsletter_subscribers
for select to authenticated
using (
  auth.uid() = user_id
  or lower(coalesce(auth.jwt() ->> 'email','')) = 'admin@afkprobably.com'
);

-- Only the admin may directly edit rows from the dashboard.
drop policy if exists "admin update newsletter subscribers" on public.newsletter_subscribers;
create policy "admin update newsletter subscribers"
on public.newsletter_subscribers
for update to authenticated
using (lower(coalesce(auth.jwt() ->> 'email','')) = 'admin@afkprobably.com')
with check (lower(coalesce(auth.jwt() ->> 'email','')) = 'admin@afkprobably.com');

-- Create/update a subscriber row when an auth account is created.
-- Signup metadata contains marketing_opt_in from the optional checkbox.
create or replace function public.handle_new_newsletter_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  opted_in boolean := false;
begin
  begin
    opted_in := coalesce((new.raw_user_meta_data ->> 'marketing_opt_in')::boolean, false);
  exception when others then
    opted_in := false;
  end;

  insert into public.newsletter_subscribers (
    user_id,
    email,
    subscribed,
    subscribed_at,
    unsubscribed_at,
    updated_at
  ) values (
    new.id,
    coalesce(new.email, ''),
    opted_in,
    case when opted_in then now() else null end,
    case when opted_in then null else now() end,
    now()
  )
  on conflict (user_id) do update set
    email = excluded.email,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_newsletter on auth.users;
create trigger on_auth_user_created_newsletter
after insert on auth.users
for each row execute procedure public.handle_new_newsletter_user();

-- Add rows for accounts that already existed before this upgrade.
insert into public.newsletter_subscribers (
  user_id,
  email,
  subscribed,
  subscribed_at,
  unsubscribed_at
)
select
  id,
  coalesce(email, ''),
  false,
  null,
  now()
from auth.users
on conflict (user_id) do update set
  email = excluded.email,
  updated_at = now();

-- Signed-in customers use this function to change their own preference.
create or replace function public.set_newsletter_preference(desired boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  account_email text;
begin
  if uid is null then
    raise exception 'You must be signed in.';
  end if;

  select email into account_email
  from auth.users
  where id = uid;

  insert into public.newsletter_subscribers (
    user_id,
    email,
    subscribed,
    subscribed_at,
    unsubscribed_at,
    updated_at
  ) values (
    uid,
    coalesce(account_email, ''),
    desired,
    case when desired then now() else null end,
    case when desired then null else now() end,
    now()
  )
  on conflict (user_id) do update set
    email = excluded.email,
    subscribed = desired,
    subscribed_at = case
      when desired and not public.newsletter_subscribers.subscribed then now()
      when desired then public.newsletter_subscribers.subscribed_at
      else public.newsletter_subscribers.subscribed_at
    end,
    unsubscribed_at = case when desired then null else now() end,
    updated_at = now();

  return desired;
end;
$$;

revoke all on function public.set_newsletter_preference(boolean) from public;
grant execute on function public.set_newsletter_preference(boolean) to authenticated;

-- Token-based unsubscribe endpoint for links in future promotional emails.
create or replace function public.unsubscribe_marketing(token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_count integer;
begin
  update public.newsletter_subscribers
  set
    subscribed = false,
    unsubscribed_at = now(),
    updated_at = now()
  where unsubscribe_token = token
    and subscribed = true;

  get diagnostics changed_count = row_count;
  return changed_count > 0;
end;
$$;

revoke all on function public.unsubscribe_marketing(uuid) from public;
grant execute on function public.unsubscribe_marketing(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
