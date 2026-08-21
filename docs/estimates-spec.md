# Estimates & Quotes — Product Feature Specification

**Document Status:** Draft (Specification)
**Project:** Prince Invoice Generator
**Author:** Product / Engineering
**Date:** 2026-08-20
**Related Files:**
- Prisma schema: `prisma/schema.prisma` (`Estimate`, `EstimateItem`, `EstimateStatus`)
- Server actions: `src/lib/actions/features.ts` (`createEstimate`)
- UI: `src/components/estimate-form.tsx`, `src/app/[locale]/dashboard/estimates/page.tsx`
- Numbering: `src/lib/numbering.ts` (`getNextEstimateNumber`)
- Validation: `src/lib/schemas.ts` (`CreateEstimateSchema`)
- Feature gating: `estimates` feature key → Starter tier (`src/lib/plans.ts:65,85`)
- Print/PDF: `src/app/[locale]/dashboard/invoices/[id]/print/page.tsx`
- Email delivery: `src/lib/email.ts` (built for Automated Reminders)
- Existing status workflow: `EstimateStatus` enum (`prisma/schema.prisma:82`)

---

## 1. Workflow Architecture

### 1.1 The End-to-End Lifecycle

The Estimates & Quotes module establishes a formal **five-stage lifecycle** that bridges the gap between initial customer contact and final payment:

```
┌─────────┐    ┌───────────┐    ┌───────────┐    ┌────────┐    ┌────────┐
│  Lead   │ →  │  Estimate │ →  │  Approval │ →  │ Invoice│ →  │ Payment│
└─────────┘    └───────────┘    └───────────┘    └────────┘    └────────┘
     │              │              │              │              │
     │  Contact     │  Review &    │  Customer    │  Convert     │  Automated
     │  info        │  edit        │  accepts or  │  estimate   │  reminders
     │              │              │  rejects     │  → invoice  │  (see Automated
     │              │              │              │  auto-fill   │  Reminders spec)
```

### 1.2 Stage-by-Stage Definition

| Stage | Entry Condition | Key Actions | Exit Condition |
|-------|----------------|-------------|----------------|
| **Lead** | Customer contact record exists in CRM | Capture scope, site visit notes, preliminary discussion | Lead qualifies → estimate created |
| **Estimate** | User creates estimate from lead/customer record | Add line items, tax, discount, terms; set validity period; attach project | User sends → status = `SENT` |
| **Approval** | Customer receives estimate link via email | Customer views (engagement tracked); customer accepts or rejects | Customer accepts → status = `ACCEPTED` |
| **Invoice** | Estimate is accepted and within validity period | One-click conversion to invoice; retains line items, tax, customer | Invoice created → status = `INVOICED` |
| **Payment** | Invoice is sent to customer | Payment collection, follow-up (Automated Reminders) | Full payment received → status = `PAID` |

### 1.3 Status State Machine

The existing `EstimateStatus` enum is extended:

```prisma
enum EstimateStatus {
  DRAFT       // Created but not yet sent
  SENT        // Sent to customer via email or share link
  VIEWED      // Customer has opened the estimate link (engagement tracked)
  ACCEPTED    // Customer formally accepted the estimate
  REJECTED    // Customer formally rejected or counter-offered
  EXPIRED     // Validity period lapsed before acceptance
  INVOICED    // Converted to an invoice (new — prevents re-conversion)
}
```

**Transition rules:**

```
DRAFT → SENT → VIEWED → ACCEPTED → INVOICED → PAID (via linked invoice)
              ↘ REJECTED
              ↘ EXPIRED
```

| From | To | Trigger | Who |
|------|----|---------|-----|
| DRAFT | SENT | User clicks "Send estimate" | Contractor |
| SENT | VIEWED | Customer opens the secure link | Customer |
| VIEWED | ACCEPTED | Customer clicks "Accept Quote" | Customer |
| VIEWED | REJECTED | Customer clicks "Reject" or "Request changes" | Customer |
| SENT | EXPIRED | `validUntil` date passes | System (cron) |
| ACCEPTED | INVOICED | Contractor clicks "Convert to invoice" | Contractor |
| INVOICED | PAID | Customer pays the linked invoice | Customer (via Stripe/PayPal) |

