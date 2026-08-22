# Professional Invoice Template Module — Product Requirement Document

**Version:** 1.0  
**Date:** August 2026  
**Author:** Product Strategy  
**Status:** Ready for Development  

---

## 1. Executive Summary

The Professional Invoice Template module transforms generic invoices into branded business communications. It provides contractors and construction companies with a library of industry-aware template designs, a visual customization engine, and premium white-labeling capabilities that reinforce brand identity with every client touchpoint.

### Goals

- Reduce perceived "SaaS-ness" of invoices through professional, branded templates
- Increase customer confidence and payment speed via polished, trustworthy documents
- Create a premium upsell path through advanced white-labeling features
- Support diverse contractor personas from solo tradespeople to multi-user construction firms

---

## 2. User Personas

### Persona 1: Solo Trade Contractor
- **Profile:** Electrician, plumber, HVAC technician with 1–5 clients/month
- **Needs:** Quick, professional invoices without design skills
- **Pain Point:** Handwritten or spreadsheet invoices look unprofessional
- **Template Fit:** Minimal, Modern

### Persona 2: Small Construction Company
- **Profile:** General contractor with 5–20 employees, multiple concurrent projects
- **Needs:** Consistent branding across invoices, estimates, and reports
- **Pain Point:** Brand inconsistency between office and field teams
- **Template Fit:** Professional, Corporate

### Persona 3: Design-Build Firm
- **Profile:** Architecture/construction hybrid with aesthetics-focused clients
- **Needs:** Visually striking invoices that reflect design sensibility
- **Pain Point:** Generic templates undermine brand positioning
- **Template Fit:** Creative, Modern

### Persona 4: Specialty Subcontractor
- **Profile:** Concrete, roofing, or framing crew serving GCs
- **Needs:** Clear, detailed invoices with progress billing support
- **Pain Point:** Payment disputes from unclear line-item descriptions
- **Template Fit:** Professional, Classic

### Persona 5: Multi-Brand Construction Group
- **Profile:** Holding company with multiple service brands
- **Needs:** Distinct template sets per brand, centralized management
- **Pain Point:** Managing brand consistency across subsidiaries
- **Template Fit:** Corporate (per-brand customization)

---

## 3. Template Library

### 3.1 Design Principles

All templates adhere to these core principles:

1. **Readability First:** Line items, totals, and due dates are immediately scannable
2. **Brand Amplification:** Design serves brand identity, never competes with it
3. **Print-optimized:** Consistent rendering across digital (PDF) and physical (paper) formats
4. **Accessibility:** WCAG 2.1 AA color contrast ratios, semantic HTML structure
5. **Responsive:** Adapts to A4, US Letter, and screen display without breaking

### 3.2 Template Specifications

#### Template A: Modern

| Attribute | Value |
|-----------|-------|
| **Layout** | Asymmetric grid with sidebar for company info |
| **Color Application** | Accent color for header bar, section dividers, and totals |
| **Typography** | Sans-serif (Inter or Roboto), 10pt body, 14pt headings |
| **Branding** | Logo top-left, brand color sidebar background |
| **Best For** | Tech-forward contractors, design-conscious businesses |
| **Distinguishing Feature** | Left sidebar containing company details and payment info |

#### Template B: Minimal

| Attribute | Value |
|-----------|-------|
| **Layout** | Single column, generous whitespace |
| **Color Application** | Monochrome with single accent for totals |
| **Typography** | Clean sans-serif (Helvetica Neue), 11pt body, 16pt title |
| **Branding** | Small logo, no background colors |
| **Best For** | Solo contractors, modern trades |
| **Distinguishing Feature** | Extreme whitespace, no decorative elements |

#### Template C: Professional

| Attribute | Value |
|-----------|-------|
| **Layout** | Traditional two-tier with clear hierarchy |
| **Color Application** | Primary brand color for header, secondary for accents |
| **Typography** | Serif headings (Georgia) + sans-serif body (Arial) |
| **Branding** | Centered logo, professional letterhead feel |
| **Best For** | Established contractors, client-facing firms |
| **Distinguishing Feature** | Letterhead-style header with centered company info |

#### Template D: Corporate

| Attribute | Value |
|-----------|-------|
| **Layout** | Structured grid with defined zones |
| **Color Application** | Full brand palette: primary, secondary, accent |
| **Typography** | Corporate sans-serif (Open Sans), hierarchical sizing |
| **Branding** | Logo + tagline, professional certification badges |
| **Best For** | Multi-user firms, government contractors |
| **Distinguishing Feature** | Compliance footer with license numbers, certifications |

