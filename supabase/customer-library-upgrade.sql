-- AFKProbably customer library security upgrade
-- Orders are accessed by the Cloudflare Worker using the server-side Supabase secret.
-- Customers should not be able to query the entire orders table directly from the browser.

drop policy if exists "authenticated read orders" on public.orders;

create index if not exists orders_customer_email_lower_idx
  on public.orders (lower(customer_email));

create index if not exists orders_product_license_idx
  on public.orders (product_id, license_type);