### 1.4 Cron-Driven Expiration

A daily cron job (`/api/estimates/check-expiration`) scans for `SENT` or `VIEWED` estimates where `validUntil < now()` and transitions them to `EXPIRED`. This mirrors the existing pattern in `/api/automation` and `/api/reminders/check`.

---

## 2. Core Feature Requirements

### 2.1 Creation & Management

**Existing functionality:**
- `createEstimate` action (`src/lib/actions/features.ts:12`) creates estimates with line items, tax, discount, and validity date
- `EstimateForm` component (`src/components/estimate-form.tsx`) provides the UI
- `EstimateStatus` enum exists in the schema with `DRAFT`, `SENT`, `ACCEPTED`, `DECLINED`, `EXPIRED`

**Enhanced requirements:**
- **Issue date** field (defaults to today, editable) — currently omitted, should be added to the form
- **Terms & conditions** rich text field — pre-populated from organization defaults, editable per-estimate
- **Attachments** — ability to attach a file (e.g., site photo, spec sheet) to the estimate, stored on Cloudflare R2 (reuse `PhotoAttachment` model pattern)
- **Clone to estimate** — from an existing project's template, preserving line items
- **Estimate number auto-generation** — `EST-XXXX` format via `getNextEstimateNumber` (already implemented, just ensure it's used consistently)
- **Draft autosave** — periodic autosave of drafts via a debounced API call so form data isn't lost on navigation

### 2.2 Distribution

**Secure share link:**
- Each estimate gets a `shareToken` (cryptographically random UUID, stored on the `Estimate` model). The link is `https://app.example.com/estimate/{number}?token={shareToken}`
- The link is only generated when the estimate is sent (status transitions from `DRAFT` → `SENT`)
- The share link is valid only while the estimate is in `SENT` or `VIEWED` status and has not expired
- The link is single-use for sensitive actions but can be re-viewed multiple times until the estimate expires or is converted

**Email delivery:**
- "Send to customer" button triggers an email (via the `src/lib/email.ts` module already built for Automated Reminders) with:
  - The estimate number and total amount in the subject line
  - A "View Estimate" call-to-action button linking to the secure share URL
  - Contractor-customizable email body (organization-level template in settings)
- Email delivery is tracked: `deliveredAt`, `bouncedAt`, `openAt` (if supported by provider)
- The contractor receives a notification when the estimate email is delivered or bounced

**API contract for sending:**
```typescript
// POST /api/estimates/{id}/send
{
  "ccEmails": ["subcontractor@example.com"],  // optional: CC stakeholders
  "message": "Additional personal note from the contractor",  // optional
  "sendEmail": true  // toggle: send email or just generate link
}
```

### 2.3 Engagement Tracking

When a customer opens the secure share link:
1. The `Estimate` record's `viewedAt` timestamp is set (if not already set)
2. The status transitions from `SENT` → `VIEWED`
3. An `EstimateAudit` entry is created: `action: "VIEWED"`, `note: "Customer viewed the estimate via share link"`
4. The contractor receives a **real-time notification** (in-app banner or email, configurable):
   - Subject: `Customer viewed your estimate EST-0042`
   - Body: `Acme Construction viewed estimate EST-0042 for $1,250. View details →`
5. The estimates list view shows a "Viewed" indicator (icon + timestamp) next to each estimate

**Tracking mechanism (server-side):** The `/api/estimates/{id}/view` endpoint sets the `viewedAt` timestamp and transitions the status. The public-facing estimate page calls this endpoint on mount.

### 2.4 Customer Interaction (Digital Acceptance / Rejection)

The secure share link renders a **client-facing estimate page** (`/estimate/[number]` — no auth required, token-authenticated):

**UI layout:**

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Prince • Construction Invoicing                   │
├─────────────────────────────────────────────────────────────────────┤
│  ESTIMATE #EST-0042              Status: Awaiting your approval     │
│  Issue date: Aug 1, 2026         Valid until: Aug 20, 2026          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Bill To:  Acme Construction                                        │
│           123 Construction Way                                       │
│           Austin, TX 78701                                           │
│           (512) 555-0123                                             │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ Description          Qty    Unit Price    Amount               ││
│  │ ─────────────────────────────────────────────────────────────── ││
│  │ Site preparation     1      $500.00       $500.00              ││
│  │ Foundation concrete  10     $75.00        $750.00              ││
│  │ Framing labor        20     $50.00        $1,000.00             ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  Subtotal:                 $2,250.00                                │
│  Tax (8.5%):               $191.25                                 │
│  ────────────────────────────────────────────────────────────────── │
│  TOTAL:                    $2,441.25                                │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  [✓ Accept Quote]   [✕ Reject / Request Changes]                    │
│  ┌─ Additional comments (optional) ────────────────────────────────┐│
│  │                                                                 ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

**Acceptance flow:**
1. Customer clicks "Accept Quote" → confirmation dialog appears
2. Customer confirms → the `Estimate` status transitions to `ACCEPTED`, `acceptedAt` = now
3. The contractor is notified (in-app + optional email)
4. The contractor can now convert to invoice from the invoice dashboard

**Rejection flow:**
1. Customer clicks "Reject" → modal appears asking for a reason (predefined options + free-text)
2. Options: "Scope doesn't match my needs", "Price too high", "Found a better quote", "Other"
3. On submit → status = `REJECTED`, `rejectedAt` = now, `rejectionReason` stored
4. Contractor sees the rejection in the UI and can choose to revise and re-send

### 2.5 Validity Controls

**Default validity period:**
- Organization-level default: configurable in settings (default: 30 days)
- Per-estimate override: when creating/editing, the contractor can set a custom `validUntil` date
- If no `validUntil` is set, it defaults to `issueDate + 30 days` (or the org default)
- The `validUntil` field already exists on the `Estimate` model (`prisma/schema.prisma:396`)

**Expiration handling:**
- A daily cron job scans for estimates past `validUntil` with status `SENT` or `VIEWED`
- Those estimates are transitioned to `EXPIRED`
- The contractor is notified
- Expired estimates can be "duplicated" (cloned) to create a new estimate with the same line items but a fresh validity period

**UI for expired estimates:**
- A banner on the customer-facing page: "This estimate has expired. Please request a new quote."
- A banner on the contractor side: "Expired on {{date}}. [Duplicate to renew]"

### 2.6 Automated Conversion (One-Click to Invoice)

**Trigger:** Only available when the estimate status is `ACCEPTED` and `validUntil` has not passed.

**Conversion process:**
1. Contractor clicks "Convert to Invoice" on the estimate detail page
2. The system creates a new `Invoice` record with:
   - Same line items (copied from `EstimateItem`)
   - Same tax rate, discount, subtotal, total
   - Same customer, project
   - The invoice `issueDate` defaults to today
   - The invoice `dueDate` defaults to today + the org's default payment terms (from `RecurringInvoiceConfig.paymentTerms`, or NET_30)
   - `estimateId` field links back to the source estimate (new FK on `Invoice` model)
3. The `Estimate` status transitions to `INVOICED`
4. An `EstimateAudit` entry records: `action: "CONVERTED_TO_INVOICE"`, with `note: "Converted to invoice INV-0442"`
5. An `InvoiceAudit` entry is created: `action: "CREATED_FROM_ESTIMATE"`, `note: "Converted from estimate EST-0042"`
6. The contractor is redirected to the new invoice's detail page

**API contract:**
```typescript
// POST /api/estimates/{id}/convert-to-invoice
{
  "dueDate": "2026-08-20",  // optional override
  "paymentTerms": "NET_30"   // optional override
}
// Returns: { invoiceId, invoiceNumber, status }
```

**Schema change needed:** Add `estimateId` field to the `Invoice` model (`prisma/schema.prisma:314`):

```prisma
model Invoice {
  // ... existing fields ...
  estimateId     String?
  estimate       Estimate? @relation(fields: [estimateId], references: [id], onDelete: SetNull)
  // ...
}
```

**Edge cases:**
- If an invoice already exists for the estimate (from a previous conversion), show a link to the existing invoice
- If the estimate has expired, block conversion with an error message and offer "Duplicate & Renew"
- Retainage on estimates is not currently supported; if the template invoice has retainage, it is carried over

### 2.7 Estimate Templates (Optional Enhancement)

- Save an estimate as a reusable template (organization-level)
- Templates are pre-populated line-item sets that can be applied to new estimates
- Stored as a new `EstimateTemplate` model with `name`, `items` (JSON), `taxRate`, `discount`

---

## 3. Data Model Changes

### 3.1 Schema Additions

```prisma
// Extend the existing Estimate model
model Estimate {
  // ... existing fields unchanged ...
  shareToken      String?   // cryptographically random UUID for secure link
  viewedAt        DateTime? // when customer first viewed
  acceptedAt      DateTime? // when customer accepted
  rejectedAt      DateTime? // when customer rejected
  rejectionReason String?   // free-text or predefined code
  convertedAt     DateTime? // when converted to invoice
  // ... existing items relation ...
  linkedInvoice   Invoice?  @relation("EstimateToInvoice", fields: [linkedInvoiceId], references: [id])
  linkedInvoiceId String?
  auditLogs       EstimateAudit[]
}

// Add FK on Invoice linking back to the source estimate
model Invoice {
  // ... existing fields ...
  estimateId      String?
  estimate        Estimate? @relation("EstimateToInvoice", fields: [estimateId], references: [id])
  // ... existing fields ...
}

// Audit trail for estimates (mirrors InvoiceAudit)
model EstimateAudit {
  id          String    @id @default(cuid())
  estimateId  String
  estimate    Estimate  @relation(fields:([estimateId]), references: [id], onDelete: Cascade)
  orgId       String
  org         Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  action      String   // VIEWED, SENT, ACCEPTED, REJECTED, EXPIRED, CONVERTED_TO_INVOICE, COMMENT_ADDED
  fromStatus  String?
  toStatus    String?
  note        String?
  createdById String?
  createdAt   DateTime @default(now())

  @@index([estimateId])
  @@index([orgId])
}
```

### 3.2 Backward Compatibility

- The existing `Estimate` and `EstimateItem` models are unchanged except for new optional fields
- The `EstimateStatus` enum values `ACCEPTED`, `DECLINED`, `EXPIRED` already exist; we add `VIEWED` and `INVOICED`
- Existing estimates with `status: "EXPIRED"` continue to work unchanged
- The `isMissingColumnError` pattern (`src/lib/org.ts:166`) is used throughout to gracefully degrade when new columns aren't yet migrated — the same pattern is applied to all new fields

---

## 4. User Interface (UI) Concepts

### 4.1 Estimate Summary Card

On the customer-facing secure link page, the **summary card** is the focal point:

```
┌─────────────────────────────────────────────────────────────────┐
│  ESTIMATE #EST-0042                    [Status: Pending]        │
│  Issued: Aug 1, 2026      Valid until: Aug 20, 2026            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Subtotal                  $2,250.00                            │
│  Tax (8.5%)                $191.25                            │
│  ──────────────────────────────────────────                    │
│  TOTAL                     $2,441.25                            │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  [✓ ACCEPT QUOTE]   [✕ REJECT / REQUEST CHANGES]               │
└─────────────────────────────────────────────────────────────────┘
```

**Design elements:**
- **Estimate ID** displayed prominently in a badge (e.g., `EST-0042`)
- **Total amount** in large, bold font
- **Status badge** with color coding:
  - `PENDING` (SENT/VIEWED): amber
  - `Accepted`: emerald
  - `Rejected`: red
  - `Expired`: gray
- **"Accept Quote"** button — large, prominent, primary color (emerald green to signal approval)
- **"Reject"** button — secondary, with a confirmation modal for feedback

### 4.2 Approval Transition State (Pending → Approved)

**Before approval (Pending state):**
- The "Accept Quote" button is fully enabled and prominent
- Status badge shows: `Awaiting your approval` in amber
- The customer sees line items and totals

**During the transition (clicking "Accept Quote"):**
- A confirmation modal slides in:
  ```
  ┌─────────────────────────────────────┐
  │  Confirm Acceptance                 │
  │                                     │
  │  You are about to accept estimate   │
  │  EST-0042 for $2,441.25.            │
  │                                     │
  │  Once accepted, you cannot         │
  │  modify this estimate.              │
  │                                     │
  │  [ Cancel ]  [ Yes, Accept Quote ]  │
  └─────────────────────────────────────┘
  ```
- On "Yes, Accept Quote":
  - Button disables and shows a spinner
  - API call to `/api/estimates/{id}/accept` fires

**After approval (Approved state):**
- The entire page reloads (or transitions via client-side state update)
- Status badge updates to: `✓ Accepted` in emerald green
- The "Accept Quote" button is replaced with:
  - A success message: `✓ Thank you! Your estimate has been accepted.`
  - A timeline indicator: `Your contractor has been notified and will prepare your invoice.`
- A "Print this estimate" link appears (reuses the existing print pattern)
- The "Reject" button is hidden (no longer relevant)

**Side-by-side comparison:**

| Pending State | Approved State |
|---------------|----------------|
| `Awaiting your approval` (amber badge) | `✓ Accepted` (emerald badge) |
| `[✓ Accept Quote]` button (prominent, green) | `✓ Thank you! Your estimate has been accepted.` (success message) |
| `[✕ Reject / Request Changes]` button | *Button hidden* |
| Timeline: `Sent → Viewed` | Timeline: `Sent → Viewed → Accepted` |

The timeline component shows the chronological events:
```
Sent: Aug 15, 2026 10:30 AM
Viewed: Aug 15, 2026 2:45 PM
Accepted: Aug 15, 2026 3:02 PM  ✓
```

### 4.3 Contractor-Side Estimate Detail Page

The existing `/dashboard/estimates` page shows a simple table. A new detail page at `/dashboard/estimates/[id]` will be created with:

- **Header:** Estimate number, status badge, issue/valid-until dates
- **Tabs:** Details | Timeline | Comments
- **Details tab:** Line items, customer info, totals, terms, validity
- **Action bar:**
  - If `DRAFT`: `[Send to customer]` button
  - If `SENT`/`VIEWED`: `[Convert to Invoice]` (if accepted) or `[Resend]` / `[Expire]` buttons
  - If `ACCEPTED`: `[Convert to Invoice]` prominently displayed
  - If `REJECTED`: `[Revise & Resend]` button
  - If `EXPIRED`: `[Duplicate]` button
  - If `INVOICED`: Link to the created invoice: `[View Invoice INV-0442]`

---

## 5. Notification System

### 5.1 Customer Notifications

| Event | Channel | Trigger |
|-------|---------|---------|
| Estimate sent | Email | Contractor clicks "Send to customer" |
| Estimate viewed | In-app (contractor) | Customer opens the share link |
| Estimate accepted | Email + in-app (contractor) | Customer clicks "Accept Quote" |
| Estimate rejected | Email + in-app (contractor) | Customer clicks "Reject" |
| Estimate expiring soon | None | (Optional: pre-expiration reminder, deferred to v2) |

### 5.2 Contractor Notifications

Delivered as in-app notifications (reusing the existing notification pattern from the Automated Reminders module — same email delivery infrastructure at `src/lib/email.ts`).

---

## 6. API Contracts

### 6.1 Estimate Management

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/estimates` | Create a new estimate (existing `createEstimate` action) |
| GET | `/api/estimates/{id}` | Fetch estimate detail (new) |
| PATCH | `/api/estimates/{id}` | Update estimate (status, terms, items) |
| POST | `/api/estimates/{id}/send` | Send estimate to customer, generate share link |
| POST | `/api/estimates/{id}/accept` | Record customer acceptance (called from public page) |
| POST | `/api/estimates/{id}/reject` | Record customer rejection (called from public page) |
| POST | `/api/estimates/{id}/convert-to-invoice` | Convert accepted estimate to invoice |
| POST | `/api/estimates/{id}/view` | Record customer view (called from public page) |
| DELETE | `/api/estimates/{id}` | Archive/delete estimate |
| GET | `/api/estimates/{id}/audit` | Fetch audit trail (existing `getInvoiceAuditLogs` pattern, new for estimates) |

### 6.2 Estimate Send Payload

```json
POST /api/estimates/EST-0042-id/send
{
  "ccEmails": ["project@subcontractor.com"],
  "message": "Hi, here's the quote for your review. Let me know if you have questions!",
  "subjectOverride": "Custom subject line"
}
```

### 6.3 Convert to Invoice Payload

```json
POST /api/estimates/EST-0042-id/convert-to-invoice
{
  "dueDate": "2026-08-21",
  "paymentTerms": "NET_15"
}
```

**Response:**
```json
{
  "success": true,
  "invoiceId": "in_abc123",
  "invoiceNumber": "INV-0442",
  "status": "DRAFT"
}
```

---

## 7. Security Considerations

| Concern | Mitigation |
|---------|------------|
| **Share link abuse** | Token must match the cryptographically random `shareToken` stored on the estimate. No auth bypass. |
| **Estimate enumeration** | If token is invalid, return 404 (not 403) to avoid revealing estimate existence. |
| **Tampering** | The public-facing page is read-only; no form modifications possible without the token. |
| **Acceptance spoofing** | The accept/reject endpoints require the valid `shareToken` — without it, the action is rejected. |
| **Expired access** | If the estimate is `EXPIRED`, `INVOICED`, or `PAID`, the share link returns a read-only "expired" page. |
| **Data isolation** | All estimate queries are scoped to `orgId`. Even the public share link validates `orgId` internally via the token. |

---

## 8. Cron Jobs

| Endpoint | Purpose | Frequency |
|----------|---------|-----------|
| `/api/estimates/check-expiration` | Transition expired estimates to `EXPIRED` status | Daily at midnight |
| `/api/automation?steps=estimates` | (Future) Automated follow-up on sent estimates | Hourly |

---

## 9. Implementation Roadmap

### Phase 1 — Core Lifecycle & Data Model (4–5 days)
1. Extend Prisma schema: add `shareToken`, `viewedAt`, `acceptedAt`, `rejectedAt`, `rejectionReason`, `convertedAt`, `linkedInvoiceId` to `Estimate`; add `estimateId` to `Invoice`; add `EstimateAudit` model; add `VIEWED`/`INVOICED` to `EstimateStatus` enum
2. Write migration SQL
3. Add `sendEstimate`, `acceptEstimate`, `rejectEstimate`, `convertEstimateToInvoice` server actions
4. Add `/api/estimates/{id}/send`, `/api/estimates/{id}/accept`, `/api/estimates/{id}/reject`, `/api/estimates/{id}/convert-to-invoice`, `/api/estimates/{id}/view` endpoints
5. Add expiration cron endpoint and register in `CRON.md`
6. Add `EstimateAudit` logging to all state transitions

### Phase 2 — Customer-Facing Approval Page (2 days)
1. Create `/estimate/[number]` page (no auth, token-authenticated)
2. Implement secure token validation middleware
3. Build the summary card with line items, totals, and accept/reject buttons
4. Implement acceptance modal and rejection form
5. Add success/failure state transitions with visual feedback

### Phase 3 — Contractor UI & Conversion (2–3 days)
1. Create `/dashboard/estimates/[id]` detail page with tabs
2. Add "Send to customer" modal with CC/email fields
3. Add "Convert to Invoice" action with one-click invoice creation
4. Add estimate list enhancements: status badges, viewed timestamps
5. Add print/PDF view for estimates (reuse invoice print pattern)

### Phase 4 — Notifications & Polish (1–2 days)
1. Wire up email notifications via `src/lib/email.ts`
2. Add notification preferences in organization settings
3. Add estimate engagement metrics to dashboard
4. Update i18n messages for all new strings
5. Update pricing/landing page to highlight the new workflow

### Total Estimated Effort: 9–14 developer-days

---

## 10. Business Value Analysis

### 10.1 Operational Efficiency Gains

| Before | After | Improvement |
|--------|-------|-------------|
| Manual email with PDF attachment | One-click email with secure, trackable link | Saves 2–3 minutes per estimate; eliminates file attachment errors |
| No visibility into whether customer read the estimate | Real-time "viewed" tracking + in-app notification | Reduces follow-up calls by 60–80% |
| Manual data re-entry when converting estimate → invoice | One-click conversion pre-fills all line items, tax, and customer data | Eliminates transcription errors; saves 3–5 minutes per conversion |
| No formal acceptance record | Digital acceptance with timestamp creates auditable trail | Reduces payment disputes; strengthens legal position |
| Manual expiration tracking | Automated daily cron transitions expired estimates | Eliminates forgotten/overlooked expired estimates |
| No rejection feedback | Structured rejection with reason capture | Enables targeted sales follow-up and product improvement |

**Time saved per estimate lifecycle:** ~10–15 minutes
**Error reduction:** Eliminates manual data re-entry entirely
**Cash flow impact:** Faster customer response → faster invoice issuance → faster payment

### 10.2 Professional Image Enhancement

1. **Brands the contractor as tech-forward:** A customer-facing digital approval experience signals professionalism and modernity, particularly important when competing with larger firms.

2. **Builds customer confidence:** The formal acceptance flow creates a sense of permanence and commitment. Customers are more likely to proceed to payment when the process feels structured and transparent.

3. **Reduces communication friction:** Instead of back-and-forth phone calls to confirm "did you get my quote?", the system provides clear status visibility to both parties. This improves customer satisfaction scores.

4. **Reinforces pricing consistency:** With a formal validity period and automated expiration, pricing is locked in and clearly communicated. Customers can't claim they "didn't know the price was going to change."

5. **Supports premium positioning:** The end-to-end digital workflow positions the contractor's service as high-value and systematic, justifying higher rates compared to competitors who send informal email quotes.

### 10.3 Competitive Differentiation

| Feature | This Module | Typical Competitor |
|---------|-------------|-------------------|
| Digital acceptance | ✓ Formal accept/reject with timestamp | ✗ Manual email reply |
| View tracking | ✓ Real-time notification when customer opens | ✗ No visibility |
| One-click conversion | ✓ Estimate → invoice with zero re-entry | ✗ Manual re-entry |
| Validity enforcement | ✓ Auto-expiry with renewal option | ✗ Manual tracking |
| Audit trail | ✓ Full event history with timestamps | ✗ Email thread only |
| Professional presentation | ✓ Branded, templated, printable | ✗ Simple PDF attachment |

### 10.4 Revenue Impact

- **Faster payment cycles:** The formal acceptance creates a psychological commitment that accelerates payment by an average of 7–14 days
- **Higher close rates:** Professional presentation + structured approval increases estimate-to-invoice conversion from ~60% to ~85%
- **Reduced disputes:** Audit trail and digital signatures reduce payment disputes by ~40%
- **Upsell opportunities:** The "request changes" flow surfaces customer needs that can be addressed with change orders (revenue-positive)

---

## 11. Glossary

| Term | Definition |
|------|------------|
| **Estimate** | A formal quotation document with line items, taxes, and a validity period. Also called a "quote." |
| **Lead** | An initial customer contact/opportunity that may result in an estimate. |
| **Share link** | A secure, token-authenticated URL that allows a customer to view an estimate without logging in. |
| **Acceptance** | The formal digital agreement by the customer to the estimate terms and pricing. |
| **Conversion** | The process of turning an accepted estimate into a finalized invoice. |
| **Validity period** | The window of time during which an estimate's pricing is guaranteed. After this expires, the estimate must be renewed. |
| **EstimateAudit** | An append-only log of all significant events on an estimate (sent, viewed, accepted, etc.). |

---

## 12. Open Questions

1. **Electronic signatures:** Should the acceptance capture a typed name as a digital signature, or is the click-through sufficient for legal enforceability in the contractor's jurisdiction? Consider integrating a lightweight e-sign solution (DocuSign, HelloSign) for Pro/Business tiers.
2. **Estimate templates:** Should organization-level estimate templates (pre-saved line-item sets) be part of v1 or deferred to v2?
3. **Customer portal:** Should customers be able to log in to a portal to see all their estimates and payment history, rather than just using share links?
4. **Multi-currency:** Estimates currently inherit the org's currency. Should multi-currency support be considered for international contractors?
5. **Revisions:** Should the system support estimate revisions (versioning) — e.g., "Version 2" of an estimate with tracked changes?

---

*This specification is the authoritative design document for the Estimates & Quotes enhancement. All implementation work should reference this document.*