#### Template E: Creative

| Attribute | Value |
|-----------|-------|
| **Layout** | Bold, expressive with geometric elements |
| **Color Application** | Vibrant brand colors, gradient accents |
| **Typography** | Display font for headings (Montserrat), clean body |
| **Branding** | Large logo placement, artistic flourishes |
| **Best For** | Design firms, creative agencies, boutique builders |
| **Distinguishing Feature** | Decorative geometric header, expressive typography |

#### Template F: Classic

| Attribute | Value |
|-----------|-------|
| **Layout** | Traditional centered, formal business document |
| **Color Application** | Conservative: navy, burgundy, or forest green accents |
| **Typography** | Classic serif (Times New Roman or Garamond) throughout |
| **Branding** | Centered letterhead, formal business details |
| **Best For** | Legacy firms, legal/compliance-heavy industries |
| **Distinguishing Feature** | Formal "Remittance Advice" tear-off section |

---

## 4. Customization Engine

### 4.1 Visual Identity Customization

#### Logo Configuration

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `logoUrl` | URL | null | Company logo image (PNG, SVG, JPG) |
| `logoMaxWidth` | px | 180 | Maximum logo width in pixels |
| `logoMaxHeight` | px | 80 | Maximum logo height in pixels |
| `logoPosition` | enum | `left` | `left`, `center`, `right` |
| `logoMonochrome` | boolean | false | Convert logo to monochrome for print |

**Constraints:**
- Supported formats: PNG (recommended), SVG, JPG
- Max file size: 5MB
- Recommended dimensions: 400×200px (2:1 ratio)
- SVG preferred for scalability

#### Color Palette

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `primaryColor` | hex | `#1e40af` | Primary brand color (headers, accents) |
| `secondaryColor` | hex | `#3b82f6` | Secondary brand color (sub-accents) |
| `accentColor` | hex | `#10b981` | Highlight color (totals, CTAs) |
| `textColor` | hex | `#1f2937` | Body text color |
| `mutedColor` | hex | `#6b7280` | Secondary text, borders |
| `backgroundColor` | hex | `#ffffff` | Page background |
| `headerBackground` | hex | null | Header area background |

**Accessibility Requirements:**
- Primary text must maintain 4.5:1 contrast ratio against background
- Large text (18pt+) must maintain 3:1 contrast ratio
- Color picker includes WCAG contrast checker with pass/fail indicator

#### Typography

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `headingFont` | enum | `Inter` | Font family for headings |
| `bodyFont` | enum | `Inter` | Font family for body text |
| `fontSize` | enum | `medium` | `small` (9pt), `medium` (10pt), `large` (11pt) |
| `lineHeight` | enum | `normal` | `tight` (1.2), `normal` (1.5), `relaxed` (1.75) |

**Available Fonts:**

| Category | Fonts |
|----------|-------|
| Sans-serif | Inter, Roboto, Open Sans, Lato, Montserrat |
| Serif | Merriweather, Playfair Display, Lora, Georgia |
| Monospace | IBM Plex Mono, Source Code Pro |

### 4.2 Structural Customization

#### Layout Configuration

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `pageSize` | enum | `letter` | `a4`, `letter`, `legal` |
| `orientation` | enum | `portrait` | `portrait`, `landscape` |
| `marginTop` | mm | 20 | Top margin |
| `marginBottom` | mm | 20 | Bottom margin |
| `marginLeft` | mm | 15 | Left margin |
| `marginRight` | mm | 15 | Right margin |

#### Header Configuration

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `showHeader` | boolean | true | Display header section |
| `headerStyle` | enum | `full` | `full`, `minimal`, `none` |
| `showCompanyName` | boolean | true | Display company name |
| `showCompanyAddress` | boolean | true | Display company address |
| `showCompanyPhone` | boolean | true | Display phone number |
| `showCompanyEmail` | boolean | true | Display email address |
| `showCompanyWebsite` | boolean | false | Display website URL |
| `showTaxId` | boolean | false | Display Tax ID / VAT number |
| `customHeaderText` | string | null | Additional header text |

