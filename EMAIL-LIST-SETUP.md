# AFKProbably Email List Setup

This update adds an optional marketing-email checkbox during account creation, a customer preference toggle in My Library, an admin subscriber list, CSV export, and token-based unsubscribe support.

## 1. Run the SQL upgrade

Open **Supabase → SQL Editor**, paste the contents of:

`supabase/newsletter-upgrade.sql`

and run it once.

The checkbox is unchecked by default. Existing customer accounts are added as **not subscribed** so nobody is opted in retroactively.

## 2. Deploy the updated files

Deploy the full site, including:

- `library.html` / `library.js`
- `admin.html` / `admin.js`
- `shop.css` / `admin.css`
- `privacy.html`
- `unsubscribe.html` / `unsubscribe.js`
- `supabase/newsletter-upgrade.sql`

## 3. Using the list

The Admin Dashboard now has **Print alert subscribers**. You can copy the current opted-in addresses or download them as a CSV for an email platform.

For promotional campaigns, use a bulk-email provider that supports unsubscribe handling and suppression lists. Do not use the subscriber list for receipts, commission updates, password resets, or other necessary transactional messages.

## 4. Unsubscribe links

The database creates a private `unsubscribe_token` for each account. A future custom campaign sender can create links in this form:

`https://afkprobably.com/unsubscribe.html?token=SUBSCRIBER_TOKEN`

If you import the CSV into a provider such as Mailchimp, Brevo, ConvertKit, or a broadcast-email service, use that provider's built-in unsubscribe footer as well.
