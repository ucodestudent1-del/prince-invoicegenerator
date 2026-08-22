# Client Management System & Customer Portal — Functional Specification

## 1. Executive Summary

This specification defines two complementary modules for the Prince business management platform:

| Module | Audience | Purpose |
|--------|----------|---------|
| **Client Management System** | Internal team (contractors, admins) | Centralized backend for managing client profiles, financial history, and administrative actions |
| **Customer Portal** | External clients (customers) | Self-service hub for viewing invoices, making payments, and managing account details |

Together, these modules transform Prince from an invoicing tool into a complete business relationship management platform.

---

## 2. Client Management Module

### 2.1 Data Architecture

#### 2.1.1 Client Record Schema

```prisma
model Customer {
  // Identity
  id          String   @id @default(cuid())
  orgId       String
  org         Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  name        String   // Company name (e.g., "Acme Corporation")
  company    String?  // Legal company name (if different from display name)
  taxId      String?  // Tax ID / VAT number

  // Contact
  email       String   // Primary contact email
  phone       String?
  website     String?

  // Billing Address
  addressLine1 String?
  addressLine2 String?
  city         String?
  state        String?
  postalCode   String?
  country      String?

  // Portal Access
  portalAccess Boolean   @default(false) // Whether client has portal access
  portalPin    String?   // Secure PIN for portal authentication

  // Financial Summary (denormalized for performance)
  outstandingBalance Float @default(0)
  totalInvoiced      Float @default(0)
  totalPaid          Float @default(0)

  // Metadata
  notes       String?   // Internal notes (not visible to client)
  status      CustomerStatus @default(Active)
  archivedAt  DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  // Relations
  invoices    Invoice[]
  addresses   CustomerAddress[]
  creditNotes CreditNote[]

  @@index([orgId])
  @@index([orgId, status])
  @@unique([orgId, email])
}

enum CustomerStatus {
  ACTIVE
  ARCHIVED
  SUSPENDED
}
```

#### 2.1.2 Financial Summary Derivation

The denormalized financial fields are computed from related records:

```typescript
function computeCustomerFinancials(customerId: string) {
  return await db.$transaction(async (tx) => {
    const invoices = await tx.invoice.findMany({
      where: { customerId },
      select: { total: true, amountPaid: true, status: true },
    });

    const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.total, 0);
    const totalPaid = invoices.reduce((sum, inv) => sum + inv.amountPaid, 0);
    const outstandingBalance = totalInvoiced - totalPaid;

    return { totalInvoiced, totalPaid, outstandingBalance };
  });
}
```

### 2.2 User Interface

#### 2.2.1 Client List View

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Clients                                    [+ New Client]  [Search...]│
├─────────────────────────────────────────────────────────────────────────┤
│  Name              │ Email              │ Balance   │ Status │ Actions │
│  ──────────────────┼────────────────────┼───────────┼────────┼─────────│
│  Acme Corporation  │ billing@acme.com   │ $12,500   │ Active │ [⋯]     │
│  Globex Inc.       │ ap@globex.io       │ $0        │ Active │ [⋯]     │
│  Initech            │ finance@initech.co │ $3,200    │ Active │ [⋯]     │
│  ──────────────────┼────────────────────┼───────────┼────────┼─────────│
│  Umbrella Corp     │ accounts@umb.co    │ $890      │Archive │ [⋯]     │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 2.2.2 Client Detail View

The client detail page is organized into tabs:

| Tab | Content |
|-----|---------|
| **Overview** | Company info, financial summary (cards), quick actions |
| **Invoices** | Filterable list of all invoices with status, dates, amounts |
| **Estimates** | List of estimates sent to client |
| **Payments** | Payment history with dates, amounts, methods |
| **Communications** | Log of emails sent (invoices, reminders, manual) |
| **Settings** | Edit details, manage portal access, archive |

#### 2.2.3 Financial Summary Cards

```
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│   Total Invoiced    │  │    Total Paid       │  │   Outstanding       │
│                     │  │                     │  │                     │
│     $156,250.00     │  │     $143,750.00     │  │     $12,500.00      │
│                     │  │                     │  │                     │
│   24 invoices       │  │   22 payments       │  │   3 open invoices   │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘
```

