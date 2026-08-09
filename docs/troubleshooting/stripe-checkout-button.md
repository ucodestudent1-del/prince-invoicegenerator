# Stripe Checkout Button Failure Troubleshooting Guide

## Quick Diagnosis

The "Choose Starter" button on the pricing page calls `POST /api/stripe/checkout` and then redirects to `window.location.href = data.url`. If the button fails to redirect, check these in order:

| Priority | Check | How to Verify |
|----------|-------|---------------|
| 1 | Missing/invalid Stripe price IDs | `echo $STRIPE_PRICE_STARTER_MONTHLY` |
| 2 | Missing STRIPE_SECRET_KEY | App startup logs |
| 3 | Auth/session missing | Browser Network tab → `/api/stripe/checkout` |
| 4 | Rate limiting (429) | Railway logs → `Too many requests` |
| 5 | Stripe API 400 error | Stripe Dashboard → Developers → Logs |
| 6 | Client-side JS error | Browser Console |
| 7 | CSP / ad blocker | Browser Console → `Refused to connect` |

---

## 1. Missing or Invalid Stripe Price IDs

### Symptom
- Button shows "Redirecting…" then stops with no action
- Network tab shows `POST /api/stripe/checkout` returning `400` with `{ "error": "Invalid plan" }`
- Server logs may show: `priceId is undefined` or empty string

### Why it happens
The checkout route (`src/app/api/stripe/checkout/route.ts:29-32`) looks up the plan's `stripePriceId`:

```ts
const planDef = getPlan(plan);
const priceId = planDef.stripePriceId;
if (!priceId) {
  return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
}
```

If the environment variables are set to `"dev-placeholder"` or are empty, `priceId` will be falsy and the route returns 400.

### Diagnostic steps
```bash
# Check local .env
cat .env | grep STRIPE_PRICE

# Check Railway variables
railway variables --service kind-acceptance | grep STRIPE_PRICE

# Test the API directly
curl -X POST https://princeinvoicegenerator.up.railway.app/api/stripe/checkout \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN" \
  -d '{"plan":"STARTER"}'
```

Expected response on failure:
```json
{ "error": "Invalid plan" }
```

### Fix
Set real Stripe Price IDs in both local `.env` and Railway:

```bash
# Local .env
STRIPE_PRICE_STARTER_MONTHLY="price_1NqABC..."
STRIPE_PRICE_PRO_MONTHLY="price_1NqDEF..."
STRIPE_PRICE_BUSINESS_MONTHLY="price_1NqGHI..."

# Railway
railway variable set STRIPE_PRICE_STARTER_MONTHLY="price_1NqABC..." --service kind-acceptance --skip-deploys
railway variable set STRIPE_PRICE_PRO_MONTHLY="price_1NqDEF..." --service kind-acceptance --skip-deploys
railway variable set STRIPE_PRICE_BUSINESS_MONTHLY="price_1NqGHI..." --service kind-acceptance --skip-deploys
```

