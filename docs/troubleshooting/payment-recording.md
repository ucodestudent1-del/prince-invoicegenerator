# Payment Recording Error Diagnostic Guide

## Quick Diagnosis

Check these in order. Most payment recording failures are caused by the first two items.

| Priority | Check | How to Verify |
|----------|-------|---------------|
| 1 | Database schema drift | `npx prisma migrate status` |
| 2 | Missing env vars | App startup logs / Railway variables |
| 3 | Auth/session issues | Browser devtools → Network → `/api/invoices/[id]/payments` |
| 4 | Database connectivity | Railway Postgres service status |
| 5 | Transaction conflicts | Retry the request; check for concurrent edits |

---

## 1. Database Schema Drift

### Symptom
```
ERROR: type "public.PaymentMethod" does not exist
ERROR: type "public.PaymentStatus" does not exist
ConnectorError(QueryError(PostgresError { code: "42704" ... }))
```

### Why it happens
The Prisma schema defines `Payment.method` as `PaymentMethod` enum and `Payment.status` as `PaymentStatus` enum, but the database is missing those types. This occurs when:
- Migrations were not applied to the production database
- The database was recreated/reset without running migrations
- A migration that should have created the enums was skipped or failed silently

### Diagnostic steps
```bash
# Check migration status
npx prisma migrate status

# Verify enums exist (run via psql or Prisma db execute)
SELECT typname FROM pg_type WHERE typname IN ('PaymentMethod', 'PaymentStatus');

# Verify column types
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_name = 'Payment' AND column_name IN ('method', 'status');
```

Expected result:
- `PaymentMethod` and `PaymentStatus` types should exist
- `Payment.method` should be `USER-DEFINED` with `udt_name = PaymentMethod`
- `Payment.status` should be `USER-DEFINED` with `udt_name = PaymentStatus`

### Fix
```bash
# Apply pending migrations
npx prisma migrate deploy
```

