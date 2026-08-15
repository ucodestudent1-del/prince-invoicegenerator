# Railway Deployment Checklist

## Required Environment Variables

Set all of these in your Railway project → [Service] → Settings → Variables:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string from Railway's PostgreSQL plugin |
| `NEXTAUTH_URL` | Yes | Your Railway app's public URL (e.g. `https://app-name.up.railway.app`) |
| `NEXTAUTH_SECRET` | Yes | Random string: `openssl rand -base64 32` |
| `AUTH_TRUST_HOST` | Yes | Set to `true` (trusts Railway's reverse proxy host header) |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret |
| `STRIPE_PRICE_STARTER_MONTHLY` | Yes | Stripe price ID for Starter plan |
| `STRIPE_PRICE_PRO_MONTHLY` | Yes | Stripe price ID for Pro plan |
| `STRIPE_PRICE_BUSINESS_MONTHLY` | Yes | Stripe price ID for Business plan |
| `BACKGROUND_JOB_API_KEY` | Yes | Random key for cron jobs: `openssl rand -hex 32` |
| `R2_ACCOUNT_ID` | Yes | Cloudflare R2 account ID |
| `R2_ACCESS_KEY_ID` | Yes | Cloudflare R2 access key |
| `R2_SECRET_ACCESS_KEY` | Yes | Cloudflare R2 secret key |
| `R2_BUCKET` | Yes | Cloudflare R2 bucket name |
| `R2_PUBLIC_URL` | Yes | Public R2 CDN URL (e.g. `https://hash.r2.dev`) |
| `NEXT_PUBLIC_APP_URL` | No | Your public app URL (defaults to `NEXTAUTH_URL`) |
| `NEXT_PUBLIC_APP_NAME` | No | App name "Prince" |
| `APP_NAME` | No | App name "Prince" |

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your OAuth 2.0 Client ID
3. Add **Authorized JavaScript origins**:
   - `https://your-app.up.railway.app`
4. Add **Authorized redirect URIs**:
   - `https://your-app.up.railway.app/api/auth/callback/google`

⚠️ Replace `your-app.up.railway.app` with your actual Railway URL.

## Common Issues

### 404 on login
- Ensure `NEXTAUTH_URL` is set to your Railway domain
- Ensure `NEXTAUTH_SECRET` is set
- Ensure `AUTH_TRUST_HOST=true`
- Verify Google OAuth redirect URI matches your domain

### Auth session not persisting
- Ensure `DATABASE_URL` is pointed to the Railway PostgreSQL instance
- Check that the Prisma migration ran successfully (`railway.json` runs this automatically via `preDeployCommand`)

### Stripe webhook not working
- Set `STRIPE_WEBHOOK_SECRET` to the webhook endpoint signing secret
- Add the Railway URL to Stripe's webhook endpoints: `https://your-app.up.railway.app/api/stripe/webhook`