### 2.3 Administrative Actions

#### 2.3.1 Document Generation

**Create Invoice**
1. Navigate to Client Detail → Invoices tab → "New Invoice"
2. Invoice form pre-fills client details from client record
3. On save: invoice linked to client; client's `totalInvoiced` recalculated

**Create Estimate**
1. Navigate to Client Detail → Estimates tab → "New Estimate"
2. Estimate form pre-fills client details
3. On save: estimate linked to client

#### 2.3.2 Financial Management

**Record Payment**
1. Navigate to Client Detail → Payments tab → "Record Payment"
2. Select invoice to apply payment to
3. Enter amount, date, method, optional note
4. On save:
   - Payment record created
   - Invoice `amountPaid` updated
   - Invoice status recalculated (PAID if fully paid)
   - Client financial summary recalculated

**Send Payment Reminder**
1. Navigate to Client Detail → Invoices tab → Select overdue invoice
2. Click "Send Reminder"
3. System sends templated email with payment link
4. Communication log entry created

#### 2.3.3 Profile Management

**Edit Client Details**
1. Navigate to Client Detail → Settings tab
2. Edit form pre-populated with current values
3. On save: changes persisted; audit log entry created

**Archive Client**
1. Navigate to Client Detail → Settings → "Archive Client"
2. Confirmation dialog: "Archiving hides this client from active lists. Invoices are preserved."
3. On confirm:
   - `status` set to `ARCHIVED`
   - `archivedAt` timestamp set
   - Client hidden from default list view (filterable to show)

### 2.4 Client History & Activity Log

The activity log aggregates all client interactions:

```typescript
interface ActivityLogEntry {
  id: string;
  type: "INVOICE_CREATED" | "INVOICE_SENT" | "INVOICE_PAID" | "ESTIMATE_CREATED" |
        "PAYMENT_RECEIVED" | "REMINDER_SENT" | "EMAIL_SENT" | "CLIENT_UPDATED";
  description: string;
  metadata: {
    invoiceId?: string;
    estimateId?: string;
    paymentId?: string;
    amount?: number;
    status?: string;
  };
  createdAt: Date;
  createdBy?: string; // User who triggered (null for system)
}
```

---

## 3. Customer Portal Module

### 3.1 Authentication & Security

#### 3.1.1 Portal Access Model

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Authentication Flow                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────────────┐  │
│   │  Email + PIN │────▶│  Magic Link  │────▶│  Session (JWT)       │  │
│   │  or Magic    │     │  via Email   │     │  7-day expiry        │  │
│   │  Link Only   │     │              │     │                      │  │
│   └──────────────┘     └──────────────┘     └──────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

| Method | How It Works | Security Level |
|--------|--------------|----------------|
| **Email Magic Link** | Customer enters email → system sends signed link → click to authenticate | High (email-verified) |
| **Email + PIN** | Customer enters email + 6-digit PIN → system validates → session created | Medium-High |
| **Single Sign-On** | (Future) OAuth via Google/Microsoft | High |

#### 3.1.2 Portal Session Schema

```prisma
model PortalSession {
  id          String   @id @default(cuid())
  customerId  String
  customer    Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  token       String   @unique // Signed JWT or opaque token
  expiresAt   DateTime
  lastAccessedAt DateTime @default(now())
  ipAddress   String?
  userAgent   String?
  revokedAt   DateTime?
  createdAt   DateTime @default(now())

  @@index([customerId])
  @@index([token])
}
```

### 3.2 Portal User Interface

