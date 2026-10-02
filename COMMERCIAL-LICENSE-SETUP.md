# Commercial licensing setup

1. In Supabase SQL Editor, run `supabase/commercial-license-upgrade.sql`.
2. Sign in as the AFKProbably admin and open `/admin.html`. Set the Monthly and Lifetime commercial prices in the new Commercial Licensing section.
3. Keep Stripe in test mode while testing. Monthly checkout uses a recurring Stripe subscription; Lifetime uses a one-time payment.
4. Customers must sign in with their AFKProbably account before commercial checkout so the license stays attached to their account email.
5. For customer self-service subscription management, enable/configure the Stripe Billing customer portal in Stripe.
6. Optional but recommended: configure a Stripe webhook to `/api/stripe-webhook` and store its signing secret in Cloudflare as `STRIPE_WEBHOOK_SECRET`. The site also refreshes monthly subscription status directly from Stripe when a signed-in customer opens the Commercial page.

The public homepage remains unchanged while `SHOP_LIVE` is false.