#### Footer Configuration

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `showFooter` | boolean | true | Display footer section |
| `footerStyle` | enum | `standard` | `standard`, `minimal`, `none` |
| `showPageNumbers` | boolean | true | Display "Page X of Y" |
| `showThankYou` | boolean | true | Display thank-you message |
| `customFooterText` | string | null | Custom footer text |
| `showPoweredBy` | boolean | true | Display "Powered by" badge |

#### Column Visibility

| Column | Default | Description |
|--------|---------|-------------|
| `#` (line number) | visible | Sequential item number |
| `SKU` | hidden | Product/service code |
| `Description` | visible | Item description |
| `Quantity` | visible | Quantity/units |
| `Rate` | visible | Unit price |
| `Amount` | visible | Line total |
| `Discount` | hidden | Line-level discount |
| `Tax` | hidden | Line-level tax |

### 4.3 Transactional Details

#### Payment Information

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `showPaymentInfo` | boolean | true | Display payment section |
| `paymentPosition` | enum | `footer` | `sidebar`, `footer`, `separate` |
| `bankName` | string | null | Bank name for wire transfers |
| `accountNumber` | string | null | Masked account number |
| `routingNumber` | string | null | ACH/routing number |
| `iban` | string | null | International bank account |
| `swiftCode` | string | null | SWIFT/BIC code |
| `paymentInstructions` | text | null | Custom payment instructions |
| `acceptedPaymentMethods` | array | `["check"]` | `check`, `ach`, `wire`, `card`, `paypal` |

#### Branding Elements

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `showLicenseNumbers` | boolean | false | Display contractor license numbers |
| `showCertifications` | boolean | false | Display certification badges |
| `showInsuranceInfo` | boolean | false | Display insurance details |
| `customStampUrl` | URL | null | Digital stamp/seal image |
| `signatureUrl` | URL | null | Authorized signature image |

---

## 5. Premium Subscription Tiers

### 5.1 Tier Comparison Matrix

| Feature | Free | Starter | Pro | Business |
|---------|------|---------|-----|----------|
| **Templates** | | | | |
| Template selection | 1 (Minimal) | 3 | All 6 | All 6 + Custom |
| **Visual Identity** | | | | |
| Logo upload | ✓ | ✓ | ✓ | ✓ |
| Brand colors | 1 color | 2 colors | Full palette | Full palette |
| Font selection | ✗ | 3 fonts | 10 fonts | All fonts |
| **Structure** | | | | |
| Header customization | ✗ | ✓ | ✓ | ✓ |
| Footer customization | ✗ | ✓ | ✓ | ✓ |
| Column visibility | ✗ | ✗ | ✓ | ✓ |
| **Branding** | | | | |
| "Powered by" watermark | Shown | Shown | Removed | Removed |
| Custom footer text | ✗ | ✗ | ✓ | ✓ |
| License/cert display | ✗ | ✗ | ✓ | ✓ |
| **Advanced** | | | | |
| Custom invoice domain | ✗ | ✗ | ✗ | ✓ |
| Custom email branding | ✗ | ✗ | ✗ | ✓ |
| Multiple template sets | ✗ | ✗ | ✗ | ✓ |
| Template import (HTML) | ✗ | ✗ | ✗ | ✓ |
| Priority template support | ✗ | ✗ | ✗ | ✓ |

### 5.2 Feature Details by Tier

#### Free Plan
- 1 template (Minimal)
- Logo upload (basic)
- 1 brand color
- Standard header/footer
- "Powered by Prince" watermark displayed

#### Starter Plan ($9/mo)
- 3 template choices
- 2 brand colors
- 3 font choices
- Header/footer content toggle
- Basic payment info display
- Watermark still displayed

#### Pro Plan ($29/mo)
- All 6 templates
- Full color palette
- 10 font choices
- Column visibility control
- License/certification display
- Custom footer text
- **Watermark removed**

#### Business Plan ($79/mo)
- All fonts
- Custom invoice domain
- Custom email branding
- Multiple template sets
- HTML template import
- Priority support
- API access

### 5.3 Watermark Specifications

**Free/Starter Watermark:**
- Position: Bottom-center of last page
- Opacity: 60%
- Font: System sans-serif, 8pt
- Color: #9ca3af (gray-400)
- Clickable link to product site (digital only)

**Pro/Business:** No watermark, fully white-labeled

### 5.4 Custom Domain (Business Only)

**Configuration:**
- CNAME: `invoices.yourcompany.com` → `custom.prince.ai`
- SSL via Let's Encrypt
- Verification within 24 hours

