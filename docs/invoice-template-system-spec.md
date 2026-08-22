# Invoice Template System — Technical Specification & Implementation Plan

## 1. Executive Summary

This document specifies a replacement for the current invoice template system. The existing implementation relies on a single `InvoiceTemplate` model with a handful of boolean toggles, inline-styled React components, and a Puppeteer-based PDF generator with no pagination logic. The new system introduces a **modular, style-driven architecture** with six distinct design languages, granular per-organization customization, and a robust PDF rendering pipeline.

---

## 2. Current State Assessment

### 2.1 What Exists Today

| Layer | Current Implementation | Gaps |
|---|---|---|
| **Schema** | `InvoiceTemplate` model (basic booleans), `Organization.template` (enum: STANDARD, MODERN, MINIMAL, CLASSIC) | No per-template customization storage; settings scattered across `Organization` columns |
| **Rendering** | `invoice-template.tsx` (PDF) + `invoices/[id]/print/page.tsx` (print view) | Two divergent code paths, inline styles, no shared component library |
| **PDF Engine** | Puppeteer renders React to HTML → PDF | No pagination, no page-break logic, no table overflow handling |
| **Customization UI** | `template-customization-settings.tsx` | Only template, brand color, accent color, font family, layout — no column visibility, date format, or currency controls |

### 2.2 Root Issues

1. **Style logic is entangled with data logic** — `invoice-template.tsx` mixes layout, styling, and business data in one component.
2. **No modularity** — Cannot swap header/footer/table independently; must edit the entire component.
3. **PDF quality** — Long invoices overflow awkwardly; no row-level page-break avoidance.
4. **Limited design palette** — Only 4 styles; missing Corporate, Creative, Professional variants.
5. **No preview fidelity** — Browser preview and PDF output can diverge because styles are inline and environment-dependent.

---

## 3. Target Architecture

### 3.1 High-Level Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Presentation Layer                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Template     │  │ Customization│  │ Live Preview     │  │
│  │ Selector     │  │ Engine (UI)  │  │ Component        │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Data Layer                              │
│  ┌────────────────┐  ┌──────────────────────────────────┐   │
│  │ InvoiceTemplate│  │ OrganizationTemplateOverride     │   │
│  │ (style def)    │  │ (per-org customization)          │   │
│  └────────────────┘  └──────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Rendering Pipeline                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Style Engine │  │ Component    │  │ PDF Generator    │  │
│  │ (6 themes)   │  │ Registry     │  │ (Puppeteer +     │  │
│  │              │  │              │  │  page-break CSS) │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Design Principles

1. **Separation of Concerns** — Style definitions, business data, and layout logic live in separate modules.
2. **Composition over Inheritance** — Header, footer, table, and totals are independent composable components.
3. **CSS-First Styling** — Move from inline styles to scoped CSS classes with CSS custom properties for theming.
4. **SSR-Safe PDF Pipeline** — The same React component tree renders for both browser print and Puppeteer PDF.
5. **Graceful Degradation** — Missing customizations fall back to sensible defaults per style.

---

## 4. Template Architecture

### 4.1 Six Design Styles

Each style is a **named configuration object** that defines:
- Typography scale (font family, heading sizes, body size)
- Color tokens (primary, secondary, text, border, background)
- Spacing rhythm (padding, gaps, section margins)
- Component defaults (badge style, table header treatment, total line emphasis)

| Style | Characteristics | Best For |
|---|---|---|
| **Minimal** | High whitespace, thin borders, monochrome with one accent color, sans-serif typography | Freelancers, consultants |
| **Modern** | Contemporary typography (Inter/Roboto), subtle shadows, rounded corners, gradient accents | Tech firms, startups |
| **Professional** | Balanced proportions, standard business aesthetic, clear hierarchy, blue/neutral palette | Established SMBs |
| **Corporate** | Formal, structured, high-density, multi-column headers, strict grid, serif or sans-serif options | Enterprises |
| **Creative** | Unique layouts, bold typography, asymmetric headers, non-traditional spacing, vibrant colors | Agencies, designers |
| **Classic** | Traditional serif-based (Playfair Display/Merriweather), formal business styling, understated elegance | Law firms, accounting |

### 4.2 Style Token Schema

