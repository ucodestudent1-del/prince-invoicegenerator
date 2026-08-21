# Automated Reminders — Product Feature Specification

**Document Status:** Draft (Specification)
**Project:** Prince Invoice Generator
**Author:** Product / Engineering
**Date:** 2026-08-20
**Related Files:**
- Prisma schema: `prisma/schema.prisma` (`ReminderConfig`, `Reminder` models)
- API: `src/app/api/reminders/check/route.ts`, `src/app/api/settings/reminders/route.ts`
- Server actions: `src/lib/actions/invoices.ts` (`getReminderConfig`, `saveReminderConfig`, `sendReminder`)
- UI: `src/components/reminder-settings-form.tsx`, `src/app/[locale]/dashboard/settings/reminders/page.tsx`
- Cron: `/api/reminders/check` is invoked every 15 minutes (see `CRON.md`)
- Plan gating: `automaticReminders` feature key → Business tier only (`src/lib/plans.ts`)

---

## 1. Overview & Value Proposition

### 1.1 Problem

Prince currently generates invoices passively. Once an invoice is marked **Sent**, the app does nothing to prompt the customer to pay. The existing reminder infrastructure is a stub: it records `Reminder` rows in the database with `status: "SENT"` but never actually delivers an email, and it supports only a single before/due/after window rather than a structured escalation sequence.

The result is that outstanding receivables sit idle, cash flow stalls, and contractors must manually chase down payments.

### 1.2 Solution

The **Automated Reminders** system transforms Prince from a "create-and-forget" invoice generator into a **proactive cash-flow management platform**. It introduces a **tiered, multi-stage escalation engine** that sends personalized email notifications at strategically timed points relative to each invoice's due date — before it is due, on the due date, and progressively after it.

### 1.3 Positioning Shift

| Before | After |
|--------|-------|
| Passive invoice creation tool | Active receivables management suite |
| Manual payment chasing | Automated follow-up sequences |
| Single reminder window | Multi-tiered escalation ladder |
| No email delivery | Full SMTP/email-service integration |
| One-size-fits-all template | Per-stage, fully branded templates |

**Key message to users:** *"Get paid faster. Prince automatically sends friendly payment reminders before, on, and after your invoice due dates — so you don't have to."*

---

## 2. Core Functionality

### 2.1 System Overview

The system operates on a **per-organization** configuration model. Each organization defines a set of **reminder stages**, each of which has:

- **A trigger condition** (based on days relative to the invoice due date)
- **An enable/disable toggle** (global on/off per stage)
- **A custom email subject line** with variable interpolation
- **A custom email body template** with variable interpolation
- **A frequency cap** (minimum hours between sends for the same invoice + stage)

A background cron job (`/api/reminders/check`, running every 15 minutes) evaluates every invoice in every organization against the active configuration and dispatches emails accordingly.

### 2.2 Invoice Eligibility

An invoice is eligible for automated reminders when:

| Condition | Detail |
|-----------|--------|
| **Status** | `SENT`, `VIEWED`, `OVERDUE`, or `UNPAID` |
| **Not paid** | `amountPaid < total` (i.e., a balance remains) |
| **Has due date** | `dueDate` is not null |
| **Has customer email** | The linked `Customer.email` is present and non-empty |
| **Has not been voided** | Status is not `VOID` or `DRAFT` |
| **No payment recorded** | No `COMPLETED` payment covering the full balance |
| **Reminders enabled** | The organization has at least one active reminder stage |

Invoices that transition to `PAID` at any point are immediately excluded from all future reminder evaluations.

### 2.3 Data Model

#### 2.3.1 Enhanced `ReminderConfig` Schema

The existing `ReminderConfig` model (`prisma/schema.prisma:576`) is replaced with a richer structure. Two approaches are available — we recommend **Approach B** (related stages) for maximum flexibility.

**Approach A — Flattened fields on `ReminderConfig` (migration-safe, minimal schema change):**

```prisma
model ReminderConfig {
  id              String   @id @default(cuid())
  orgId           String
  org             Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  // Global toggle
  enabled         Boolean  @default(true)

  // --- Stage 1: Pre-due ---
  preDueEnabled   Boolean  @default(true)
  preDueDays      Int      @default(7)        // days before dueDate
  preDueSubject   String?  @default("Reminder: Invoice {{invoiceNumber}} due soon")
  preDueTemplate  String?  // body template

  // --- Stage 2: Due-date ---
  dueDateEnabled  Boolean  @default(true)
  dueDateDays     Int      @default(0)        // 0 = on the due date
  dueDateSubject  String?  @default("Invoice {{invoiceNumber}} is due today")
  dueDateTemplate String?

  // --- Stage 3: Post-due escalation ---
  // Comma-separated day offsets, e.g. "1,7,14,30"
  postDueEnabled  Boolean  @default(true)
  postDueOffsets  String   @default("1,7,14,30")
  postDueSubjects String?  @default("Invoice {{invoiceNumber}} is now overdue")   // single template applied to all post-due stages
  postDueTemplate String?

  // --- Frequency / caps ---
  frequencyHours  Int      @default(24)  // minimum hours between reminders for same invoice
  maxReminders    Int      @default(5)  // global max across all stages per invoice

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([orgId])
  @@index([orgId])
}
```