**Email Branding (Business Only):**
- Custom SMTP server
- Custom sender name and reply-to
- Branded email templates
- DKIM/SPF/DMARC support

---

## 6. Technical Implementation

### 6.1 Data Model

```prisma
model InvoiceTemplate {
  id            String   @id @default(cuid())
  orgId         String
  org           Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  
  name          String
  baseTemplate  String   // modern, minimal, professional, corporate, creative, classic
  isDefault     Boolean  @default(false)
  
  // Visual Identity
  logoUrl       String?
  logoMaxWidth  Int      @default(180)
  logoMaxHeight Int      @default(80)
  logoPosition  String   @default("left")
  
  primaryColor      String  @default("#1e40af")
  secondaryColor    String  @default("#3b82f6")
  accentColor       String  @default("#10b981")
  textColor         String  @default("#1f2937")
  mutedColor        String  @default("#6b7280")
  backgroundColor   String  @default("#ffffff")
  headerBackground  String?
  
  headingFont   String   @default("Inter")
  bodyFont      String   @default("Inter")
  fontSize      String   @default("medium")
  lineHeight    String   @default("normal")
  
  // Structure
  pageSize      String   @default("letter")
  orientation   String   @default("portrait")
  marginTop     Int      @default(20)
  marginBottom  Int      @default(20)
  marginLeft    Int      @default(15)
  marginRight   Int      @default(15)
  
  // Header/Footer
  showHeader          Boolean @default(true)
  headerStyle         String  @default("full")
  showCompanyName     Boolean @default(true)
  showCompanyAddress  Boolean @default(true)
  showCompanyPhone    Boolean @default(true)
  showCompanyEmail    Boolean @default(true)
  showCompanyWebsite  Boolean @default(false)
  showTaxId           Boolean @default(false)
  customHeaderText    String?
  
  showFooter          Boolean @default(true)
  footerStyle         String  @default("standard")
  showPageNumbers     Boolean @default(true)
  showThankYou        Boolean @default(true)
  customFooterText    String?
  
  // Columns
  showLineNumber  Boolean @default(true)
  showSku         Boolean @default(false)
  showDescription Boolean @default(true)
  showQuantity    Boolean @default(true)
  showRate        Boolean @default(true)
  showAmount      Boolean @default(true)
  showDiscount    Boolean @default(false)
  showTax         Boolean @default(false)
  
  // Payment
  showPaymentInfo     Boolean @default(true)
  paymentPosition     String  @default("footer")
  bankName            String?
  accountNumber      String?
  routingNumber       String?
  iban                String?
  swiftCode           String?
  paymentInstructions String?
  acceptedMethods     String  @default("check")
  
  // Branding
  showLicenseNumbers  Boolean @default(false)
  showCertifications  Boolean @default(false)
  showInsuranceInfo   Boolean @default(false)
  customStampUrl      String?
  signatureUrl        String?
  
  invoices    Invoice[]
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@index([orgId])
  @@index([orgId, isDefault])
}
```

### 6.2 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/templates` | List all templates for org |
| POST | `/api/templates` | Create new template |
| GET | `/api/templates/:id` | Get template details |
| PATCH | `/api/templates/:id` | Update template |
| DELETE | `/api/templates/:id` | Delete template |
| POST | `/api/templates/:id/duplicate` | Clone template |
| POST | `/api/templates/:id/set-default` | Set as default |
| GET | `/api/templates/preview/:id` | Generate preview PDF |
| GET | `/api/templates/fonts` | List available fonts |
| GET | `/api/templates/colors/presets` | List color presets |

### 6.3 Component Architecture

```
TemplateCustomizer
├── TemplateGallery
│   ├── TemplateCard[]
│   └── TemplateSelector
├── VisualIdentityPanel
│   ├── LogoUploader
│   ├── ColorPicker[]
│   └── FontSelector
├── StructurePanel
│   ├── LayoutConfig
│   ├── HeaderEditor
│   ├── FooterEditor
│   └── ColumnToggle[]
├── TransactionalPanel
│   ├── PaymentInfoEditor
│   └── BrandingElements
├── PreviewPanel
│   ├── LivePreview
│   └── DeviceToggle
└── ActionBar
    ├── SaveButton
    ├── SetDefaultButton
    └── ExportButton
```

### 6.4 PDF Generation Pipeline

