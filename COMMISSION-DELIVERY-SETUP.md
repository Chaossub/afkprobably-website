# Commission delivery setup

The Admin commissions panel can now upload finished commission files and email secure download links to the customer.

## One-time setup

1. Open Supabase > SQL Editor.
2. Run `supabase/commission-delivery-upgrade.sql`.
3. Deploy the updated site/Worker.
4. Keep the existing `mesh-files` bucket private. Commission deliveries use that same private bucket.
5. Make sure your existing commission email settings are configured (`RESEND_API_KEY`, `COMMISSION_FROM_EMAIL`, and `COMMISSION_EMAIL`).

## Using it

1. Open Admin > Commissions.
2. Find the finished commission.
3. Under **Deliver Finished Commission**, choose one or more files.
4. Add an optional delivery note.
5. Click **Upload & email finished commission**.

The customer receives a persistent delivery URL for each file. When they click it, the Worker creates a fresh short-lived Supabase signed download, so the private storage URL itself is never permanently exposed.

After a successful delivery, the commission is automatically marked `completed`. The admin card also shows whether each delivery has been emailed and whether it has been downloaded at least once.