```ts
interface TemplateStyleConfig {
  id: TemplateStyleId;           // MINIMAL | MODERN | PROFESSIONAL | CORPORATE | CREATIVE | CLASSIC
  label: string;                 // Human-readable name
  description: string;           // One-line description for UI
  typography: {
    fontFamily: string;          // CSS font-family stack
    headingWeight: number;       // 400-900
    bodyWeight: number;
    lineHeight: number;          // 1.2-1.8
  };
  colors: {
    primary: string;             // Main brand color
    secondary: string;           // Accent/secondary
    text: string;                // Body text
    textMuted: string;           // Secondary text
    border: string;              // Table/divider borders
    background: string;          // Page background
    surface: string;             // Card/section background
  };
  spacing: {
    pagePadding: string;         // e.g., "24mm"
    sectionGap: string;          // e.g., "1.5rem"
    headerMarginBottom: string;
    tableRowPadding: string;
  };
  components: {
    headerVariant: "centered" | "left-right" | "minimal" | "banner";
    footerVariant: "simple" | "detailed" | "none";
    badgeStyle: "pill" | "square" | "underline";
    totalLineStyle: "border-top" | "background" | "bold-only";
    tableHeaderStyle: "solid" | "light" | "bordered";
  };
  defaults: {
    paperSize: "A4" | "Letter" | "Legal";
    showCompanyName: boolean;
    showCompanyAddress: boolean;
    showCompanyPhone: boolean;
    showCompanyEmail: boolean;
    showTaxId: boolean;
    showPaymentInfo: boolean;
    columnVisibility: ColumnConfig;
  };
}
```

### 4.3 Component Registry

The renderer composes invoices from these **atomic components**:

| Component | Responsibility | Props |
|---|---|---|
| `InvoiceHeader` | Logo, company info, invoice title/number, dates | `org`, `invoice`, `styleConfig` |
| `InvoiceBillTo` | Bill-to / Ship-to blocks | `invoice`, `styleConfig` |
| `InvoiceMeta` | Project, type badge, PO number | `invoice`, `styleConfig` |
| `InvoiceLineItems` | Table with row-level page-break avoidance | `items`, `columns`, `styleConfig` |
| `InvoiceTotals` | Subtotal, tax, discount, retainage, grand total | `invoice`, `styleConfig` |
| `InvoiceNotes` | Notes/terms section | `invoice`, `styleConfig` |
| `InvoiceFooter` | Footer with payment info, page numbers | `org`, `invoice`, `styleConfig` |

Each component receives a **merged config**: `{ ...styleDefaults, ...orgOverrides }`.

---

## 5. Customization Engine

### 5.1 Data Model Changes

#### 5.1.1 New `InvoiceTemplate` Model

Replace the current `InvoiceTemplate` with a richer model:

```prisma
model InvoiceTemplate {
  id               String   @id @default(cuid())
  orgId            String
  org              Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  name             String
  styleId          TemplateStyleId @default(PROFESSIONAL)
  isDefault        Boolean  @default(false)

  // Branding overrides (null = use style defaults)
  logoUrl          String?
  primaryColor     String?
  secondaryColor   String?
  fontFamily       String?
  fontSize         Float?   @default(10)  // pt

  // Layout overrides
  paperSize        PaperSize @default(A4)
  headerVariant    String?  @default("left-right")
  footerVariant    String?  @default("simple")
  invoiceTitle     String?  @default("Invoice")

  // Data display
  columnVisibility Json?   // { description: true, qty: true, rate: true, amount: true }
  dateFormat       String? @default("MM/DD/YYYY")
  currencyFormat   String? @default("symbol")  // "symbol" | "code" | "name"

  // Payment / branding
  paymentInstructions String?
  showPoweredBy    Boolean  @default(true)

  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@index([orgId])
  @@unique([orgId, name])
}
```

#### 5.1.2 Supporting Enums

```prisma
enum TemplateStyleId {
  MINIMAL
  MODERN
  PROFESSIONAL
  CORPORATE
  CREATIVE
  CLASSIC
}

enum PaperSize {
  A4
  LETTER
  LEGAL
}
```

#### 5.1.3 Organization Changes

The existing `Organization.template`, `brandColor`, `accentColor`, `fontFamily`, `layout` columns become **fallback-only**. New templates are created per-organization and selected explicitly. The `isDefault` flag on `InvoiceTemplate` identifies the template used when no explicit selection is made.

### 5.2 Customization Parameters (Granular Control)

#### 5.2.1 Branding

| Parameter | Type | Default | Description |
|---|---|---|---|
| `logoUrl` | String? | null | URL to uploaded logo image |
| `primaryColor` | String? | null | Overrides style primary color |
| `secondaryColor` | String? | null | Overrides style secondary/accent color |
| `fontFamily` | String? | null | Overrides style font family |
| `fontSize` | Float? | 10 | Base font size in points |

#### 5.2.2 Layout

