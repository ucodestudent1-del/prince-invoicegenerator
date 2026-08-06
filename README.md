# Prince — Construction Invoice Generator

A subscription-based invoicing web app for construction contractors.

## Tech stack

- **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Next.js API routes, Prisma ORM
- **Database:** PostgreSQL
- **Auth:** Auth.js (NextAuth) with Prisma adapter
- **Payments:** Stripe (subscriptions + billing portal)
- **Storage:** Cloudflare R2 (S3-compatible) for photo attachments
- **PDF:** Print-friendly invoice view (`/dashboard/invoices/[id]/print`)

## Subscription tiers

| Plan       | Price    | Highlights                                                       |
|------------|----------|------------------------------------------------------------------|
| Free       | $0       | 5 invoices/month, basic templates, PDF export                    |
| Starter    | $15–25   | Unlimited invoices, branding, estimates, customer DB             |
| Pro        | $39–59   | Progress invoices, change orders, retainage, recurring, expenses, photos |
| Business   | $79–149  | Multiple users, project management, subcontractor tracking, reports |

## Getting started

```bash
npm install
cp .env.example .env   # fill in secrets
npx prisma migrate dev
npm run dev
```

## Scripts

- `npm run dev` — start dev server
- `npm run build` — build (runs `prisma generate`)
- `npm run typecheck` — tsc --noEmit
- `npm run db:studio` — Prisma Studio

## Environment

See `.env.example` for every required variable (database, Auth.js, Stripe, R2).

> **Auth.js note:** this project uses **NextAuth v4**, which reads `NEXTAUTH_SECRET` and
> `NEXTAUTH_URL` (not `AUTH_SECRET`). Set both in every environment. In production the dev
> email login is disabled, so at least one OAuth provider (GitHub or Google) must be configured
> or no one can sign in.

## Deploy to Railway (full integrations)

The repo ships with `railway.json`. Railway builds with `npm run build`, runs
`npx prisma migrate deploy` as a pre-deploy step, then starts with `npm run start`.

1. **Create the project:** New Project → Deploy from GitHub repo → select this repo.
2. **Add PostgreSQL:** add the Railway PostgreSQL plugin and copy its `DATABASE_URL` into the
   app service variables.
3. **Set environment variables** (app service → Variables):
   - `DATABASE_URL` — from the Postgres plugin
   - `NEXT_PUBLIC_APP_URL` and `NEXTAUTH_URL` — your public origin, e.g.
     `https://<app>.up.railway.app`
   - `NEXTAUTH_SECRET` — `openssl rand -base64 32`
   - `GITHUB_ID`, `GITHUB_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and the six `STRIPE_PRICE_*` IDs
   - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`
4. **OAuth callback URLs:**
   - GitHub: `https://<domain>/api/auth/callback/github`
   - Google: `https://<domain>/api/auth/callback/google`
5. **Stripe webhook:** endpoint `https://<domain>/api/stripe/webhook`; subscribe to
   `checkout.session.completed` and `customer.subscription.created|updated|deleted`. Put the
   signing secret in `STRIPE_WEBHOOK_SECRET`.
6. **Cloudflare R2:** create a bucket, enable public access (or attach a custom domain), and set
   `R2_PUBLIC_URL` to that public read URL — not the `*.r2.cloudflarestorage.com` API endpoint.
7. **Deploy.** The pre-deploy step applies `prisma/migrations`. Then visit the site, sign in via
   OAuth, and run a Stripe test checkout + a photo upload to verify the integrations.