#### 3.2.1 Portal Dashboard

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Acme Corporation                              [John Smith]  [Logout]  │
│  Welcome back, John                                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Financial Summary                                              │   │
│  │                                                                 │   │
│  │  Outstanding Balance:  $12,500.00    [Pay Now →]               │   │
│  │  Total Invoiced:       $156,250.00                              │   │
│  │  Total Paid:           $143,750.00                              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Recent Invoices                                          [View All →] │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  INV-024    Oct 15, 2026    $5,000.00    Overdue    [View]     │   │
│  │  INV-023    Sep 30, 2026    $3,750.00    Due        [View]     │   │
│  │  INV-022    Sep 15, 2026    $3,750.00    Paid       [View]     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 3.2.2 Invoice List View

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Invoices                                        [Filter ▼] [Search]    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  #        │ Date       │ Due Date   │ Amount    │ Status       │   │
│  │───────────┼────────────┼────────────┼───────────┼──────────────│   │
│  │  INV-024  │ Oct 15     │ Nov 15     │ $5,000.00 │ 🔴 Overdue   │   │
│  │  INV-023  │ Sep 30     │ Oct 30     │ $3,750.00 │ 🟡 Due       │   │
│  │  INV-022  │ Sep 15     │ Oct 15     │ $3,750.00 │ 🟢 Paid      │   │
│  │  INV-021  │ Aug 30     │ Sep 30     │ $8,500.00 │ 🟢 Paid      │   │
│  │  INV-020  │ Aug 15     │ Sep 15     │ $6,200.00 │ 🟢 Paid      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Showing 1-5 of 24 invoices            [< Prev] [1] [2] ... [5] Next >]│
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 3.2.3 Invoice Detail View (Portal)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Back to Invoices                                                     │
│                                                                         │
│  Invoice INV-024                                    Status: OVERDUE     │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  From:                    │  Bill To:                           │   │
│  │  Prince Construction      │  Acme Corporation                   │   │
│  │  123 Contractor St        │  456 Client Ave                     │   │
│  │  City, ST 12345           │  City, ST 67890                     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Description              │ Qty  │ Rate      │ Amount           │   │
│  │───────────────────────────┼──────┼───────────┼──────────────────│   │
│  │  Website Design           │ 1    │ $3,500.00 │ $3,500.00        │   │
│  │  SEO Optimization         │ 1    │ $1,500.00 │ $1,500.00        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│                              Subtotal:              $5,000.00           │
│                              Tax (8.5%):             $425.00           │
│                              ─────────────────────────────────          │
│                              Total:                 $5,425.00           │
│                              Amount Paid:          $0.00               │
│                              Balance Due:          $5,425.00           │
│                                                                         │
│  Issue Date: Oct 15, 2026        Due Date: Nov 15, 2026                │
│                                                                         │
│  [Pay Now ▼]    [Download PDF]    [Print]                              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Self-Service Capabilities

#### 3.3.1 Document Access

| Action | Implementation |
|--------|----------------|
| **View Invoice Details** | Click invoice row → detail view loads with full line items |
| **Download PDF** | Click "Download PDF" → `GET /api/invoices/[id]/pdf?token=<portal_token>` |
| **View Estimate Details** | Click estimate row → detail view with accept/reject buttons |
| **Download Estimate PDF** | Same flow as invoice PDF |

#### 3.3.2 Online Payments

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Pay Invoice INV-024                                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Balance Due: $5,425.00                                                 │
│                                                                         │
│  Payment Amount: [$5,425.00        ]                                    │
│                                                                         │
│  Payment Method:                                                        │
│  (●) Credit/Debit Card   ( ) ACH Transfer   ( ) Saved Card ••••4242   │
│                                                                         │
│  Card Number:    [                    ]                                │
│  Expiry:         [MM/YY]  CVV: [   ]                                   │
│  Cardholder Name: [                    ]                                │
│  Billing ZIP:    [                    ]                                │
│                                                                         │
│  [Cancel]                    [Pay $5,425.00 →]                         │
│                                                                         │
│  🔒 Payment processed securely by Stripe                               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Payment Flow:**
1. Customer clicks "Pay Now" on invoice detail
2. System creates Stripe PaymentIntent for invoice amount
3. Customer enters card details (Stripe Elements)
4. Stripe confirms payment → webhook received
5. System creates Payment record linked to invoice
6. Invoice `amountPaid` updated, status recalculated
7. Customer sees confirmation + receipt available for download