| Parameter | Type | Default | Description |
|---|---|---|---|
| `paperSize` | PaperSize | A4 | Output page dimensions |
| `headerVariant` | String? | "left-right" | Header layout variant |
| `footerVariant` | String? | "simple" | Footer content density |
| `invoiceTitle` | String? | "Invoice" | Title text (e.g., "INVOICE", "ESTIMATE", "PROPOSAL") |

#### 5.2.3 Data Display

| Parameter | Type | Default | Description |
|---|---|---|---|
| `columnVisibility` | Json? | all true | `{ description, qty, rate, amount }` toggles |
| `dateFormat` | String? | "MM/DD/YYYY" | Output date pattern |
| `currencyFormat` | String? | "symbol" | `"symbol"` ($), `"code"` (USD), `"name"` (US Dollar) |

### 5.3 Customization UI Flow

```
TemplateSelector (style picker)
        │
        ▼
TemplateCustomizer (tabs: Branding / Layout / Data Display)
        │
        ├── Branding Tab
        │   ├── Logo upload (drag & drop + preview)
        │   ├── Primary color picker
        │   ├── Secondary color picker
        │   ├── Font family dropdown
        │   └── Font size slider (8pt - 14pt)
        │
        ├── Layout Tab
        │   ├── Paper size selector (A4 / Letter / Legal)
        │   ├── Header variant dropdown
        │   ├── Footer variant dropdown
        │   └── Invoice title input
        │
        └── Data Display Tab
            ├── Column visibility checkboxes (Description, Qty, Rate, Amount)
            ├── Date format dropdown
            └── Currency format dropdown
        │
        ▼
LivePreview (side-by-side or modal)
        │
        ▼
Save → Server Action → DB
```

---

## 6. PDF Generation Requirements

### 6.1 Rendering Pipeline

```
Invoice Data + Template Config
            │
            ▼
    Style Engine Resolver
    (merges style defaults + org overrides)
            │
            ▼
    Component Registry Renderer
    (Header → BillTo → Meta → LineItems → Totals → Notes → Footer)
            │
            ▼
    HTML String (ReactDOMServer.renderToString)
            │
            ▼
    CSS Injection (scoped classes + print media queries)
            │
            ▼
    Puppeteer
    ├── setContent(html)
    ├── waitForNetworkIdle
    └── page.pdf({
          width: paperSize.width,
          height: paperSize.height,
          printBackground: true,
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
          scale: 2,
        })
            │
            ▼
    PDF Buffer → Store as InvoicePdf
```

### 6.2 Pagination & Page-Break Logic

The table component must handle overflow intelligently:

```css
/* Scoped to PDF render only */
.invoice-pdf .line-items-table {
  width: 100%;
  border-collapse: collapse;
}

.invoice-pdf .line-items-table thead {
  display: table-header-group; /* Repeat header on new pages */
}

.invoice-pdf .line-items-table tr {
  page-break-inside: avoid; /* Keep rows intact */
  break-inside: avoid;
}

.invoice-pdf .line-items-table tbody tr:last-child {
  /* Ensure last row doesn't orphan */
}

.invoice-pdf .totals-section {
  page-break-before: auto; /* Push totals to next page if table overflows */
  break-before: auto;
}

.invoice-pdf .notes-section {
  page-break-before: always; /* Always start notes on new page if needed */
  break-before: always;
}
```

**Intelligent pagination rules:**
1. Table headers repeat on every page (`display: table-header-group`).
2. No row splits across pages (`break-inside: avoid` on `<tr>`).
3. Totals section stays with the last 2-3 rows if possible; otherwise flows naturally.
4. Notes/terms always start on a new page if they would otherwise appear in the footer margin.
5. Footer (page numbers, payment info) appears on every page.

### 6.3 Data Integrity

| Requirement | Implementation |
|---|---|
| International currencies | Use `Intl.NumberFormat` with `invoice.currency` code; support `currencyFormat` toggle |
| Customer details | Full Bill-To block with name, company, email, address; optional Ship-To |
| Payment instructions | Render from `Organization.paymentInfo.paymentInstructions` or template override |
| Multi-page totals | Totals recalculate correctly regardless of page breaks (all data is in memory) |
| High-resolution output | `scale: 2` in Puppeteer; `printBackground: true` for colored elements |

### 6.4 PDF Output Schema

```ts
interface GeneratedPdf {
  id: string;
  invoiceId: string;
  templateId: string;
  buffer: Buffer;
  pageCount: number;
  paperSize: PaperSize;
  createdAt: Date;
}
```

---

## 7. Implementation Plan

### Phase 1: Foundation (Week 1)

