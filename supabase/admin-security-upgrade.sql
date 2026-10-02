-- AFKProbably admin security upgrade
-- Run this after enabling customer accounts / My Library.
-- It prevents ordinary customer accounts from editing products or reading private mesh storage.

-- Product tables: remove broad authenticated access and allow only the admin email.
drop policy if exists "authenticated products" on public.products;
drop policy if exists "authenticated product images" on public.product_images;
drop policy if exists "authenticated product files" on public.product_files;

create policy "admin products" on public.products
for all to authenticated
using (lower(coalesce(auth.jwt() ->> 'email','')) = 'admin@afkprobably.com')
with check (lower(coalesce(auth.jwt() ->> 'email','')) = 'admin@afkprobably.com');

create policy "admin product images" on public.product_images
for all to authenticated
using (lower(coalesce(auth.jwt() ->> 'email','')) = 'admin@afkprobably.com')
with check (lower(coalesce(auth.jwt() ->> 'email','')) = 'admin@afkprobably.com');

create policy "admin product files" on public.product_files
for all to authenticated
using (lower(coalesce(auth.jwt() ->> 'email','')) = 'admin@afkprobably.com')
with check (lower(coalesce(auth.jwt() ->> 'email','')) = 'admin@afkprobably.com');

-- Storage: customers must never be able to browse/download private mesh files directly.
drop policy if exists "authenticated upload product images" on storage.objects;
drop policy if exists "authenticated update product images" on storage.objects;
drop policy if exists "authenticated delete product images" on storage.objects;
drop policy if exists "authenticated upload mesh files" on storage.objects;
drop policy if exists "authenticated read mesh files" on storage.objects;
drop policy if exists "authenticated update mesh files" on storage.objects;
drop policy if exists "authenticated delete mesh files" on storage.objects;

create policy "admin upload product images" on storage.objects
for insert to authenticated
with check (bucket_id = 'product-images' and lower(coalesce(auth.jwt() ->> 'email','')) = 'admin@afkprobably.com');
create policy "admin update product images" on storage.objects
for update to authenticated
using (bucket_id = 'product-images' and lower(coalesce(auth.jwt() ->> 'email','')) = 'admin@afkprobably.com')
with check (bucket_id = 'product-images' and lower(coalesce(auth.jwt() ->> 'email','')) = 'admin@afkprobably.com');
create policy "admin delete product images" on storage.objects
for delete to authenticated
using (bucket_id = 'product-images' and lower(coalesce(auth.jwt() ->> 'email','')) = 'admin@afkprobably.com');

create policy "admin upload mesh files" on storage.objects
for insert to authenticated
with check (bucket_id = 'mesh-files' and lower(coalesce(auth.jwt() ->> 'email','')) = 'admin@afkprobably.com');
create policy "admin read mesh files" on storage.objects
for select to authenticated
using (bucket_id = 'mesh-files' and lower(coalesce(auth.jwt() ->> 'email','')) = 'admin@afkprobably.com');
create policy "admin update mesh files" on storage.objects
for update to authenticated
using (bucket_id = 'mesh-files' and lower(coalesce(auth.jwt() ->> 'email','')) = 'admin@afkprobably.com')
with check (bucket_id = 'mesh-files' and lower(coalesce(auth.jwt() ->> 'email','')) = 'admin@afkprobably.com');
create policy "admin delete mesh files" on storage.objects
for delete to authenticated
using (bucket_id = 'mesh-files' and lower(coalesce(auth.jwt() ->> 'email','')) = 'admin@afkprobably.com');

-- Commission dashboard: only admin can read/update requests directly.
drop policy if exists "authenticated read commissions" on public.commission_requests;
drop policy if exists "authenticated update commissions" on public.commission_requests;

create policy "admin read commissions" on public.commission_requests
for select to authenticated
using (lower(coalesce(auth.jwt() ->> 'email','')) = 'admin@afkprobably.com');
create policy "admin update commissions" on public.commission_requests
for update to authenticated
using (lower(coalesce(auth.jwt() ->> 'email','')) = 'admin@afkprobably.com')
with check (lower(coalesce(auth.jwt() ->> 'email','')) = 'admin@afkprobably.com');
