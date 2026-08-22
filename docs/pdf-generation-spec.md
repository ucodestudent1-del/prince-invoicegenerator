# PDF Generation System — Technical Specification

## 1. Architecture Overview

### 1.1 Design Principles

| Principle | Implementation |
|-----------|---------------|
| **Pixel-perfect fidelity** | Single source of truth for both preview and PDF — the same HTML/CSS template renders in-browser and in the PDF engine |
| **Server-authoritative generation** | All PDFs are produced server-side to ensure consistency across clients and to enable automated email workflows |
| **Progressive enhancement** | In-browser preview is immediate; PDF generation is async with progress feedback |
| **Print-first CSS** | Stylesheets target `@media print` and PDF-specific selectors; no separate "PDF stylesheet" drift |

### 1.2 System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Browser                          │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐  │
│  │  InvoiceForm │──▶│  PreviewPane │──▶│  DownloadButton  │  │
│  │  (editable)  │   │  (live HTML) │   │  (client fetch)  │  │
│  └──────────────┘   └──────────────┘   └──────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Next.js Server                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              /api/invoices/[id]/pdf                      │   │
│  │  ┌─────────────┐   ┌──────────────┐   ┌────────────┐  │   │
│  │  │  Load Data  │──▶│  Render HTML │──▶│ Puppeteer  │  │   │
│  │  │  (Prisma)   │   │  (React SSR) │   │  (PDF gen) │  │   │
│  │  └─────────────┘   └──────────────┘   └────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              /api/invoices/[id]/send                      │   │
│  │  ┌─────────────┐   ┌──────────────┐   ┌────────────┐  │   │
│  │  │  Generate   │──▶│  Upload to   │──▶│  sendEmail │  │   │
│  │  │  PDF        │   │  R2 storage  │   │  (attach)  │  │   │
│  │  └─────────────┘   └──────────────┘   └────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Functionalities

### 2.1 High-Fidelity PDF Generation & Real-Time Preview

**Preview Strategy:** The invoice preview pane in the UI renders the exact same HTML/CSS template that will be used for PDF generation. This is achieved by:

- A shared React component (`<InvoiceTemplate />`) used by both the preview page and the PDF rendering endpoint
- CSS that uses `@media print` rules for screen→print parity
- No client-side "approximation" — the preview IS the PDF template

```tsx
// Shared template component (used in preview AND PDF generation)
export function InvoiceTemplate({ invoice, org }: InvoiceTemplateProps) {
  return (
    <div className="invoice-page" data-paper-size="a4">
      <header className="invoice-header">
        {org.logoUrl && <img src={org.logoUrl} className="invoice-logo" />}
        <div className="invoice-meta">
          <h1>INVOICE</h1>
          <p>{invoice.number}</p>
        </div>
      </header>
      {/* ... rest of invoice layout */}
    </div>
  );
}
```

### 2.2 Client-Side and Server-Side Download

| Method | Route | Use Case |
|--------|-------|----------|
| **Server-side (recommended)** | `GET /api/invoices/[id]/pdf` | Primary path — always up-to-date, supports email workflows |
| **Client-side (fallback)** | Browser print dialog (`window.print()`) | Quick local saves; CSS `@media print` handles formatting |
| **Direct download** | `<a download>` with PDF blob | After client fetches from `/api/invoices/[id]/pdf` |

### 2.3 Print-Optimized Formatting

```css
/* Print-specific styles — applied to both screen preview and PDF */
@media print {
  @page {
    size: A4;
    margin: 15mm 12mm;
  }

  body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .invoice-page {
    page-break-after: always;
    box-shadow: none !important;
    border: none !important;
  }

  .no-print { display: none !important; }
  .print-only { display: block !important; }
}
```

### 2.4 Automated Email Attachment Workflow

```
User clicks "Send Invoice"
        │
        ▼
POST /api/invoices/[id]/send
        │
        ├─▶ Generate PDF via Puppeteer
        ├─▶ Upload PDF to R2 (Cloudflare)
        ├─▶ Create InvoicePdf record (DB)
        ├─▶ Attach PDF buffer to email (Resend/SMTP)
        ├─▶ Update invoice status: DRAFT → SENT
        ├─▶ Log InvoiceAudit entry (action: "SENT")
        └─▶ Return success + PDF URL
```

### 2.5 Responsive Design