If migrations fail due to duplicate/failed records, see [0005 migration history fix](#migration-history-fix).

---

## 2. Missing Production Environment Variables

### Symptom
```
[env] Production environment variables not set: BACKGROUND_JOB_API_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_STARTER_MONTHLY, STRIPE_PRICE_PRO_MONTHLY, STRIPE_PRICE_BUSINESS_MONTHLY
```

### Why it happens
The `validateEnv()` function in `src/lib/errors.ts` warns when these production-only variables are missing. While it does not block requests, it can cause:
- Background job auth to reject requests
- Stripe webhook verification to fail with `Missing signature`
- Pricing/plan lookups to return empty strings

### Diagnostic steps
```bash
# Check Railway variables
railway variables --service kind-acceptance

# Check in-app
# Open /api/health or any server-rendered page and inspect server logs
```

### Fix
```bash
railway variable set BACKGROUND_JOB_API_KEY="dev-placeholder" --service kind-acceptance --skip-deploys
railway variable set STRIPE_WEBHOOK_SECRET="dev-placeholder" --service kind-acceptance --skip-deploys
railway variable set STRIPE_PRICE_STARTER_MONTHLY="dev-placeholder" --service kind-acceptance --skip-deploys
railway variable set STRIPE_PRICE_PRO_MONTHLY="dev-placeholder" --service kind-acceptance --skip-deploys
railway variable set STRIPE_PRICE_BUSINESS_MONTHLY="dev-placeholder" --service kind-acceptance --skip-deploys
```

---

## 3. Invoice Number Unique Constraint Violation

### Symptom
```
ERROR: duplicate key value violates unique constraint "Invoice_orgId_number_key"
DETAIL: Key ("orgId", number)=(cms52qs3n0005go1tblyvvwvj, INV-2026-000123) already exists.
```

### Why it happens
Invoice numbers are generated per-org using a max-based lookup (`getNextInvoiceNumber`). This error occurs when:
- Two users create invoices simultaneously (race condition)
- An invoice was deleted and the next number collides with an existing one
- The numbering helper is bypassed (custom invoice number already exists)

### Diagnostic steps
```bash
# Check existing invoices for the org
SELECT id, number, "orgId", status FROM "Invoice"
WHERE "orgId" = '<org-id>' ORDER BY number DESC LIMIT 10;

# Check for gaps or duplicates
SELECT number, COUNT(*)
FROM "Invoice"
WHERE "orgId" = '<org-id>'
GROUP BY number HAVING COUNT(*) > 1;
```

### Fix
The codebase includes retry logic in `src/lib/actions/invoices.ts:108-159` and `src/lib/actions/recurring.ts` that retries up to 3 times with a fresh number on unique constraint failure. If this error is still surfacing:
1. Verify the retry block is intact in `recordPayment` callers
2. Check for custom invoice numbers being submitted that already exist
3. Consider adding a database sequence per org for atomic numbering

---

## 4. Authentication / Authorization Failures

### Symptom
```
401 Unauthorized
403 Forbidden
Redirect to /login?error=session
```

### Why it happens
- Session cookie expired or missing
- `requireUser()` in `src/lib/org.ts:30-36` cannot find a valid NextAuth session
- CSRF token mismatch on POST requests

### Diagnostic steps
1. Open browser devtools → Application → Cookies
2. Verify `next-auth.session-token` or `__Secure-next-auth.session-token` exists
3. Check Network tab for the `/api/invoices/[id]/payments` request:
   - Status code
   - Request headers (Cookie, CSRF token)
   - Response body

### Fix
- Clear cookies and re-authenticate
- Verify `NEXTAUTH_SECRET` and `NEXTAUTH_URL` are set in production
- Check that the session is not expired (default: 30 days)

---

## 5. Database Connectivity

### Symptom
```
P1001: Can't reach database server at postgres.railway.internal:5432
Error: connect ECONNREFUSED
```

### Why it happens
- Railway Postgres service is down or restarting
- Network partition between app and database
- Connection pool exhaustion (too many concurrent requests)

### Diagnostic steps
```bash
# Check Railway service status
railway status

# Test connectivity via TCP proxy
railway connect Postgres

# Check active connections (in psql)
SELECT count(*) FROM pg_stat_activity WHERE datname = 'railway';
```

### Fix
- Redeploy if the Postgres service is unresponsive: `railway redeploy --service kind-acceptance`
- Check connection pool settings in Prisma (default: 5)
- Monitor Railway metrics for connection saturation

---

## 6. Transaction Deadlocks / Conflicts

### Symptom
```
Error: P2034: Transaction failed due to a conflict or deadlock
```

### Why it happens
The `recordPayment` function runs a transaction that touches `Payment`, `Invoice`, and `InvoiceAudit` tables. Concurrent payment recordings on the same invoice can cause row-level locks to conflict.

### Diagnostic steps
```sql
-- Check for blocked queries
SELECT * FROM pg_locks WHERE NOT granted;

-- Check for deadlock logs
SELECT * FROM pg_stat_database WHERE datname = 'railway';
```

### Fix
The `withRetry` wrapper in `src/lib/db.ts` retries on transient Prisma errors. Verify it is applied to the `recordPayment` call path. If not, wrap the API route handler or client call with `withRetry`.

---

## 7. Insufficient Permissions

### Symptom
```
ERROR: permission denied for table Payment
```

### Why it happens
The database user does not have INSERT/UPDATE permissions on the `Payment` or `Invoice` tables. This can happen after:
- Database role changes
- Schema migration errors that left permissions in an inconsistent state

### Diagnostic steps
```sql
-- Check table permissions
SELECT grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_name IN ('Payment', 'Invoice', 'InvoiceAudit')
  AND grantee = 'postgres';
```

### Fix
```sql
GRANT INSERT, UPDATE, SELECT ON "Payment", "Invoice", "InvoiceAudit" TO postgres;
```

---

## 8. Payment Amount Edge Cases

### Symptom
```
Payment amount exceeds remaining balance of X.XX.
```

### Why it happens
- Floating point rounding: `amountPaid + new_payment > total` by 0.01 due to precision
- Invoice was modified (total changed) after the form was rendered
- Multiple partial payments in rapid succession

### Diagnostic steps
1. Check the invoice's current `total` and `amountPaid` in the database
2. Compare with the amount submitted in the request payload
3. Look for concurrent payment recordings in `InvoiceAudit`

### Fix
The codebase already includes a `+ 0.01` tolerance on the client and server. If errors persist:
- Consider rounding all amounts to 2 decimal places before comparison
- Re-fetch the invoice inside the transaction rather than using a stale read

---

## Log Files to Inspect

| Log Source | What to Look For | How to Access |
|------------|------------------|---------------|
| **Next.js server logs** | Stack traces, `[recordPayment]` errors | `railway logs --service kind-acceptance` |
| **Prisma query logs** | Failed SQL statements | Enable with `DATABASE_LOG_QUERIES=true` |
| **PostgreSQL logs** | Constraint violations, deadlocks, enum errors | `railway logs --service Postgres` |
| **InvoiceAudit table** | Successful payment records | `SELECT * FROM "InvoiceAudit" WHERE action = 'PAYMENT_RECORDED' ORDER BY createdAt DESC LIMIT 20;` |
| **Browser Network tab** | Request/response payloads, status codes | DevTools → Network |

---

## Step-by-Step Reproduction

1. **Identify the failing request**
   ```bash
   railway logs --service kind-acceptance | grep -i "recordPayment\|payments"
   ```

2. **Check the database state**
   ```sql
   -- Does the invoice exist?
   SELECT id, number, total, amountPaid, status FROM "Invoice" WHERE id = '<invoice-id>';

   -- Do the enums exist?
   SELECT typname FROM pg_type WHERE typname IN ('PaymentMethod', 'PaymentStatus');
   ```

3. **Reproduce manually**
   ```bash
   curl -X POST https://princeinvoicegenerator.up.railway.app/api/invoices/<id>/payments \
     -H "Content-Type: application/json" \
     -d '{"amount": 100.00, "method": "CASH"}'
   ```

4. **Apply the fix** based on the diagnosis above

5. **Verify**
   ```bash
   # Confirm the payment was recorded
   SELECT * FROM "Payment" WHERE "invoiceId" = '<invoice-id>' ORDER BY createdAt DESC LIMIT 5;

   # Confirm the invoice was updated
   SELECT id, total, amountPaid, status FROM "Invoice" WHERE id = '<invoice-id>';
   ```

---

## Common Fixes Summary

| Error | Root Cause | Fix |
|-------|-----------|-----|
| `type "public.PaymentMethod" does not exist` | Missing enum in DB | `npx prisma migrate deploy` |
| `duplicate key value violates unique constraint "Invoice_orgId_number_key"` | Race condition or stale count | Use max-based numbering + retry (already implemented) |
| `[env] Production environment variables not set` | Missing Railway vars | Set via `railway variable set` |
| `ReferenceError: File is not defined` | `instanceof File` in Node runtime | Duck-type check instead (fixed in `05ed797`) |
| `P1001: Can't reach database server` | Railway Postgres down | `railway redeploy` or wait for recovery |
| `permission denied for table Payment` | DB role permissions | `GRANT INSERT, UPDATE, SELECT` |
| `Transaction failed due to a conflict` | Concurrent payments | Ensure `withRetry` wraps the call path |
