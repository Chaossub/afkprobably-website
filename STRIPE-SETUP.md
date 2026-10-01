# AFKProbably Stripe test setup

The public homepage stays unchanged. The checkout buttons only appear in the authenticated private shop preview.

## 1) Add the orders table
In Supabase > SQL Editor, run:

`supabase/stripe-upgrade.sql`

## 2) Add two Cloudflare secrets
Open Cloudflare > Workers & Pages > afkprobably-website > Settings > Variables and Secrets.

Add these as **encrypted secrets** (never put them in GitHub):

- `STRIPE_SECRET_KEY` — use your Stripe **test mode** secret key (`sk_test_...`) while testing.
- `SUPABASE_SERVICE_ROLE_KEY` — use the Supabase **service_role** server key. Never use this in browser JavaScript.

The non-secret Supabase project URL, publishable key, admin email, and `SHOP_LIVE=false` are already in `wrangler.jsonc`.

## 3) Optional but recommended: Stripe webhook
After deployment, create a Stripe webhook endpoint:

`https://afkprobably.com/api/stripe-webhook`

Subscribe it to:

`checkout.session.completed`

Copy the webhook signing secret (`whsec_...`) into Cloudflare as another encrypted secret:

- `STRIPE_WEBHOOK_SECRET`

The success page also verifies payment directly with Stripe, so you can test checkout before setting up the webhook. The webhook makes order recording more reliable if a buyer closes the browser after payment.

## 4) Deploy
Commit/push the new files. Cloudflare will deploy the Worker plus static site together.

## 5) Test privately
Sign in at `/admin.html`, add a price of at least **$0.50**, attach an STL/3MF/ZIP, then open **Private Shop Preview**.

Choose Personal or Commercial and click the test checkout button. In Stripe test mode, use Stripe's standard test card `4242 4242 4242 4242`, any future expiration date, and any CVC.

After payment, Stripe redirects to `/checkout-success.html`, where the Worker verifies that the session is paid and creates a temporary Supabase signed download link.

## Launch safety
Keep both of these false until launch:

- `SHOP_LIVE: false` in `config.js`
- `SHOP_LIVE: "false"` in `wrangler.jsonc`

While false, checkout creation requires the authenticated Supabase account matching `admin@afkprobably.com`. The public homepage remains the Coming Soon page.