The invoice preview must be legible on mobile devices:

- Preview container uses responsive scaling (transform: scale() or CSS zoom on small screens)
- PDF itself is fixed-layout (A4/Letter) — designed for print, not mobile reading
- Mobile users see a scaled-down preview with pinch-to-zoom or a "View full size" button

```css
/* Mobile preview scaling */
@media screen and (max-width: 768px) {
  .invoice-preview-container {
    transform: scale(0.5);
    transform-origin: top left;
    width: 200%; /* compensate for scale */
    height: 200%;
  }
}
```

---

## 3. Technical Specifications

### 3.1 Paper Sizes

| Paper | Dimensions (mm) | Dimensions (in) | Primary Region |
|-------|-----------------|-----------------|----------------|
| **A4** | 210 × 297 | 8.27 × 11.69 | International |
| **Letter** | 215.9 × 279.4 | 8.5 × 11 | United States |
| **Legal** | 215.9 × 355.6 | 8.5 × 14 | US (legal docs) |

```typescript
const PAPER_SIZES = {
  A4:     { width: '210mm', height: '297mm' },
  LETTER: { width: '215.9mm', height: '279.4mm' },
  LEGAL:  { width: '215.9mm', height: '355.6mm' },
} as const;
```

### 3.2 Recommended Libraries

| Layer | Library | Purpose | Rationale |
|-------|---------|---------|-----------|
| **PDF Engine** | `puppeteer` | Server-side HTML→PDF conversion | Full CSS support, pixel-perfect rendering, Chromium-based |
| **HTML Rendering** | React `renderToString()` | Generate HTML from shared components | Single source of truth; no template duplication |
| **Storage** | Cloudflare R2 | Store generated PDFs | S3-compatible, free egress, integrates with existing photo storage |
| **Email** | `resend` (existing) | Send PDF as attachment | Already integrated in codebase |
| **Client-side fallback** | `react-to-print` or native `window.print()` | Quick local prints | No server dependency |

### 3.3 CSS Styling Consistency Strategy

The #1 risk in PDF generation is style drift between browser preview and PDF output. Our strategy:

1. **Single template component** — `<InvoiceTemplate />` is the only component that defines invoice layout. Both the preview page and the PDF endpoint import it.

2. **CSS-in-JS or Tailwind with print utilities** — All styling goes through the same class system. No separate "PDF stylesheets."

3. **Puppeteer uses the same CSS files** — The HTML sent to Puppeteer includes the same compiled CSS bundle the browser uses.

4. **Print-specific overrides in `@media print`** — Any adjustments needed only for PDF (hiding UI chrome, adjusting margins) live in print media queries.

5. **Visual regression testing** — Render the template to PNG via Puppeteer, compare against approved snapshots using pixelmatch.

```typescript
// PDF endpoint: renders the SAME template the browser uses
export async function generateInvoicePdf(invoiceId: string): Promise<Buffer> {
  const invoice = await getInvoiceData(invoiceId);
  const org = await getOrgData(invoice.orgId);

  // Render the shared template to HTML string
  const html = renderToString(<InvoiceTemplate invoice={invoice} org={org} />);

  // Wrap with proper doctype, CSS link, and print-optimized meta tags
  const fullHtml = wrapForPdf(html, { paperSize: 'A4' });

  // Launch Puppeteer and generate PDF
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: '15mm', right: '12mm', bottom: '15mm', left: '12mm' },
  });

  await browser.close();
  return pdfBuffer;
}
```

---

## 4. Workflow Logic

### 4.1 End-to-End Process Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        USER CLICKS "GENERATE PDF"                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  1. VALIDATE                                                            │
│     • Invoice exists and belongs to user's org                        │
│     • Invoice has at least one line item                              │
│     • User has permission (read own; admins read all)                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  2. FETCH DATA                                                          │
│     • Invoice record (with items, customer, project, org)              │
│     • Line items (sorted by sortOrder)                                 │
│     • Tax calculations (subtotal, taxAmount, total)                    │
│     • Organization branding (logo, colors, address)                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  3. RENDER HTML                                                         │
│     • ReactDOMServer.renderToString(<InvoiceTemplate />)               │
│     • Inject compiled CSS (Tailwind output)                            │
│     • Apply paper size meta (A4 / Letter)                              │
│     • Set lang attribute for accessibility                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  4. GENERATE PDF (Puppeteer)                                           │
│     • Set content with networkidle0 wait                               │
│     • PDF options: printBackground, preferCSSPageSize, margins         │
│     • Return PDF buffer                                                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
┌──────────────────────────────────┐  ┌──────────────────────────────────┐
│  5a. DOWNLOAD                    │  │  5b. EMAIL                       │
│  • Return buffer as response     │  │  • Upload PDF to R2 storage      │
│  • Content-Type: application/pdf│  │  • Create InvoicePdf DB record   │
│  • Content-Disposition: attach  │  │  • Call sendEmail with buffer    │
│  • Cache-Control: private       │  │  • Update status: SENT           │
└──────────────────────────────────┘  │  • Log audit entry               │
                                    └──────────────────────────────────┘