**How to find Price IDs:**
1. Log in to [https://dashboard.stripe.com/prices](https://dashboard.stripe.com/prices)
2. Make sure you're in the correct mode (Live or Test) matching your `STRIPE_SECRET_KEY`
3. Copy the Price ID (starts with `price_`)

---

## 2. Missing or Invalid STRIPE_SECRET_KEY

### Symptom
- Server logs show: `Stripe auth error` or `Invalid API Key`
- Checkout route returns `500` or Stripe throws authentication errors
- All Stripe API calls fail

### Why it happens
The Stripe client is initialized with a fallback placeholder (`src/lib/stripe.ts:3`):

```ts
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder", {
  apiVersion: "2025-02-24.acacia",
  typescript: true,
});
```

If `STRIPE_SECRET_KEY` is missing, the client uses `"sk_test_placeholder"`, which is not a valid Stripe key. All API calls will fail with authentication errors.

### Diagnostic steps
```bash
# Check if the key is set
echo $STRIPE_SECRET_KEY

# Check Railway
railway variables --service kind-acceptance | grep STRIPE_SECRET_KEY
```

### Fix
```bash
# Local .env
STRIPE_SECRET_KEY="sk_live_..."

# Railway
railway variable set STRIPE_SECRET_KEY="sk_live_..." --service kind-acceptance --skip-deploys
```

**Important:** The key mode must match your Price IDs:
- `sk_test_...` → use Test mode prices
- `sk_live_...` → use Live mode prices

---

## 3. Authentication / Session Missing

### Symptom
- Button shows "Redirecting…" then stops
- Network tab shows `POST /api/stripe/checkout` returning `401`
- Client redirects to `/login`

### Why it happens
The checkout route requires a valid NextAuth session (`src/app/api/stripe/checkout/route.ts:18-21`):

```ts
const authSession = await getServerSession(authOptions);
if (!authSession?.user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

If the session cookie is missing, expired, or the user is not logged in, the route returns 401.

### Diagnostic steps
1. Open browser DevTools → Application → Cookies
2. Verify `next-auth.session-token` or `__Secure-next-auth.session-token` exists
3. Check Network tab for the `/api/stripe/checkout` request:
   - Status code: 401?
   - Request headers: Cookie present?
4. Check if `NEXTAUTH_SECRET` and `NEXTAUTH_URL` are set in production

### Fix
- Log in to the app before clicking the button
- Clear cookies and re-authenticate if the session is stale
- Verify `NEXTAUTH_SECRET` and `NEXTAUTH_URL` are set in production

---

## 4. Rate Limiting (429 Too Many Requests)

### Symptom
- Button works once, then fails on subsequent clicks
- Network tab shows `POST /api/stripe/checkout` returning `429`
- Server logs show: `Too many requests`

### Why it happens
The checkout route applies rate limiting (`src/app/api/stripe/checkout/route.ts:13-16`):

```ts
const limit = rateLimit(req);
if (!limit.ok) {
  return NextResponse.json({ error: "Too many requests" }, { status: 429 });
}
```

The rate limiter (`src/lib/rate-limit.ts`) allows 20 requests per minute per IP+path. Exceeding this returns 429.

**Critical bug:** The client (`src/components/pricing-checkout.tsx`) only handles 401 and 400 errors. A 429 response falls through to the `finally` block, which resets the loading state but shows no error message to the user.

### Diagnostic steps
```bash
# Check server logs for rate limit messages
railway logs --service kind-acceptance | grep "Too many requests"
```

### Fix
The current client code needs to handle 429:

```tsx
// In src/components/pricing-checkout.tsx
if (res.status === 401 || res.status === 400) {
  router.push("/login");
  return;
}
if (res.status === 429) {
  setError("Too many requests. Please wait a moment and try again.");
  return;
}
```

---

## 5. Stripe API 400 Error (Malformed Request)

### Symptom
- Network tab shows `POST /api/stripe/checkout` returning `400` from Stripe
- Response headers include Stripe request ID: `req_BS10GS1HviB5sq`
- Response body may be empty or show Stripe error

### Why it happens
Stripe returns 400 when the Checkout Session creation fails. Common causes:

| Cause | Example |
|-------|---------|
| Invalid price ID | Price doesn't exist in the Stripe account |
| Price is inactive | Price was archived in Stripe Dashboard |
| Missing customer email | `user.email` is null and Stripe requires it |
| Invalid currency | `invoice.currency.toLowerCase()` produces unsupported currency |
| Invalid success/cancel URL | URL is malformed or not HTTPS in live mode |

### Diagnostic steps
1. **Check Stripe Dashboard → Developers → Logs**
   - Find the request by ID (`req_BS10GS1HviB5sq`)
   - Read the exact error message

2. **Common error patterns:**
   - `No such price: price_...` → Price ID doesn't exist
   - `Price is inactive` → Price was archived
   - `Invalid email` → User has no email in auth profile

### Fix
- Verify Price IDs exist and are active in Stripe Dashboard
- Ensure `NEXT_PUBLIC_APP_URL` is set correctly (must be HTTPS in live mode)
- Check that authenticated users have email addresses

---

## 6. Organization Missing

### Symptom
- Network tab shows `POST /api/stripe/checkout` returning `400` with `{ "error": "No organization" }`
- User is logged in but has no organization

### Why it happens
The checkout route requires `user.organizationId` (`src/app/api/stripe/checkout/route.ts:23-25`):

```ts
if (!user.organizationId) {
  return NextResponse.json({ error: "No organization" }, { status: 400 });
}
```

If the user hasn't created or joined an organization, the checkout fails.

### Diagnostic steps
1. Check the user's session: does it include `organizationId`?
2. Check the database: does the user have an organization?

### Fix
- Create or join an organization before upgrading
- Ensure the auth flow sets `organizationId` on the user

---

## 7. Client-Side JavaScript Errors

### Symptom
- Button click does nothing
- Browser Console shows red errors
- Network tab shows no request to `/api/stripe/checkout`

### Why it happens
Common client-side issues:

| Error | Cause |
|-------|-------|
| `fetch is not defined` | Running in a non-browser environment (shouldn't happen with `"use client"`) |
| `window is not defined` | SSR/SSG mismatch |
| `Cannot read properties of undefined` | `planId` prop is missing or malformed |
| `TypeError: Failed to fetch` | Network error, CORS, or offline |

### Diagnostic steps
1. Open browser DevTools → Console
2. Click the "Choose Starter" button
3. Look for red errors

### Fix
- Ensure `PricingCheckout` receives a valid `planId` prop
- Check for CORS issues (shouldn't occur with same-origin API routes)
- Verify the app is fully loaded before interacting

---

## 8. Content Security Policy (CSP) Blocking Stripe

### Symptom
- Browser Console shows: `Refused to connect to 'https://checkout.stripe.com' because it violates the following Content Security Policy directive: "frame-src 'self'"`

### Why it happens
The CSP in `next.config.mjs` controls which origins can be connected to or framed:

```js
{
  key: "Content-Security-Policy",
  value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.stripe.com https://*.r2.cloudflarestorage.com https://*.r2.dev; frame-src 'self' https://*.stripe.com;",
}
```

This app uses **redirect-based checkout** (not embedded), so CSP is less likely to block the redirect itself. However:

- If you ever switch to Stripe Elements/embedded Checkout, `frame-src` must include `https://*.stripe.com`
- If you use Stripe.js directly, `script-src` must include `https://*.stripe.com`
- `connect-src` already includes `https://*.stripe.com` for API calls

### Diagnostic steps
1. Open browser DevTools → Console
2. Look for `Content Security Policy` errors
3. Check Network tab → click the `/api/stripe/checkout` request → look for CSP violations

### Fix
The current CSP is already configured for redirect-based checkout. If switching to embedded checkout:

```js
{
  key: "Content-Security-Policy",
  value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.stripe.com https://*.r2.cloudflarestorage.com https://*.r2.dev; frame-src 'self' https://*.stripe.com https://checkout.stripe.com;",
}
```

---

## 9. Ad Blockers / Browser Extensions

### Symptom
- Button click does nothing
- Network tab shows the request is blocked before it leaves the browser
- No request appears in server logs

### Why it happens
Some ad blockers or privacy extensions block requests to `stripe.com` domains. Since this app uses redirect-based checkout (not embedded), this is less common, but extensions may still interfere with:

- The `fetch` call to `/api/stripe/checkout` if the extension modifies request headers
- The `window.location.href` redirect if the extension blocks navigation to `checkout.stripe.com`

### Diagnostic steps
1. Open an Incognito/Private window with extensions disabled
2. Try the checkout flow again
3. If it works, enable extensions one by one to find the culprit

### Fix
- Disable the offending extension for your domain
- Add an exception for your domain in the ad blocker
- No code changes needed — this is a user-side issue

---

## 10. NEXT_PUBLIC_APP_URL Misconfigured

### Symptom
- Stripe Checkout loads but shows an error or blank page
- Success/cancel redirects go to the wrong domain
- Server logs show malformed URLs

### Why it happens
The checkout route uses `NEXT_PUBLIC_APP_URL` to build `success_url` and `cancel_url` (`src/app/api/stripe/checkout/route.ts:56-57`):

```ts
success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?success=1`,
cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
```

If this variable is:
- Missing → falls back to `http://localhost:3000` (wrong in production)
- Set to `http://` in live mode → Stripe rejects non-HTTPS URLs
- Set to the wrong domain → user redirects to the wrong site

### Diagnostic steps
```bash
# Check the variable
echo $NEXT_PUBLIC_APP_URL

# Check Railway
railway variables --service kind-acceptance | grep NEXT_PUBLIC_APP_URL
```

### Fix
```bash
# Production
NEXT_PUBLIC_APP_URL="https://princeinvoicegenerator.up.railway.app"

# Local development
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

---

## 11. No User Feedback on Failure

### Symptom
- Button shows "Redirecting…" then stops
- No error message is shown
- User doesn't know what went wrong

### Why it happens
The `PricingCheckout` component (`src/components/pricing-checkout.tsx`) has minimal error handling:

```tsx
async function handleCheckout() {
  setLoading(true);
  try {
    const res = await fetch("/api/stripe/checkout", { ... });
    if (res.status === 401 || res.status === 400) {
      router.push("/login");
      return;
    }
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    }
  } finally {
    setLoading(false);
  }
}
```

Issues:
- **429 (rate limit)** is not handled → user sees nothing
- **500 (server error)** is not handled → user sees nothing
- **Network failure** is not handled → user sees nothing
- **No `data.url`** (empty response) → user sees nothing
- **Non-JSON response** → `res.json()` throws, caught by... nothing (no catch block)

### Fix
Add proper error handling:

```tsx
async function handleCheckout() {
  setLoading(true);
  setError(null);
  try {
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: planId }),
    });
    
    if (res.status === 401 || res.status === 400) {
      router.push("/login");
      return;
    }
    
    if (res.status === 429) {
      setError("Too many requests. Please wait a moment and try again.");
      return;
    }
    
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || `Checkout failed (${res.status})`);
      return;
    }
    
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      setError("No checkout URL returned. Please try again.");
    }
  } catch (err) {
    setError("Network error. Please check your connection and try again.");
  } finally {
    setLoading(false);
  }
}
```

---

## 12. Success/Cancel URL Not Handled

### Symptom
- User completes payment on Stripe Checkout
- Redirects back to `/dashboard/billing?success=1`
- But no confirmation message or UI update is shown

### Why it happens
The `success_url` includes `?success=1`, but this query parameter is never read anywhere in the codebase. The billing page (`src/app/dashboard/billing/page.tsx`) renders the `BillingPanel` without checking for success state.

### Fix
Add success state handling to the billing page or create a toast notification that reads the query parameter.

---

## Checklist: Complete Debug Flow

1. **Open browser DevTools** → Console + Network tabs
2. **Click "Choose Starter"** button
3. **Check Network tab:**
   - Is `POST /api/stripe/checkout` sent?
   - What is the status code?
   - What is the response body?
4. **Check Console:**
   - Any red errors?
   - Any CSP violations?
5. **Check server logs:**
   ```bash
   railway logs --service kind-acceptance | tail -50
   ```
6. **Check Stripe Dashboard:**
   - Go to Developers → Logs
   - Find the request by ID
   - Read the exact Stripe error
7. **Verify environment variables:**
   ```bash
   # Local
   cat .env | grep STRIPE
   
   # Railway
   railway variables --service kind-acceptance | grep STRIPE
   ```
8. **Verify Price IDs:**
   - Log in to Stripe Dashboard
   - Go to Prices
   - Confirm the IDs match your env vars
   - Confirm prices are active (not archived)

---

## Common Error Codes and Fixes

| Error | Status | Cause | Fix |
|-------|--------|-------|-----|
| `Invalid plan` | 400 | `stripePriceId` is missing or empty | Set real Price IDs in env vars |
| `No organization` | 400 | User has no `organizationId` | Create/join an organization |
| `Unauthorized` | 401 | No valid NextAuth session | Log in |
| `Too many requests` | 429 | Rate limit exceeded (20/min) | Wait 1 minute, add 429 handling |
| Stripe `No such price` | 400 | Price ID doesn't exist | Create price in Stripe Dashboard |
| Stripe `Price is inactive` | 400 | Price was archived | Reactivate or create new price |
| Stripe `Invalid API Key` | 401 | Wrong/missing `STRIPE_SECRET_KEY` | Set correct secret key |
| `Refused to connect` | — | CSP blocking Stripe | Update CSP headers |
| No request sent | — | Client JS error | Check Console for errors |

---

## Files to Inspect

| File | What to Check |
|------|---------------|
| `src/components/pricing-checkout.tsx` | Client-side checkout handler, error handling |
| `src/app/api/stripe/checkout/route.ts` | Server-side checkout session creation |
| `src/lib/stripe.ts` | Stripe client initialization, price mappings |
| `src/lib/plans.ts` | Plan definitions, `stripePriceId` values |
| `src/lib/rate-limit.ts` | Rate limiting logic |
| `next.config.mjs` | CSP headers |
| `.env` | Local environment variables |
| Railway variables | Production environment variables |