**Goal:** Establish the style token system and component registry without breaking existing rendering.

| Task | Files | Commands |
|---|---|---|
| 1.1 Add enums to Prisma schema | `prisma/schema.prisma` | Add `TemplateStyleId`, `PaperSize` enums |
| 1.2 Migrate `InvoiceTemplate` model | `prisma/schema.prisma` | Add new fields (branding, layout, data display) |
| 1.3 Create style token configs | `src/lib/template-styles.ts` | Define 6 `TemplateStyleConfig` objects |
| 1.4 Create CSS custom property system | `src/styles/invoice-tokens.css` | Scoped CSS vars per style |
| 1.5 Create component registry types | `src/lib/template-registry.ts` | Define component prop interfaces |

**Migration:**
```bash
npx prisma migrate dev --name expand_invoice_template
npx prisma generate
```

**Verification:**
```bash
npm run typecheck
npm run lint
```

### Phase 2: Component Modularization (Week 2)

**Goal:** Refactor `invoice-template.tsx` into composable components backed by style tokens.

| Task | Files | Details |
|---|---|---|
| 2.1 Create atomic components | `src/components/invoice/header.tsx`, `bill-to.tsx`, `meta.tsx`, `line-items.tsx`, `totals.tsx`, `notes.tsx`, `footer.tsx` | Each accepts `styleConfig` + data props |
| 2.2 Create style resolver | `src/lib/template-resolver.ts` | Merges `TemplateStyleConfig` + `InvoiceTemplate` overrides + `Organization` fallbacks |
| 2.3 Create main composer | `src/components/invoice/renderer.tsx` | Composes atomic components in order |
| 2.4 Migrate print page | `src/app/[locale]/dashboard/invoices/[id]/print/page.tsx` | Use new renderer instead of inline JSX |

**Verification:**
- Render each of the 6 styles in the browser and verify visual correctness.
- Print preview in Chrome DevTools matches PDF output.

### Phase 3: PDF Pipeline Hardening (Week 3)

**Goal:** Implement pagination, page-break logic, and high-fidelity output.

| Task | Files | Details |
|---|---|---|
| 3.1 Add print CSS | `src/styles/invoice-print.css` | `@media print` rules, `break-inside: avoid`, `display: table-header-group` |
| 3.2 Update PDF generator | `src/lib/pdf-generator.ts` | Inject print CSS into Puppeteer HTML wrapper |
| 3.3 Add page count detection | `src/lib/pdf-generator.ts` | Parse PDF metadata or use Puppeteer `page.pdf()` options |
| 3.4 Add overflow handling | `src/components/invoice/line-items.tsx` | Dynamic row splitting logic if table exceeds page height |
| 3.5 Store generated PDFs | `src/app/api/invoices/[id]/pdf/route.ts` | Save to `InvoicePdf` table, serve on demand |

**Verification:**
- Generate PDFs with 50+, 100+, 200+ line items.
- Verify no row splits, headers repeat, totals stay with data.
- Check file size and rendering time.

### Phase 4: Customization Engine (Week 4)

**Goal:** Build the UI for granular template customization.

| Task | Files | Details |
|---|---|---|
| 4.1 Server actions | `src/lib/actions/templates.ts` | CRUD for `InvoiceTemplate`, default management |
| 4.2 Template list page | `src/app/[locale]/dashboard/settings/templates/page.tsx` | List, create, delete, set-default |
| 4.3 Template editor page | `src/app/[locale]/dashboard/settings/templates/[id]/page.tsx` | Full customization form |
| 4.4 Live preview component | `src/components/template-live-preview.tsx` | Real-time preview as user edits |
| 4.5 API routes | `src/app/api/templates/route.ts` | GET list, POST create |

**Verification:**
- Create a template, customize all parameters, save, and verify it appears in selector.
- Set as default, create new invoice, verify template is applied.

### Phase 5: Migration & Polish (Week 5)

**Goal:** Migrate existing data, deprecate old fields, and polish UX.

| Task | Files | Details |
|---|---|---|
| 5.1 Data migration script | `prisma/migrations/XXXX_migrate_templates/` | Map old `Organization.template` values to new `InvoiceTemplate` records |
| 5.2 Backfill defaults | Script | Create default `InvoiceTemplate` for every existing org |
| 5.3 Deprecate old columns | `prisma/schema.prisma` | Mark `Organization.template`, `brandColor`, `accentColor`, `fontFamily`, `layout` as deprecated (keep for 1 release, then remove) |
| 5.4 Update invoice creation | `src/lib/actions/invoices.ts` | Use `InvoiceTemplate` instead of `Organization` fields |
| 5.5 Update dashboard/invoice pages | All invoice views | Use new renderer |