#### 3.3.3 Payment History & Receipts

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Payment History                                                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Date       │ Invoice  │ Amount    │ Method      │ Receipt      │   │
│  │─────────────┼──────────┼───────────┼─────────────┼──────────────│   │
│  │  Oct 1, 2026│ INV-022  │ $3,750.00 │ Card ••4242 │ [Download]   │   │
│  │  Sep 1, 2026│ INV-021  │ $8,500.00 │ ACH         │ [Download]   │   │
│  │  Aug 1, 2026│ INV-020  │ $6,200.00 │ Card ••4242 │ [Download]   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 3.3.4 Profile Management

Customers can update their own:
- Primary contact email
- Phone number
- Billing address
- Company name (if applicable)

**Editable Fields:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│  Account Settings                                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Company Information                                                    │
│  Company Name:     [Acme Corporation        ]                           │
│  Tax ID:           [12-3456789              ]                           │
│                                                                         │
│  Contact Information                                                    │
│  Email:            [billing@acme.com        ]                           │
│  Phone:            [(555) 123-4567          ]                           │
│  Website:          [www.acme.com            ]                           │
│                                                                         │
│  Billing Address                                                        │
│  Address Line 1:   [456 Client Avenue       ]                           │
│  Address Line 2:   [Suite 100               ]                           │
│  City:             [New York                ]                           │
│  State:            [NY                      ]                           │
│  ZIP Code:         [10001                   ]                           │
│  Country:          [United States           ]                           │
│                                                                         │
│  [Cancel]                              [Save Changes]                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.4 Portal Technical Requirements

#### 3.4.1 API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/portal/auth/request` | Public | Request magic link via email |
| `/api/portal/auth/verify` | Public | Verify magic link token, create session |
| `/api/portal/dashboard` | GET | Portal | Get financial summary |
| `/api/portal/invoices` | GET | Portal | List customer's invoices |
| `/api/portal/invoices/[id]` | GET | Portal | Get invoice details |
| `/api/portal/invoices/[id]/pay` | POST | Portal | Create Stripe PaymentIntent |
| `/api/portal/payments` | GET | Portal | List payment history |
| `/api/portal/payments/[id]/receipt` | GET | Portal | Download receipt PDF |
| `/api/portal/profile` | GET/PATCH | Portal | View/update profile |

#### 3.4.2 Portal Middleware

```typescript
// middleware/portal-auth.ts
export async function verifyPortalAccess(req: NextRequest) {
  const token = req.cookies.get("portal_token")?.value;
  if (!token) return null;

  const session = await db.portalSession.findUnique({
    where: { token },
    include: { customer: true },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    return null;
  }

  // Extend session on activity
  await db.portalSession.update({
    where: { id: session.id },
    data: { lastAccessedAt: new Date() },
  });

  return session;
}
```

#### 3.4.3 Security Considerations

| Concern | Mitigation |
|---------|------------|
| **Session hijacking** | HttpOnly cookies, 7-day expiry, IP logging |
| **Data isolation** | All queries scoped to `customerId` from session |
| **Brute force** | Rate limit magic link requests (5/hour per email) |
| **CSRF** | SameSite cookies, state parameter on auth |
| **Information leakage** | Customers can only see their own records |

---

## 4. Data Relationship Model

### 4.1 Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Data Relationships                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌──────────────┐         ┌──────────────┐         ┌──────────────┐  │
│   │Organization  │◄────────│   Customer   │◄────────│   Invoice    │  │
│   │              │   1:N   │              │   1:N   │              │  │
│   │ - id         │         │ - id         │         │ - id         │  │
│   │ - name       │         │ - orgId      │         │ - customerId │  │
│   │ - brandColor │         │ - name       │         │ - total      │  │
│   │ - accentColor│         │ - email      │         │ - amountPaid │  │
│   │ - logoUrl    │         │ - phone      │         │ - status     │  │
│   └──────────────┘         │ - balance    │         └──────┬───────┘  │
│                            │ - status     │                │          │
│                            └──────┬───────┘                │          │
│                                   │                        │          │
│                                   │ 1:N                    │ 1:N      │
│                                   ▼                        ▼          │
│                            ┌──────────────┐         ┌──────────────┐  │
│                            │   Portal     │         │   Payment    │  │
│                            │   Session    │         │              │  │
│                            │              │         │ - id         │  │
│                            │ - id         │         │ - invoiceId  │  │
│                            │ - customerId │         │ - amount     │  │
│                            │ - token      │         │ - method     │  │
│                            │ - expiresAt  │         │ - stripeId   │  │
│                            └──────────────┘         └──────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Key Relationships