**Approach B — Related `ReminderStage` model (recommended, more dynamic):**

```prisma
model ReminderConfig {
  id            String   @id @default(cuid())
  orgId         String
  org           Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  enabled       Boolean  @default(true)
  frequencyHours Int     @default(24)
  maxReminders  Int      @default(5)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  stages        ReminderStage[]

  @@unique([orgId])
  @@index([orgId])
}

model ReminderStage {
  id            String   @id @default(cuid())
  configId      String
  config        ReminderConfig @relation(fields: [configId], references: [id], onDelete: Cascade)

  name          String   // "Pre-due reminder", "Due date", "1 day overdue", "7 days overdue", etc.
  type          ReminderStageType  // PRE_DUE | DUE_DATE | POST_DUE
  enabled       Boolean  @default(true)
  daysOffset    Int      // negative = before due, 0 = due date, positive = after due
  subjectTemplate String?  // e.g. "Invoice {{invoiceNumber}} is {{daysOverdue}} days overdue"
  bodyTemplate     String?  // HTML or plain-text body

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([configId])
  @@index([type])
}

enum ReminderStageType {
  PRE_DUE    // daysOffset < 0
  DUE_DATE   // daysOffset == 0
  POST_DUE   // daysOffset > 0
}
```

> **Rationale:** Approach B allows future expansion (per-stage time-of-day, SMS channels, customer-segment overrides) without further schema changes. A migration seed will backfill the default stages (7 days before, 0 days on, 1/7/14/30 days after) for every existing organization.

> **Backward compatibility:** The existing endpoint `src/app/api/settings/reminders/route.ts` will be extended to serialize/deserialize the new nested structure. The `saveReminderConfig` server action (`src/lib/actions/invoices.ts:410`) will be updated to upsert stages alongside the parent config. A schema-drift fallback (see `isMissingColumnError` pattern at `src/lib/org.ts:166`) will gracefully degrade if new columns are not yet migrated.

#### 2.3.2 Enhanced `Reminder` Model

The existing `Reminder` model (`prisma/schema.prisma:594`) is extended to support the tiered engine:

```prisma
model Reminder {
  id            String    @id @default(cuid())
  orgId         String
  org           Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  invoiceId     String?
  invoice       Invoice?  @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  type          String    // PRE_DUE | DUE_DATE | POST_DUE_1 | POST_DUE_7 | POST_DUE_14 | POST_DUE_30
  stageId       String?   // links to ReminderStage (nullable for backward compat)
  scheduledAt   DateTime
  sentAt        DateTime?
  deliveredAt   DateTime?  // set when email delivery is confirmed
  status        String    @default("PENDING")  // PENDING, SENT, DELIVERED, FAILED, BOUNCED, SKIPPED
  channel       String    @default("EMAIL")    // EMAIL, SMS (future)
  recipient     String?   // email address the reminder was sent to
  subject       String?   // rendered subject at time of send (for audit)
  note          String?
  errorMessage  String?   // if status is FAILED or BOUNCED
  metadata      Json?     // delivery provider response, message ID, etc.
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([orgId])
  @@index([invoiceId])
  @@index([invoiceId, type])
}
```

### 2.4 Trigger Logic — Tiered Scheduling

The system evaluates invoice due dates relative to the current time and assigns each to a **reminder stage**. The tiered schedule is:

#### Tier 0: Pre-due Date Triggers

| Stage | Offset | Default | Trigger Condition |
|-------|--------|---------|-------------------|
| Friendly reminder | 7 days before | `preDueDays = 7` | `dueDate - 7 days <= now < dueDate - 6 days` |
| (configurable) | 3 days before | optional | `dueDate - 3 days <= now` |

Fires when the invoice is in an eligible status and the customer has **not yet viewed** the invoice's payment portal (if view-tracking is available) or simply when the pre-due window is reached.

#### Tier 1: Due Date Trigger

| Stage | Offset | Default | Trigger Condition |
|-------|--------|---------|-------------------|
| Due date notification | 0 days (on the due date) | `dueDateDays = 0` | `dueDate <= now < dueDate + 1 day` |

Fires when the invoice's due date is today (or has passed but is within the same day's window).

#### Tier 2: Post-due Date Triggers (Escalating)

| Stage | Offset | Default | Trigger Condition | Email Tone |
|-------|--------|---------|-------------------|------------|
| 1 day overdue | 1 day after due | `postDueOffsets[0] = 1` | `now >= dueDate + 1 day` | Polite / friendly |
| 7 days overdue | 7 days after due | `postDueOffsets[1] = 7` | `now >= dueDate + 7 days` | Firm |
| 14 days overdue | 14 days after due | `postDueOffsets[2] = 14` | `now >= dueDate + 14 days` | Strong |
| 30 days overdue | 30 days after due | `postDueOffsets[3] = 30` | `now >= dueDate + 30 days` | Final / escalation |