**Verification:**
- All existing invoices render correctly with migrated templates.
- No references to deprecated `Organization` styling columns in new code.

---

## 8. Detailed File Structure (Post-Implementation)

```
src/
├── lib/
│   ├── template-styles.ts              # 6 style configs + token definitions
│   ├── template-resolver.ts            # Merges style + org overrides
│   ├── template-registry.ts            # Component registry types
│   ├── pdf-generator.ts                # Updated Puppeteer pipeline
│   └── actions/
│       └── templates.ts                # Template CRUD server actions
├── components/
│   ├── invoice/
│   │   ├── renderer.tsx                # Main composer
│   │   ├── header.tsx                  # Atomic: header
│   │   ├── bill-to.tsx                 # Atomic: bill-to/ship-to
│   │   ├── meta.tsx                    # Atomic: project, type, PO
│   │   ├── line-items.tsx              # Atomic: table with page-break logic
│   │   ├── totals.tsx                  # Atomic: subtotal/tax/total
│   │   ├── notes.tsx                   # Atomic: notes/terms
│   │   └── footer.tsx                  # Atomic: footer, page numbers
│   ├── template-customization-settings.tsx
│   ├── template-live-preview.tsx
│   └── template-selector.tsx
├── styles/
│   ├── invoice-tokens.css              # CSS custom properties per style
│   └── invoice-print.css               # Print media queries, page breaks
├── app/
│   ├── api/
│   │   ├── templates/route.ts          # Template CRUD API
│   │   └── invoices/[id]/pdf/route.ts  # PDF generation endpoint
│   └── [locale]/dashboard/settings/
│       └── templates/
│           ├── page.tsx                # Template list
│           └── [id]/page.tsx           # Template editor
```

---

## 9. Commands & Verification

### 9.1 Database Migrations

```bash
# 1. Update schema.prisma with new enums and InvoiceTemplate fields
# 2. Create migration
npx prisma migrate dev --name expand_invoice_template

# 3. Regenerate client
npx prisma generate

# 4. Deploy to production
npx prisma migrate deploy
```

### 9.2 Data Migration (Existing Orgs)

```sql
-- Create default templates for existing organizations
INSERT INTO "InvoiceTemplate" (id, "orgId", name, "styleId", "isDefault", "createdAt", "updatedAt")
SELECT 
  gen_random_uuid()::text,
  id,
  'Default Template',
  CASE 
    WHEN template = 'MINIMAL' THEN 'MINIMAL'
    WHEN template = 'MODERN' THEN 'MODERN'
    WHEN template = 'CLASSIC' THEN 'CLASSIC'
    ELSE 'PROFESSIONAL'
  END,
  true,
  NOW(),
  NOW()
FROM "Organization"
WHERE NOT EXISTS (
  SELECT 1 FROM "InvoiceTemplate" it WHERE it."orgId" = "Organization".id
);
```

### 9.3 Verification Checklist

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] All 6 styles render correctly in browser
- [ ] All 6 styles produce matching PDFs
- [ ] PDF with 100+ line items has no row splits
- [ ] Table headers repeat on page 2+
- [ ] Totals section stays with last data rows
- [ ] Column visibility toggles work (hide qty, hide rate, etc.)
- [ ] Date format changes reflect in PDF
- [ ] Currency format changes reflect in PDF
- [ ] Logo upload and preview works
- [ ] Color pickers update preview in real-time
- [ ] Paper size selector changes PDF dimensions
- [ ] Default template is applied to new invoices
- [ ] Existing invoices render with their original template
- [ ] Print preview matches PDF output
- [ ] Mobile print view is readable

---

## 10. Risk Mitigation

| Risk | Mitigation |
|---|---|
| **Migration breaks existing invoices** | Run migration on staging first; keep old `Organization` columns as fallback for 1 release cycle |
| **Puppeteer memory issues on long invoices** | Add row count limits, streaming HTML generation, and browser reuse pool |
| **CSS divergence between browser and PDF** | Use identical CSS for both print and PDF; test with Puppeteer in CI |
| **Performance regression on dashboard** | Cache template configs; use `React.memo` on atomic components |
| **User confusion during migration** | Show banner: "New template system available — migrate your settings" |

---

## 11. Out of Scope (Phase 6+)

- Visual drag-and-drop template builder
- Template marketplace / sharing
- A/B testing of template variants
- Dynamic sections (add/remove line item groups, conditional blocks)
- Multi-language template labels (currently hardcoded in `invoice-template.tsx`)
