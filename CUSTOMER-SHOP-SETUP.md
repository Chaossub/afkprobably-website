# AFKProbably customer shop preview

The public homepage is still unchanged.

## Before testing commissions
Run `supabase/customer-shop-upgrade.sql` in Supabase SQL Editor.

## Preview
Sign in at `/admin.html`, then open **Private Shop Preview**. The new customer storefront is `/shop.html`.

The following pages are admin-only while Cloudflare runtime `SHOP_LIVE=false`:
- `/shop.html`
- `/product.html?id=...`
- `/licenses.html`
- `/commissions.html`

## Launch later
Do not flip `SHOP_LIVE` to `true` yet. Before launch:
1. Replace Stripe test secret with the live secret.
2. Review licensing and Terms of Use.
3. Decide whether to enable Stripe Tax.
4. Remove `noindex,nofollow` from customer-facing shop pages.
5. Set Cloudflare runtime `SHOP_LIVE=true`.
6. Add links from the public homepage/navigation.