**Escalation logic:** Each post-due stage is a separate `ReminderStage` with its own subject and body template. If the customer pays between stages, all subsequent stages for that invoice are **skipped** (a `SKIPPED` record is written to the audit trail for transparency).

**Default post-due offsets:** `1, 7, 14, 30` (configurable as a comma-separated list or as individual stage rows).

### 2.5 Scheduling Engine — Evaluation Algorithm

The `/api/reminders/check` endpoint (`src/app/api/reminders/check/route.ts:10`) is rewritten with the following evaluation loop:

```
 pseudocode:

 for each ReminderConfig (where enabled = true):
   for each ReminderStage (where enabled = true):
     for each eligible Invoice:
       daysDiff = floor((now - invoice.dueDate) / 86400000)
       
       if stage.type == PRE_DUE:
         shouldTrigger = (daysDiff == -stage.daysOffset)
                        AND invoice.status in [SENT, VIEWED]
       if stage.type == DUE_DATE:
         shouldTrigger = (daysDiff == 0)
       if stage.type == POST_DUE:
         shouldTrigger = (daysDiff == stage.daysOffset)
                        AND invoice.status in [UNPAID, OVERDUE, SENT, VIEWED]
       
       if not shouldTrigger: skip
       
       // Deduplication: has this exact stage already been sent for this invoice?
       alreadySent = reminder.count({
         invoiceId, stageId, status in [SENT, DELIVERED]
       }) > 0
       if alreadySent: skip
       
       // Frequency cap: has any reminder been sent recently?
       since = now - config.frequencyHours
       if reminder.count({ invoiceId, status: SENT, createdAt >= since }) >= config.maxReminders:
         skip
       
       // Send email
       renderedSubject = interpolate(stage.subjectTemplate, invoice, customer)
       renderedBody = interpolate(stage.bodyTemplate, invoice, customer)
       deliveryResult = sendEmail(customer.email, renderedSubject, renderedBody)
       
       // Record
       reminder.create({
         invoiceId, stageId, type, scheduledAt: now,
         sentAt: deliveryResult.success ? now : null,
         status: deliveryResult.status,
         recipient: customer.email,
         subject: renderedSubject,
         errorMessage: deliveryResult.error,
         metadata: deliveryResult.metadata,
       })
       
       // Audit trail
       invoiceAudit.create({
         invoiceId, action: "REMINDER_SENT",
         note: `Automated ${stage.name} reminder sent to ${customer.email}`
       })
```

**Key design decisions:**

1. **Deduplication per stage:** Once a stage fires for an invoice, it never fires again for that same invoice+stage combination. This prevents duplicate sends even if the cron job runs multiple times within the same day.
2. **Frequency cap as a backstop:** The `frequencyHours` / `maxReminders` cap acts as a global guardrail across all stages — useful if many stages are configured closely together.
3. **Atomic writes:** Each reminder + audit log pair is written in a transaction to ensure consistency.
4. **Idempotent:** If the endpoint is called twice within the same evaluation window, the deduplication check ensures no duplicate emails are sent.
5. **Error isolation:** If sending an email fails, the `Reminder` row is still created with `status: "FAILED"` and the `errorMessage` is stored. Other invoices in the batch continue processing unaffected.

---

## 3. User Customization Controls

### 3.1 Interface Architecture

The settings UI lives at `/dashboard/settings/reminders` and consists of:

1. A **global master toggle** (enable/disable all automated reminders).
2. A **stage list** — a card per stage showing its trigger, timing, and actions.
3. An **edit form** — a modal or expanded card revealing the full customization fields for a single stage.
4. A **live preview** of the rendered subject and body before saving.

The page is gated by the `automaticReminders` feature flag (Business tier) via the `PricingFeature` wrapper pattern used in `src/app/[locale]/dashboard/settings/scheduled/page.tsx:41`.

### 3.2 Global Controls

| Control | Type | Default | Description |
|---------|------|---------|-------------|
| Master enable | Switch | `true` | Toggles all automated reminders on/off for the organization. When off, no emails are sent but configuration is preserved. |
| Frequency (hours between reminders) | Number input | `24` | Minimum hours between any two reminders for the same invoice. Acts as a throttle. |
| Max reminders per invoice | Number input | `5` | Maximum total reminders (across all stages) sent for a single invoice before the system stops. |

### 3.3 Per-Stage Customization Controls

Each reminder stage is a card with an **enable toggle** and a **settings drawer**. When expanded, the user can configure:

#### 3.3.1 Timing Controls

