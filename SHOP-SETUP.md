# AFKProbably private shop setup

The public `index.html` remains the existing "Online Shop Coming Soon" page.
The new shop is hidden behind Supabase Authentication and is not linked from the public landing page.

## Hidden development routes
- `/admin.html` — authenticated product admin
- `/shop-preview.html` — authenticated private catalog preview

Both pages include `noindex,nofollow,noarchive` so search engines are told not to index them.

## Connect Supabase
1. In Supabase, open your project.
2. Go to **Project Settings > API**.
3. Copy the Project URL and anon/public key.
4. Put them in `config.js`.
5. Go to **SQL Editor**, paste the contents of `supabase/schema.sql`, and run it once.
6. Go to **Authentication > Users** and create/invite your admin user.

## Security model
- `product-images` is public because shoppers eventually need to see preview images.
- `mesh-files` is PRIVATE. Do not change it to public.
- During development, catalog database rows require an authenticated Supabase session.
- The future Stripe webhook will verify payment server-side before generating a short-lived signed download URL for the private mesh file.
- `SHOP_LIVE` remains `false` in `config.js`. The public landing page does not use the preview shop yet.

## Next phase
Add Stripe Checkout + orders/purchases + secure signed download delivery + emailed receipt/download link.
