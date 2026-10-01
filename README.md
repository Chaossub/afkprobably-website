# afkprobably-website
AFKProbably website

## Private 3D shop development
The public Coming Soon page remains live. See `SHOP-SETUP.md` for the hidden admin/shop-preview setup.

## Hidden customer shop build

The public homepage remains the Coming Soon page while `SHOP_LIVE=false` in Cloudflare runtime variables.

Private admin preview routes:
- `/shop.html`
- `/product.html?id=<product uuid>`
- `/licenses.html`
- `/commissions.html`

When `SHOP_LIVE=false`, these customer-facing routes only load for the signed-in admin account. Run `supabase/customer-shop-upgrade.sql` once before testing the commission request form.

For launch, update the customer-page robots directives and set the Cloudflare runtime `SHOP_LIVE` value to `true` only after the catalog, licensing, commission terms, Stripe live keys, and legal pages are ready.