| Field | Type | Default | Constraints |
|-------|------|---------|-------------|
| Stage name | Text input | e.g. "1 day overdue" | User-facing label, also used in audit logs |
| Enable stage | Switch | `true` | Individual on/off per stage |
| Days relative to due date | Number input | e.g. `-7` for pre-due, `0` for due date, `1`/`7`/`14`/`30` for post-due | Negative = before, zero = on, positive = after |
| Time of day | Time picker | `09:00` (local) | Optional — specifies the hour (in the org's timezone) when the trigger window opens. If unset, the cron evaluation at the 15-minute mark determines trigger. |

#### 3.3.2 Email Content Controls

Each stage has its own subject and body template, enabling **tone escalation** (friendly → firm → final).

**Subject line editor:**
- Text input with live character counter
- Supports variables: `{{invoiceNumber}}`, `{{customerName}}`, `{{companyName}}` (if set), `{{amount}}`, `{{balance}}`, `{{dueDate}}`, `{{daysOverdue}}` (post-due only), `{{issueDate}}`

**Email body editor:**
- Rich text / HTML editor or structured textarea with template variables
- Default templates per stage type (see Section 3.4)
- Live preview toggle showing a rendered example using sample data
- Available variables are listed beneath each editor

#### 3.3.3 Channel Selector

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| Delivery channel | Select | `EMAIL` | Currently single-select: EMAIL. UI is designed to support future SMS channel addition. |

### 3.4 Default Templates Per Stage

#### Stage 1: Pre-due (7 days before) — "Friendly reminder"

```
Subject: Friendly reminder: Invoice {{invoiceNumber}} due on {{dueDate}}

Body:
Hi {{customerName}},

We hope your project is going well. This is a friendly heads-up that invoice
{{invoiceNumber}} for {{amount}} is due on {{dueDate}}.

If you've already sent payment, thank you — please disregard this message.

View your invoice and pay online: {{invoiceUrl}}

Thank you,
{{companyName}}
```

#### Stage 2: Due date (0 days) — "Invoice due today"

```
Subject: Invoice {{invoiceNumber}} is due today

Body:
Hi {{customerName}},

This is a courtesy reminder that invoice {{invoiceNumber}} for {{amount}}
was due today ({{dueDate}}).

Please arrange payment at your earliest convenience to avoid any
late fees or service delays.

Pay online: {{invoiceUrl}}

Thank you,
{{companyName}}
```

#### Stage 3: 1 day overdue — "Gentle escalation"

```
Subject: Invoice {{invoiceNumber}} is 1 day overdue

Body:
Hi {{customerName}},

We noticed that invoice {{invoiceNumber}} for {{balance}} became overdue
yesterday (due {{dueDate}}).

If you've already sent payment, please allow 1–2 business days for it to
process. Otherwise, please settle this invoice today to avoid further action.

Pay online: {{invoiceUrl}}

Thank you,
{{companyName}}
```

#### Stage 4: 7 days overdue — "Firm reminder"

```
Subject: {{customerName}}, invoice {{invoiceNumber}} is 7 days overdue

Body:
Hi {{customerName}},

This is a firm reminder that invoice {{invoiceNumber}} for {{balance}}
is now 7 days past due (originally due {{dueDate}}).

A late fee may have been applied to your account. Please settle this
invoice immediately to avoid service interruption.

Pay online: {{invoiceUrl}}

If you've already sent payment or are experiencing issues, please reply
to this email so we can assist you.

Thank you,
{{companyName}}
```

#### Stage 5: 14 days overdue — "Strong escalation"

```
Subject: URGENT: Invoice {{invoiceNumber}} — 14 days overdue

Body:
Hi {{customerName}},

Invoice {{invoiceNumber}} for {{balance}} is now 14 days overdue.

We have not yet received payment and this matter requires immediate
attention. Continued non-payment may result in suspension of services
or referral to collections.

Please pay in full immediately: {{invoiceUrl}}

If you are experiencing financial hardship or dispute the charges,
contact us immediately so we can discuss payment arrangements.

{{companyName}}
```

#### Stage 6: 30 days overdue — "Final notice"

```
Subject: FINAL NOTICE: Invoice {{invoiceNumber}} — 30 days overdue

Body:
Hi {{customerName}},

This is a final notice regarding invoice {{invoiceNumber}} for {{balance}},
which is now 30 days overdue (originally due {{dueDate}}).

This account is being referred to our collections partner. Unless we receive
full payment or hear from you by close of business in the next 48 hours,
collection proceedings may begin.

Pay in full immediately: {{invoiceUrl}}

{{companyName}}
Collections Department
```

### 3.5 Template Variables Reference

| Variable | Description | Available In |
|----------|-------------|--------------|
| `{{invoiceNumber}}` | The invoice number (e.g. `INV-0042`) | All stages |
| `{{customerName}}` | The customer's display name | All stages |
| `{{companyName}}` | The organization's name | All stages |
| `{{amount}}` | The invoice total (formatted) | All stages |
| `{{balance}}` | Remaining balance (formatted) | All stages |
| `{{dueDate}}` | The invoice due date (formatted) | All stages |
| `{{issueDate}}` | The invoice issue date (formatted) | All stages |
| `{{daysOverdue}}` | Integer days past due (positive) | Post-due stages only |
| `{{invoiceUrl}}` | Link to the customer-facing invoice portal | All stages |
| `{{lateFeeAmount}}` | Applied late fee (if any) | Post-due stages only |

### 3.6 UI Component Specification

The existing `ReminderSettingsForm` (`src/components/reminder-settings-form.tsx`) is replaced with a more capable component that mirrors the patterns established by `late-fee-settings-form.tsx` and the `TemplatesContent` component in `src/app/[locale]/dashboard/settings/templates/page.tsx`.

**Component structure:**

```
<ReminderSettingsForm>
  <div className="space-y-6">
    {/* Global master toggle */}
    <Card>
      <CardHeader>
        <CardTitle>Automated Reminders</CardTitle>
        <CardDescription>...</CardDescription>
      </CardHeader>
      <CardContent>
        <Switch id="master-enabled" />
        <Input name="frequencyHours" />
        <Input name="maxReminders" />
      </CardContent>
    </Card>

    {/* Stage cards — one per ReminderStage */}
    {stages.map(stage => (
      <ReminderStageCard stage={stage} key={stage.id}>
        <div className="flex justify-between">
          <Switch id={`stage-${stage.id}-enabled`} checked={stage.enabled} />
          <Button onClick={openStageEditor}>Edit</Button>
        </div>
        <div className="text-sm text-muted-foreground">
          {stage.type === 'PRE_DUE' ? `${stage.daysOffset} days before due` : ...}
        </div>
      </ReminderStageCard>
    ))}

    {/* Stage editor (modal or inline expand) */}
    <StageEditor stage={selectedStage}>
      <Input name="name" />
      <Input name="daysOffset" type="number" />
      <TimePicker name="timeOfDay" />
      <Input name="subjectTemplate" />
      <TemplateEditor name="bodyTemplate" variables={TEMPLATE_VARIABLES} />
      <LivePreview subject={renderedSubject} body={renderedBody} />
      <Button type="submit">Save stage</Button>
    </StageEditor>

    <Button type="submit">Save all settings</Button>
  </div>
</ReminderSettingsForm>
```

**Data flow:**
1. On mount, the form fetches `/api/settings/reminders` (GET) which returns the `ReminderConfig` with nested `stages`.
2. Each stage is rendered as a card with its trigger summary and toggle.
3. Clicking "Edit" on a stage opens an inline editor with timing, subject, body, and live preview.
4. Saving a stage updates local state; saving the form POSTs the entire config to `/api/settings/reminders` (POST).
5. On success, a toast notification appears (matching the pattern in `reminder-settings-form.tsx:97-100`).

### 3.6 Per-Invoice Override

On the invoice detail page (`src/app/[locale]/dashboard/invoices/[id]/page.tsx`), a new section appears:

```
Invoice Reminder Settings
[ ] Suppress all automated reminders for this invoice
    (useful when payment is already in progress)

Scheduled reminders:
● Pre-due reminder              Aug 13, 2026  •  Sent
● Due date reminder             Aug 20, 2026  •  Pending
● 1 day overdue                 Aug 21, 2026  •  Pending
● 7 days overdue                Aug 27, 2026  •  Pending
```

This allows a user to:
- **Snooze** specific stages for an invoice (e.g., "don't send the due-date reminder, payment is coming").
- **Suppress** all automated reminders for high-trust customers.
- **View** the reminder timeline for the invoice (what fired, what's pending, what was skipped).

### 3.7 Reminder History Tab

A new "Reminders" tab is added to the invoice detail page, showing a chronological table:

| Date | Stage | Type | Status | Channel | Recipient | Subject |
|------|-------|------|--------|---------|-----------|---------|
| Aug 13, 2026 | Pre-due | PRE_DUE | Delivered | Email | customer@example.com | Reminder: Invoice INV-0042 due soon |
| — | Due date | DUE_DATE | Pending | Email | — | — |

This reuses the `AuditLog` component pattern (`src/components/audit-log.tsx`) for consistency.

---

## 4. Email Delivery Integration

### 4.1 Current State Gap

The existing implementation records `Reminder` rows with `status: "SENT"` but **does not actually send any email**. The `sendReminder` action (`src/lib/actions/invoices.ts:452`) only creates DB records and audit logs.

### 4.2 Delivery Provider

A pluggable email delivery layer is introduced:

```typescript
// src/lib/email.ts (new file)
import { Resend } from "resend";
// or nodemailer for SMTP, or SendGrid, etc.

const resend = new Resend(process.env.RESEND_API_KEY);

export interface EmailResult {
  success: boolean;
  status: "DELIVERED" | "QUEUED" | "FAILED";
  messageId?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}): Promise<EmailResult>
```

**Provider selection** is controlled by environment variables:

| Variable | Purpose |
|----------|---------|
| `EMAIL_PROVIDER` | `"resend"` \| `"smtp"` \| `"sendgrid"` (default: `"resend"`) |
| `RESEND_API_KEY` | Resend API key |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | SMTP configuration |
| `SENDGRID_API_KEY` | SendGrid API key |
| `FROM_EMAIL` | Default sender address (e.g. `invoices@yourcompany.com`) |

### 4.3 Template Rendering

The body template supports a subset of HTML (inline CSS) plus the variable interpolation described in Section 3.5. A simple `{{variable}}` replacement function is used:

```typescript
// src/lib/email.ts
export function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => 
    variables[key] ?? match
  );
}
```

**Security note:** Variables are escaped via `String.replace` to prevent template injection. The HTML body is sanitized on the provider side (Resend, etc. handle this).

### 4.4 Delivery Status Handling

| Provider response | `Reminder.status` | `Reminder.deliveredAt` |
|--------------------|-------------------|------------------------|
| Accepted / queued | `QUEUED` | null |
| Delivered (webhook or sync) | `DELIVERED` | `now()` |
| Bounced | `BOUNCED` | null |
| Rejected / error | `FAILED` | null |

Webhook endpoints (`/api/email/webhook`) capture async delivery/bounce events and update the `Reminder` row accordingly. This requires a `metadata` or `messageId` field on the `Reminder` model for correlation.

---

## 5. Cron / Background Job Architecture

### 5.1 Current Schedule

Per `CRON.md:28`, `/api/reminders/check` runs every 15 minutes:

```cron
*/15 * * * * curl -X GET "https://your-app.com/api/reminders/check" -H "x-api-key: $BACKGROUND_JOB_API_KEY"
```

### 5.2 Evaluation Precision

With 15-minute granularity, the engine checks if an invoice **entered** a stage's trigger window since the last run. The logic uses **inclusive date-range checks** rather than exact timestamp matching:

```
// Example: pre-due stage at 7 days before due
// Trigger window: dueDate - 7 days (00:00:00) through dueDate - 6 days (23:59:59)
// The engine checks: did this invoice enter this window since the last cron run?
```

To handle this precisely, a `lastCheckedAt` timestamp is stored per organization (or the cron job tracks the previous run time internally). For simplicity in v1, a **same-day dedup** strategy is used: if the cron runs at 08:30 and 08:45, and both evaluations fall within the same day's trigger window, the dedup check (`# alreadySent`) prevents duplicate sends.

### 5.3 Idempotency & Reliability

- The endpoint is **idempotent**: if it runs twice within the same window for the same invoice+stage, the dedup check prevents double sends.
- Failures are isolated: if one organization's data fails to load, the job logs the error and continues to the next organization.
- All errors are logged via `logError("reminders-check", err)` (pattern: `src/app/api/reminders/check/route.ts:116`).
- Results are returned as structured JSON for monitoring:

```json
{
  "success": true,
  "remindersSent": 42,
  "details": [
    { "org": "Acme Construction", "invoice": "INV-0042", "stage": "pre-due", "recipient": "client@example.com", "status": "DELIVERED" },
    ...
  ]
}
```

### 5.4 Plan Gating

The feature is gated to the **Business** plan via:

```typescript
// src/lib/plans.ts
features: [..., "automaticReminders", ...]  // BUSINESS plan only
```

The settings page checks this in the SSR component:

```typescript
// mirror of src/app/[locale]/dashboard/settings/scheduled/page.tsx:41-47
const plan = await getActivePlan(user);
if (!hasFeature(plan, "automaticReminders")) {
  return <PricingFeature feature="automaticReminders" plan={plan} />;
}
```

---

## 6. Security & Compliance

### 6.1 Data Access

- All reminder queries are scoped to `orgId` (inherited from the authenticated session's organization).
- The background job endpoint (`/api/reminders/check`) requires the `BACKGROUND_JOB_API_KEY` header — verified by `isBackgroundJobAuthorized()` (`src/lib/background-job-auth.ts:5`).
- The settings endpoints (`/api/settings/reminders`) require an authenticated user session via `requireUser()` (`src/lib/org.ts:35`).

### 6.2 Data Privacy

- Customer email addresses are stored on the `Customer` model and are only accessed for the purpose of sending reminders.
- Email content is not stored in plaintext beyond the rendered subject (for audit purposes). The full body template lives on the `ReminderStage` / `ReminderConfig` model.
- The `metadata` JSON field on `Reminder` may contain provider message IDs — no PII beyond the recipient email.

### 6.3 Rate Limiting

The `frequencyHours` + `maxReminders` cap serves as a rate-limiting mechanism to prevent email spam to a single customer. A future enhancement could integrate with the existing `src/lib/rate-limit.ts` pattern for global send throttling.

---

## 7. Edge Cases & Error Handling

| Scenario | Behavior |
|----------|----------|
| Invoice has no `dueDate` | Skipped — no due date means no trigger anchor |
| Customer has no email | Skipped — logged as a warning, no Reminder record created |
| Email delivery fails | `Reminder` row created with `status: "FAILED"` and `errorMessage` populated. Audit log entry created. Job continues to next invoice. |
| Invoice is paid between stage evaluation and delivery | Dedup check runs again before send; if `amountPaid == total`, skip. |
| Organization has reminders disabled | Global config `enabled = false` → all stages skipped |
| Stage is disabled | Stage's `enabled = false` → that stage is skipped |
| Schema drift (new columns not migrated) | `isMissingColumnError` catch — falls back to legacy `ReminderConfig` fields with sensible defaults. The feature degrades gracefully to the existing before/due/after behavior. |
| Invoice is re-opened (PAID → UNPAID) | The reminder engine re-evaluates from scratch. Previous `REMINDER_SENT` records remain in the audit trail but dedup ensures no stage fires twice. A "restart" flag could be added to allow re-sending. |
| Customer email bounces | Status set to `BOUNCED`, and the customer is flagged. Subsequent reminders to that email are skipped and logged as `SKIPPED`. |

---

## 8. Testing Strategy

### 8.1 Unit Tests

- **`renderTemplate`** — verifies variable interpolation, missing variable handling, HTML escaping
- **Trigger evaluation logic** — given an invoice's due date and a stage config, verify the correct trigger condition is computed
- **Dedup logic** — verify a stage does not fire twice for the same invoice
- **Status filtering** — verify invoices in `PAID` or `VOID` are excluded

### 8.2 Integration Tests

- Full cron cycle: seed invoices with various due dates, run `/api/reminders/check`, assert correct `Reminder` records are created and emails are dispatched (mocked provider)
- Schema drift fallback: verify degraded behavior when new columns are absent
- Feature gating: verify the settings page redirects to /pricing for non-Business plans

### 8.3 Test Framework

The existing smoke test at `tests/auth-smoke.js` uses a lightweight Node HTTP approach. New tests should follow the same pattern or be added as Jest/Vitest suites if the project adopts one. Since no test framework is configured beyond the smoke test, we recommend:

```bash
# Add to package.json scripts
"test": "node tests/auth-smoke.js && node tests/reminders-smoke.js"
```

A `tests/reminders-smoke.js` file that:
1. Creates a test invoice with a past due date
2. Triggers the reminders check endpoint
3. Asserts a `Reminder` record was created with the correct type and status

---

## 9. Analytics & Monitoring

### 9.1 Dashboard Metrics

A new widget on the dashboard overview (`src/app/[locale]/dashboard/page.tsx`) shows:

- **Reminders sent this month** — total count
- **Reminders delivered** — percentage of successful deliveries
- **Average days to payment** — comparing invoices with reminders vs. without
- **Revenue recovered** — estimate of payments received after a reminder was sent

### 9.2 Audit Trail

Every reminder send is recorded in `InvoiceAudit` with `action: "REMINDER_SENT"`, following the existing pattern at `src/lib/actions/invoices.ts:525` and `src/app/api/reminders/check/route.ts:96`.

### 9.3 Error Monitoring

Failed deliveries are logged via `logError("reminders-check", err)` and the individual `errorMessage` is stored on the `Reminder` row for troubleshooting.

---

## 10. Implementation Roadmap

### Phase 1 — Foundation (Backend)
1. Update Prisma schema with `ReminderStage` model and enhanced `Reminder` fields (Approach B).
2. Write migration seed to backfill default stages for existing orgs.
3. Rewrite `/api/reminders/check` with the tiered evaluation engine.
4. Add `src/lib/email.ts` with pluggable delivery and template rendering.
5. Update `saveReminderConfig` and `getReminderConfig` to handle stages.
6. Add email webhook endpoint for delivery status updates.

**Est. effort:** 4–6 developer days

### Phase 2 — Settings UI
1. Replace `ReminderSettingsForm` with the new stage-based component.
2. Add per-stage edit modals with subject/body editors and live preview.
3. Update `/api/settings/reminders` route to serialize/deserialize stages.
4. Update i18n messages (`src/messages/en.json`) with new translation keys.
5. Add plan gating via `PricingFeature` wrapper on the settings page.

**Est. effort:** 2–3 developer days

### Phase 3 — Invoice-Level Features
1. Add "Reminder settings" section to invoice detail page (`[id]/page.tsx`).
2. Add per-invoice snooze / suppress controls.
3. Add "Reminders" tab with chronological history table (reuse `AuditLog` pattern).

**Est. effort:** 1–2 developer days

### Phase 4 — Monitoring & Analytics
1. Add dashboard widgets for reminder metrics.
2. Add smoke test for the reminders check endpoint.
3. Update `CRON.md` with any new endpoints or schedule changes.

**Est. effort:** 1 day

### Total Estimated Effort: 8–12 developer days

---

## 11. API Contracts

### 11.1 GET `/api/settings/reminders`

Returns the organization's reminder configuration with nested stages.

```json
{
  "enabled": true,
  "frequencyHours": 24,
  "maxReminders": 5,
  "stages": [
    {
      "id": "stage_pre_due",
      "name": "Friendly reminder",
      "type": "PRE_DUE",
      "enabled": true,
      "daysOffset": -7,
      "timeOfDay": "09:00",
      "subjectTemplate": "Friendly reminder: Invoice {{invoiceNumber}} due on {{dueDate}}",
      "bodyTemplate": "Hi {{customerName}},...",
      "channel": "EMAIL",
      "createdAt": "2026-08-20T19:30:00.000Z",
      "updatedAt": "2026-08-20T19:30:00.000Z"
    },
    {
      "id": "stage_due_date",
      "name": "Due date notification",
      "type": "DUE_DATE",
      "enabled": true,
      "daysOffset": 0,
      ...
    },
    {
      "id": "stage_post_due_1",
      "name": "1 day overdue",
      "type": "POST_DUE",
      "enabled": true,
      "daysOffset": 1,
      ...
    },
    ...
  ]
}
```

### 11.2 POST `/api/settings/reminders`

Accepts the full config with stages. Creates or updates stages atomically.

```json
{
  "enabled": true,
  "frequencyHours": 24,
  "maxReminders": 5,
  "stages": [
    {
      "name": "Friendly reminder",
      "type": "PRE_DUE",
      "enabled": true,
      "daysOffset": -7,
      "subjectTemplate": "...",
      "bodyTemplate": "..."
    },
    ...
  ]
}
```

### 11.3 GET `/api/reminders/check` (cron)

No request body. Returns job results.

```json
{
  "success": true,
  "remindersSent": 42,
  "details": [
    {
      "org": "Acme Construction",
      "invoice": "INV-0042",
      "stage": "pre-due",
      "recipient": "client@example.com",
      "status": "DELIVERED",
      "messageId": "msg_abc123"
    }
  ]
}
```

### 11.4 GET `/api/reminders` (user-initiated, invoice-scoped)

Optional endpoint to fetch the reminder history for a specific invoice.

```json
{
  "reminders": [
    {
      "id": "rem_123",
      "type": "PRE_DUE",
      "stageName": "Friendly reminder",
      "status": "DELIVERED",
      "sentAt": "2026-08-13T09:00:00.000Z",
      "recipient": "client@example.com",
      "subject": "Friendly reminder: Invoice INV-0042 due on Aug 20"
    }
  ]
}
```

---

## 12. Migration & Backward Compatibility

### 12.1 Existing Data

The current `ReminderConfig` schema will be extended (new columns added via Prisma migrate). Existing records retain their `remindBeforeDue`, `remindAfterDue`, `frequencyHours`, `maxReminders`, `emailSubject`, `emailTemplate` values. A migration script converts these into the new stage structure:

| Old field | → New stage |
|-----------|-------------|
| `remindBeforeDue` (e.g. 3) | `PRE_DUE` stage with `daysOffset = -3` |
| `remindAfterDue` (e.g. 1) | `POST_DUE` stage with `daysOffset = 1` |
| `emailSubject` / `emailTemplate` | Applied as the default template for all stages (overridable per stage after migration) |
| `frequencyHours`, `maxReminders` | Migrated to config-level fields unchanged |

### 12.2 Downgrade Path

If a new deployment runs against an un-migrated database, the `isMissingColumnError` pattern (established in `src/lib/org.ts:166` and used throughout `src/lib/actions/invoices.ts:152`) ensures the application continues to function with the old before/due/after logic. The settings UI will show a banner prompting the admin to apply migrations.

---

## 13. Glossary

| Term | Definition |
|------|------------|
| **ReminderConfig** | The per-organization top-level configuration that holds global settings and all stages. |
| **ReminderStage** | An individual trigger rule (pre-due, due-date, or post-due) within a config, with its own template, timing, and enable flag. |
| **Tiered / Escalating** | The sequence of reminders that increase in urgency as the invoice ages past its due date. |
| **Cron job** | The `/api/reminders/check` endpoint, invoked every 15 minutes by an external scheduler. Requires `x-api-key` auth. |
| **Deduplication** | The mechanism that ensures a given stage fires at most once per invoice, preventing duplicate emails. |
| **Template variable** | A `{{placeholder}}` token in email subject or body that is replaced with invoice/customer data at render time. |

---

## 14. Open Questions

1. **Time-of-day precision:** Should stages support time-of-day triggers (e.g., "send at 9 AM")? The 15-minute cron resolution may cause off-by-one issues. Consider switching to a per-stage `scheduledAt` approach where the engine computes exact send times and polls for due reminders.
2. **Customer opt-out:** Should customers be able to opt out of reminders (e.g., via an unsubscribe link in the email)? If so, a `ReminderSuppression` model is needed.
3. **SMS channel:** The `channel` field is designed for future SMS support, but no SMS provider is configured. Should this be deferred to a post-v1 enhancement?
4. **Invoice pausing:** Should marking an invoice as "Viewed" suppress the pre-due reminder but keep due-date and post-due active? This depends on view-tracking being reliable.
5. **Late fee coordination:** The existing `LateFeeConfig` (`prisma/schema.prisma:647`) applies late fees hourly. Should reminders reference the late fee in the email body once it has been applied?

---

*This specification is the authoritative design document for the Automated Reminders feature. All implementation work should reference this document. Comments or change requests should be filed as issues in the project repository.*
```
