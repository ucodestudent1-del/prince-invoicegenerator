# Cron Job Setup

This document describes the background jobs required for the application and how to configure them.

## Overview

Several features rely on background jobs that must be triggered by an external scheduler (cron). These endpoints now require API key authentication via the `x-api-key` header.

## Required Environment Variable

Set the following in your production environment:

```bash
BACKGROUND_JOB_API_KEY=generate_with_openssl_rand_hex_32
```

Generate a secure key:
```bash
openssl rand -hex 32
```

## Background Job Endpoints

| Endpoint | Purpose | Frequency |
|----------|---------|-----------|
| `/api/automation?steps=recurring` | Generate recurring invoices from configurations | Daily at midnight |
| `/api/automation?steps=scheduled,late-fees` | Send scheduled invoices, apply late fees | Hourly |
| `/api/reminders/check` | Send automatic payment reminders (tiered escalation: pre-due, due-date, post-due at 1/7/14/30 days) | Every 15 minutes |
| `/api/invoices/scheduled` | Process scheduled invoices (alternative, per-step) | Hourly |
| `/api/invoices/recurring/generate` | Generate recurring invoices (alternative, per-step) | Daily at midnight |
| `/api/late-fees/apply` | Apply late fees (alternative, per-step) | Hourly |
| `/api/estimates/check-expiration` | Transition expired estimates (past `validUntil`) to `EXPIRED` status | Daily at midnight |

## Cron Configuration Examples

### Option 1: Single automation endpoint (recommended)

```bash
# Run ALL background jobs every hour (scheduled invoices + late fees)
0 * * * * curl -X GET "https://your-app.com/api/automation?steps=scheduled,late-fees" -H "x-api-key: $BACKGROUND_JOB_API_KEY"

# Generate recurring invoices daily at midnight
0 0 * * * curl -X GET "https://your-app.com/api/automation?steps=recurring" -H "x-api-key: $BACKGROUND_JOB_API_KEY"

# Check for payment reminders every 15 minutes
*/15 * * * * curl -X GET "https://your-app.com/api/reminders/check" -H "x-api-key: $BACKGROUND_JOB_API_KEY"

# Check for expired estimates daily at midnight
0 0 * * * curl -X POST "https://your-app.com/api/estimates/check-expiration" -H "x-api-key: $BACKGROUND_JOB_API_KEY"
```

### Option 2: Individual endpoints (more granular control)

```bash
# Process scheduled invoices hourly
0 * * * * curl -X GET "https://your-app.com/api/invoices/scheduled" -H "x-api-key: $BACKGROUND_JOB_API_KEY"

# Generate recurring invoices daily at midnight
0 0 * * * curl -X GET "https://your-app.com/api/invoices/recurring/generate" -H "x-api-key: $BACKGROUND_JOB_API_KEY"

# Apply late fees hourly
0 * * * * curl -X GET "https://your-app.com/api/late-fees/apply" -H "x-api-key: $BACKGROUND_JOB_API_KEY"

# Check reminders every 15 minutes
*/15 * * * * curl -X GET "https://your-app.com/api/reminders/check" -H "x-api-key: $BACKGROUND_JOB_API_KEY"

# Check for expired estimates daily at midnight
0 0 * * * curl -X POST "https://your-app.com/api/estimates/check-expiration" -H "x-api-key: $BACKGROUND_JOB_API_KEY"
```

## Using with Popular Cron Providers

### GitHub Actions

```yaml
# .github/workflows/cron.yml
name: Background Jobs
on:
  schedule:
    - cron: "0 * * * *"    # Every hour
    - cron: "0 0 * * *"    # Daily at midnight
    - cron: "*/15 * * * *" # Every 15 minutes
jobs:
  run-automation:
    runs-on: ubuntu-latest
    steps:
      - name: Run scheduled + late fees
        run: curl -X GET "https://your-app.com/api/automation?steps=scheduled,late-fees" -H "x-api-key: ${{ secrets.BACKGROUND_JOB_API_KEY }}"
      - name: Check reminders
        run: curl -X GET "https://your-app.com/api/reminders/check" -H "x-api-key: ${{ secrets.BACKGROUND_JOB_API_KEY }}"
      - name: Generate recurring invoices (daily)
        run: curl -X GET "https://your-app.com/api/automation?steps=recurring" -H "x-api-key: ${{ secrets.BACKGROUND_JOB_API_KEY }}"
```

### Vercel Cron Jobs (v0.1.0+)

```jsonc
// vercel.json
{
  "crons": [
    {
      "path": "/api/automation?steps=scheduled,late-fees",
      "schedule": "0 * * * *",
      "method": "GET",
      "headers": {
        "x-api-key": process.env.BACKGROUND_JOB_API_KEY
      }
    }
  ]
}
```

> **Note:** Vercel's built-in cron support does not natively support custom headers. Wrap the cron in a Vercel Function:
> ```ts
> // pages/api/cron-wrapper.ts
> export default async function handler(req, res) {
>   const apiKey = process.env.BACKGROUND_JOB_API_KEY;
>   const r = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/automation?steps=scheduled,late-fees`, {
>     headers: { "x-api-key": apiKey },
>   });
>   const data = await r.json();
>   res.status(200).json(data);
> }
> ```

### Railway / Render

Use their built-in cron task features and set `BACKGROUND_JOB_API_KEY` as an environment variable.

## Monitoring

All background job endpoints return structured JSON responses:

**Success (200):**
```json
{ "success": true, "results": [...] }
```

**Unauthorized (401):**
```
Unauthorized
```

**Error (500):**
```json
{ "error": "error message" }
```

## Health Check

Check `/api/health` to verify database connectivity and overall application health.