| Parent | Child | Cardinality | Cascade |
|--------|-------|-------------|---------|
| Organization | Customer | 1:N | Delete customers when org deleted |
| Customer | Invoice | 1:N | Restrict delete (invoices preserved) |
| Customer | Estimate | 1:N | Restrict delete |
| Customer | PortalSession | 1:N | Cascade delete sessions |
| Invoice | Payment | 1:N | Restrict delete (payments preserved) |
| Invoice | InvoicePdf | 1:N | Cascade delete PDFs |
| Invoice | InvoiceAudit | 1:N | Cascade delete audit |

---

## 5. Implementation Plan

### Phase 1: Client Management Backend (Week 1-2)

- [ ] Add `CustomerStatus` enum to Prisma schema
- [ ] Add `archivedAt`, `notes` fields to Customer model
- [ ] Create migration for schema updates
- [ ] Build server actions: `getCustomers`, `getCustomerDetail`, `createCustomer`, `updateCustomer`, `archiveCustomer`
- [ ] Build API routes: `/api/customers`, `/api/customers/[id]`
- [ ] Recalculate financial summaries on invoice/payment events

### Phase 2: Client Management UI (Week 2-3)

- [ ] Build `/dashboard/customers` list page with search/filter
- [ ] Build `/dashboard/customers/[id]` detail page with tabs
- [ ] Implement quick actions (create invoice, record payment)
- [ ] Build client financial summary cards
- [ ] Implement activity log aggregation

### Phase 3: Portal Authentication (Week 3-4)

- [ ] Add `PortalSession` model + migration
- [ ] Build magic link email template
- [ ] Create `/api/portal/auth/request` endpoint
- [ ] Create `/api/portal/auth/verify` endpoint
- [ ] Build portal login page
- [ ] Implement portal session middleware

### Phase 4: Portal Dashboard & Invoices (Week 4-5)

- [ ] Build portal dashboard with financial summary
- [ ] Build portal invoice list with status badges
- [ ] Build portal invoice detail view
- [ ] Integrate PDF download (reuse existing PDF endpoint with portal token)
- [ ] Add responsive design for mobile portal

### Phase 5: Portal Payments (Week 5-6)

- [ ] Integrate Stripe Elements for card input
- [ ] Create PaymentIntent endpoint for portal
- [ ] Handle Stripe webhooks for payment confirmation
- [ ] Build payment confirmation page
- [ ] Generate receipt PDF for completed payments

### Phase 6: Portal Profile & Polish (Week 6)

- [ ] Build portal profile edit form
- [ ] Implement address validation
- [ ] Add communication preferences
- [ ] Final security audit and penetration testing
- [ ] Performance optimization (query caching, indexes)

---

## 6. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Client list load time | < 500ms | Server timing |
| Portal login success rate | > 95% | Auth analytics |
| Portal payment completion | > 80% | Stripe dashboard |
| Customer support tickets (billing) | -30% | Support system |
| Invoice payment speed | -2 days average | Invoice analytics |

---

## 7. Open Questions

1. **Multi-contact clients**: Should multiple contacts per company have separate portal access? → **Decision: Phase 2 — single primary contact for v1**

2. **Credit notes**: Should credit notes be visible in the portal? → **Decision: Yes, show as "Credits" in invoice list**

3. **Multi-language portal**: Should the portal support i18n? → **Decision: Phase 2 — English only for v1**

4. **Stripe vs. other payment processors**: Should we support PayPal/ACH beyond Stripe? → **Decision: Stripe only for v1; architecture should be processor-agnostic**
