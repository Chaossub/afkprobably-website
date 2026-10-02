# Unified account login

Customers and the admin now use the same Supabase Auth login from `library.html`.

- Customers sign in at **My Library**.
- The admin signs in at **My Library** using `admin@afkprobably.com`, then opens `/admin.html` directly/bookmarks it.
- No Admin tab is shown in customer navigation.
- Non-admin signed-in accounts are blocked from the admin UI.

## Required security step
Run `supabase/admin-security-upgrade.sql` in Supabase SQL Editor before inviting customer accounts.
This replaces the old broad `authenticated` policies with admin-only policies so customer accounts cannot edit products or read the private mesh bucket.


## Password reset

`library.html` now includes a **Forgot password?** flow using Supabase Auth.

In Supabase, make sure your production URL is allowed under **Authentication → URL Configuration**. The reset flow returns to:

`https://afkprobably.com/library.html?reset=1`

If you also test locally or on a preview deployment, add that preview origin/redirect URL to Supabase as well.
