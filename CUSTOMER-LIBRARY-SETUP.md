# Customer Library setup

1. In Supabase -> SQL Editor, run `supabase/customer-library-upgrade.sql`.
2. Deploy the updated site/Worker.
3. Open `/library.html`. Customers can create an account or sign in with the same email used at Stripe Checkout.
4. Paid orders are matched to the authenticated email and shown in My Library with fresh 10-minute signed download links.

No new Cloudflare secrets are required beyond the Stripe/Supabase server secrets already configured.
