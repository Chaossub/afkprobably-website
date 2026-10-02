# AFKProbably final pre-launch checklist

This build keeps the public homepage on **Online Shop Coming Soon** while `SHOP_LIVE` is `false`.

## Supabase SQL
Run these in Supabase SQL Editor if you have not already run them:

1. `supabase/schema.sql`
2. `supabase/stripe-upgrade.sql`
3. `supabase/customer-shop-upgrade.sql`
4. `supabase/customer-library-upgrade.sql`
5. `supabase/admin-security-upgrade.sql`
6. `supabase/commercial-license-upgrade.sql`

## Cloudflare runtime variables / secrets
These belong in the Worker's runtime Variables and Secrets section:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (Secret)
- `STRIPE_SECRET_KEY` (Secret)
- `ADMIN_EMAIL=admin@afkprobably.com`
- `SHOP_LIVE=false`

Optional but recommended before launch:

- `STRIPE_WEBHOOK_SECRET` (Secret) for `/api/stripe-webhook`

## Admin setup
Sign in through **My Library** with `admin@afkprobably.com`, then open `/admin.html` directly.

In Admin you can:

- create/edit mesh listings
- upload product images
- upload private STL/3MF/ZIP files
- set the personal-use mesh price
- set Monthly Commercial and Lifetime Commercial plan prices
- show/hide each commercial plan
- review commission requests

## Commercial licensing
Commercial licensing is shop-wide for meshes owned by that customer account:

- **Monthly Commercial** uses a Stripe subscription and is valid while the subscription remains active.
- **Lifetime Commercial** is a one-time Stripe payment and does not expire unless the license is terminated under the terms.
- A commercial license does not unlock mesh files. Customers still purchase each mesh separately.
- Digital mesh redistribution/resale/sharing is not allowed.

For customer subscription management, enable the Stripe Billing customer portal before launch.

## Before going live
Keep `SHOP_LIVE=false` while testing. Test all of these in Stripe test mode:

- mesh purchase -> payment -> secure download
- My Library re-download
- Monthly Commercial checkout
- Lifetime Commercial checkout
- Commercial status page
- Monthly subscription management portal
- commission form

When everything is ready, switch Cloudflare `SHOP_LIVE` to `true` and redeploy.