```

### 4.2 API Endpoints

```typescript
// GET /api/invoices/[id]/pdf
// Returns: PDF file for download/inline view
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await requireUser();
  const invoice = await getInvoiceWithAuth(params.id, user.organizationId);

  const pdfBuffer = await generateInvoicePdf(invoice.id);

  return new NextResponse(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${invoice.number}.pdf"`,
      'Content-Length': pdfBuffer.length.toString(),
      'Cache-Control': 'private, no-cache, no-store',
    },
  });
}

// POST /api/invoices/[id]/pdf
// Body: { paperSize?: 'A4' | 'Letter' | 'Legal' }
// Returns: { url: string } (R2 download URL for the generated PDF)
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await requireUser();
  const { paperSize = 'A4' } = await req.json();
  const invoice = await getInvoiceWithAuth(params.id, user.organizationId);

  const pdfBuffer = await generateInvoicePdf(invoice.id, { paperSize });
  const r2Url = await uploadPdfToR2(pdfBuffer, invoice.number);

  await db.invoicePdf.create({
    data: { orgId: user.organizationId, invoiceId: invoice.id, url: r2Url, paperSize },
  });

  return NextResponse.json({ url: r2Url });
}
```

### 4.3 Database Schema Additions

```prisma
model InvoicePdf {
  id        String   @id @default(cuid())
  orgId     String
  org       Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  invoiceId String
  invoice   Invoice  @relation(fields: [invoiceId], references: [id], onDelete: Cascade)

  url       String   // R2 download URL
  paperSize String   @default("A4")
  fileSize  Int?     // bytes
  createdAt DateTime @default(now())

  @@index([invoiceId])
  @@index([orgId])
}
```

### 4.4 Storage Strategy

| Storage | Purpose | Retention |
|---------|---------|-----------|
| **R2 (Cloudflare)** | Persistent PDF storage for email attachments and re-downloads | 90 days (regenerated on-demand after) |
| **Memory buffer** | Immediate response to download/email request | Ephemeral |
| **Browser cache** | Avoid re-downloading same PDF in one session | Session-only |

---

## 5. Implementation Plan

### Phase 1: Core PDF Generation

- [ ] Add `puppeteer` dependency (bundled Chromium for serverless; use `@sparticuz/chromium` for Vercel/serverless)
- [ ] Create shared `InvoiceTemplate` React component (extracted from existing print page)
- [ ] Implement `/api/invoices/[id]/pdf` endpoint (GET for download, POST for R2 upload)
- [ ] Add PDF preview iframe in invoice detail page

### Phase 2: Template System

- [ ] Build CSS for print parity (`@media print`, `@page` rules)
- [ ] Support A4/Letter/Legal paper sizes via query param
- [ ] Ensure brand colors, fonts, and logos render correctly in PDF
- [ ] Handle multi-page invoices (page break logic, repeating headers)

### Phase 3: Storage & Email

- [ ] Add `InvoicePdf` model to Prisma schema + migration
- [ ] Implement R2 upload utility (reuse existing `photo.ts` patterns)
- [ ] Integrate PDF attachment into existing `sendEmail` flow
- [ ] Add PDF status indicator to invoice detail UI

### Phase 4: Client Experience

- [ ] "Download PDF" button on invoice detail and list pages
- [ ] "Print" button triggering `window.print()` with print-optimized CSS
- [ ] PDF preview modal with zoom controls
- [ ] Mobile-responsive preview scaling

### Phase 5: Testing & Optimization

- [ ] Visual regression tests (Puppeteer screenshot vs approved baseline)
- [ ] PDF generation performance benchmarking (target: < 3 seconds)
- [ ] Memory leak testing for Puppeteer browser instances
- [ ] Edge cases: empty line items, long descriptions, unicode characters

---

## 6. Key Technical Decisions

### 6.1 Why Puppeteer over alternatives?

| Alternative | Pros | Cons | Verdict |
|-------------|------|------|---------|
| **Puppeteer** | Full CSS support, pixel-perfect, Chromium rendering | Heavy (Chromium ~150MB), slower startup | ✅ **Chosen** — fidelity is the top requirement |
| **jsPDF** | Lightweight, no browser needed | Limited CSS, manual layout coding | ❌ Not pixel-perfect |
| **react-pdf** | React-native PDF creation | New layout language, no CSS reuse | ❌ Template duplication |
| **@react-pdf/renderer** | Declarative PDF | Separate template, CSS-incompatible | ❌ Template duplication |
| **Browser Print** | Zero dependencies | No automation, no email attachment | ⚠️ Fallback only |

### 6.2 Puppeteer Deployment Strategy

For production (Railway/Docker):

```typescript
// lib/puppeteer.ts
import puppeteer from "puppeteer";