```
Template Config + Invoice Data
         │
         ▼
┌─────────────────┐
│  HTML Renderer   │ ← React components with template config
│  (Server-side)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Puppeteer/      │ ← Headless Chrome for pixel-perfect rendering
│  Playwright      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  PDF Output      │ ← A4/Letter, embedded fonts, optimized
│  (Buffer)        │
└────────┬────────┘
         │
         ▼
    Response/Download
```

---

## 7. Success Metrics

### 7.1 Adoption Metrics

| Metric | Target (90 days) |
|--------|------------------|
| Template customization rate | 60% of active orgs |
| Logo upload rate | 40% of active orgs |
| Premium template selection | 25% choose non-default |
| Feature discovery rate | 70% visit template settings |

### 7.2 Revenue Metrics

| Metric | Target |
|--------|--------|
| Starter → Pro conversion | 15% at 90 days |
| Pro → Business upgrade | 8% at 180 days |
| Template-related churn reduction | 20% decrease |

### 7.3 Quality Metrics

| Metric | Target |
|--------|--------|
| PDF generation success rate | 99.5% |
| Template render time (p95) | < 2 seconds |
| Accessibility compliance | WCAG 2.1 AA |
| Cross-browser consistency | Chrome, Firefox, Safari, Edge |

---

## 8. Implementation Phases

### Phase 1: Foundation (Weeks 1-2)
- Prisma schema migration for `InvoiceTemplate`
- Basic CRUD API endpoints
- Template gallery with 6 base templates
- Simple preview functionality

### Phase 2: Customization Engine (Weeks 3-4)
- Visual identity controls (logo, colors, fonts)
- Structural customization (header, footer, columns)
- Live preview with real-time updates
- Template duplication and default selection

### Phase 3: Premium Features (Weeks 5-6)
- Watermark removal for Pro/Business
- Advanced color palette controls
- License/certification display
- Payment info customization

### Phase 4: White-Labeling (Weeks 7-8)
- Custom domain support (Business)
- Custom email branding (Business)
- Multiple template sets (Business)
- HTML template import (Business)
- API access for template management

### Phase 5: Polish (Weeks 9-10)
- Performance optimization
- Accessibility audit
- Cross-browser testing
- Documentation and onboarding

---

## 9. Open Questions

1. **PDF Generation:** Should we use Puppeteer (heavier but pixel-perfect) or a lighter solution like pdf-lib?
2. **Font Licensing:** Do we need commercial licenses for any fonts in the library?
3. **Custom HTML Import:** Should we sanitize user-provided HTML for security?
4. **Migration Path:** How should we handle existing orgs when this feature launches?
5. **Template Marketplace:** Should we allow users to share/sell templates in the future?

---

## 10. Appendix

### 10.1 Color Presets

| Preset Name | Primary | Secondary | Accent | Best For |
|-------------|---------|-----------|--------|----------|
| Ocean | #1e40af | #3b82f6 | #10b981 | General construction |
| Forest | #166534 | #15803d | #84cc16 | Landscaping, environmental |
| Slate | #334155 | #475569 | #0ea5e9 | Corporate, professional |
| Burgundy | #881337 | #be123c | #f59e0b | Luxury, high-end |
| Charcoal | #18181b | #27272a | #a1a1aa | Minimal, modern |

### 10.2 Template File Structure

```
src/components/templates/
├── modern/
│   ├── ModernTemplate.tsx
│   ├── ModernPreview.tsx
│   └── modern.css
├── minimal/
│   ├── MinimalTemplate.tsx
│   ├── MinimalPreview.tsx
│   └── minimal.css
├── professional/
│   ├── ProfessionalTemplate.tsx
│   ├── ProfessionalPreview.tsx
│   └── professional.css
├── corporate/
│   ├── CorporateTemplate.tsx
│   ├── CorporatePreview.tsx
│   └── corporate.css
├── creative/
│   ├── CreativeTemplate.tsx
│   ├── CreativePreview.tsx
│   └── creative.css
├── classic/
│   ├── ClassicTemplate.tsx
│   ├── ClassicPreview.tsx
│   └── classic.css
└── shared/
    ├── TemplateProps.ts
    ├── LogoBlock.tsx
    ├── LineItemsTable.tsx
    ├── TotalsSection.tsx
    ├── PaymentInfo.tsx
    └── Watermark.tsx
```

---

*End of document*