let browserInstance: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

export async function getBrowser() {
  if (!browserInstance) {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--single-process",
      ],
    });
  }
  return browserInstance;
}

// Graceful shutdown for serverless
export async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}
```

### 6.3 CSS Strategy for Pixel-Perfect Output

```css
/* Base invoice styles (screen + print) */
.invoice-page {
  width: 210mm;
  min-height: 297mm;
  padding: 15mm 12mm;
  margin: 0 auto;
  background: white;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 10pt;
  line-height: 1.4;
  color: #111827;
}

/* Screen-only: add shadow and centering for preview */
@media screen {
  .invoice-page {
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    margin: 2rem auto;
  }
}

/* Print/PDF: remove screen decorations */
@media print {
  @page {
    size: A4;
    margin: 0;
  }

  .invoice-page {
    box-shadow: none;
    margin: 0;
  }

  .no-print,
  .no-print * {
    display: none !important;
  }
}
```

---

## 7. Error Handling & Edge Cases

| Scenario | Handling |
|----------|----------|
| Puppeteer fails to launch | Return 503 with retry-after header; log to error tracking |
| Invoice not found | Return 404 with clear message |
| User lacks permission | Return 403 (same as other invoice endpoints) |
| R2 upload fails | Fall back to direct buffer response; log warning |
| Email send fails | Return 502; PDF still available for manual download |
| Long invoice (10+ pages) | Automatic page breaks; repeating header/footer |
| Unicode/special characters | Embed web-safe fonts; fallback to system fonts |
| Large logo images | Resize to max 300px width; compress before render |

---

## 8. Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| PDF generation time | < 3 seconds | Server-side timing |
| PDF file size | < 500 KB | Buffer length |
| Time to first byte (preview) | < 200 ms | Client-side measurement |
| Concurrent PDF generations | 5 | Puppeteer browser pool |
| Memory per generation | < 100 MB | Node.js heap snapshot |

---

## 9. Security Considerations

- **Authentication**: All PDF endpoints require valid session (reuse `requireUser`)
- **Authorization**: User must belong to invoice's organization
- **Rate limiting**: Max 10 PDF generations per minute per user (prevent abuse)
- **File validation**: PDF buffer validated as `%PDF` magic bytes before storage
- **URL signing**: R2 download URLs are signed with 1-hour expiry for email links
- **No data leakage**: PDFs never cached in CDN; always served through auth check

---

## 10. Open Questions

1. **Serverless vs. dedicated**: Puppeteer in serverless (Vercel) requires `@sparticuz/chromium` and has cold-start penalties. Railway/Docker is simpler. Decision: **Railway/Docker for now; document serverless path for future.**

2. **PDF caching**: Should we cache generated PDFs or regenerate each time? Decision: **Regenerate on each request** (data may change; storage is cheap; avoids stale PDF issues).

3. **Watermark on unpaid invoices**: Should overdue/unpaid invoices include a watermark? Decision: **Phase 2 enhancement** — add `watermarkText` prop to template.

4. **Multi-currency formatting**: Currency symbols and decimal places vary by locale. Decision: **Use `Intl.NumberFormat` with invoice.currency** (already implemented in `formatCurrency`).
