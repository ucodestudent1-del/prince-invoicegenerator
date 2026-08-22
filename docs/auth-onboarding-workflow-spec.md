# Authentication & Business Onboarding Workflow — Functional Specification

**Version:** 1.0  
**Date:** August 2026  
**Author:** Product & Engineering  
**Status:** Ready for Development  

---

## 1. Executive Summary

This specification defines the complete authentication and onboarding experience for Prince Invoice Generator. The design prioritizes **progressive data collection** — capturing only essential information at each step while deferring optional details to post-onboarding prompts. This approach reduces signup friction while ensuring every invoice generated is fully branded and compliant without repeated data entry.

### Design Principles

1. **Progressive Disclosure:** Collect only what's needed now; defer the rest
2. **Single Source of Truth:** Business details entered once propagate everywhere
3. **Security by Default:** Email verification required before sensitive actions
4. **Intelligent Defaults:** Auto-detect country, currency, timezone from context
5. **Zero Re-entry:** Onboarding data pre-configures all future invoices

---

## 2. Authentication & Security Workflow

### 2.1 Authentication Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Authentication Architecture                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Email/Pwd  │    │ Google OAuth │    │  Magic Link  │      │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘      │
│         │                   │                   │               │
│         └───────────────────┼───────────────────┘               │
│                             │                                   │
│                    ┌────────┴────────┐                          │
│                    │  NextAuth.js    │                          │
│                    │  (Credentials + │                          │
│                    │   OAuth)        │                          │
│                    └────────┬────────┘                          │
│                             │                                   │
│                    ┌────────┴────────┐                          │
│                    │  JWT Session    │                          │
│                    │  + Database     │                          │
│                    │    Session      │                          │
│                    └────────┬────────┘                          │
│                             │                                   │
│                    ┌────────┴────────┐                          │
│                    │  RBAC Guard     │                          │
│                    │  Middleware     │                          │
│                    └─────────────────┘                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Sign-Up Methods

#### 2.2.1 Email/Password Sign-Up

**User Journey:**

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Landing    │────▶│  Sign-Up    │────▶│   Email     │────▶│  Onboarding │
│  Page       │     │  Form       │     │ Verification│     │  (Step 1)   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

**Sign-Up Form Fields:**

| Field | Required | Validation | Notes |
|-------|----------|------------|-------|
| Email | Yes | RFC 5322 format, MX record check | Used as primary identifier |
| Password | Yes | Min 8 chars, 1 upper, 1 lower, 1 number, 1 symbol | Show strength meter |
| Full Name | Yes | 2+ chars, letters only | Used for email salutation |
| Terms checkbox | Yes | Must be checked | Links to Terms of Service |
| Marketing checkbox | No | Default unchecked | Optional newsletter signup |

**Password Requirements:**

```typescript
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be less than 128 characters")
  .regex(/[A-Z]/, "Must contain at least one uppercase letter")
  .regex(/[a-z]/, "Must contain at least one lowercase letter")
  .regex(/[0-9]/, "Must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Must contain at least one special character");
```

**Password Strength Indicator:**

| Score | Label | Color | Criteria |
|-------|-------|-------|----------|
| 0 | Very Weak | #ef4444 | Fails 1+ requirements |
| 1 | Weak | #f97316 | Meets minimum only |
| 2 | Fair | #eab308 | Min length + 3 categories |
| 3 | Strong | #22c55e | 10+ chars + all categories |
| 4 | Very Strong | #10b981 | 14+ chars + all categories |

#### 2.2.2 Google OAuth Sign-Up

**User Journey:**

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Landing    │────▶│  Google     │────▶│  Account    │────▶│  Onboarding │
│  Page       │     │  Sign-In    │     │  Linking    │     │  (Step 1)   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

**Auto-Populated Fields from Google Profile:**

| Field | Source | Used For |
|-------|--------|----------|
| Email | Google account | Primary identifier |
| Full Name | Google profile | User display name |
| Profile Photo | Google avatar | Initial avatar (uploadable later) |
| Locale | Google settings | Language suggestion |

**OAuth Scopes Requested:**

```typescript
const googleScopes = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];
```

**Post-OAuth Account Linking:**
- If email already exists with password auth → Prompt to link accounts
- If email is new → Create account, mark email as verified
- If OAuth account exists → Sign in directly

#### 2.2.3 Magic Link (Passwordless)

**User Journey:**

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Sign-In    │────▶│  Email      │────▶│  Email      │────▶│  Dashboard  │
│  Page       │     │  Input      │     │  Click      │     │  (or Onboard)│
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

**Token Specifications:**

| Property | Value |
|----------|-------|
| Token length | 32 bytes (64 hex chars) |
| Expiry | 15 minutes |
| Single use | Yes (deleted after consumption) |
| Rate limit | 5 requests per hour per email |

### 2.3 Security Protocols

#### 2.3.1 Email Verification

**Trigger Conditions:**
- New email/password sign-up → Immediate
- Email change on existing account → Immediate
- OAuth sign-up → Skipped (verified by provider)

**Verification Flow:**

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Sign-Up        │────▶│  Verify Email   │────▶│  Verification   │
│  Complete       │     │  Prompt         │     │  Email Sent     │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
         ┌───────────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Email Clicked  │────▶│  Email Verified │
│  (Token Valid)  │     │  → Onboarding   │
└─────────────────┘     └─────────────────┘
```

**Token Specifications:**

| Property | Value |
|----------|-------|
| Token length | 32 bytes (64 hex chars) |
| Expiry | 24 hours |
| Single use | Yes |
| Resend cooldown | 60 seconds |

**Post-Verification Behavior:**
- Auto-advance to onboarding Step 1
- Show success toast: "Email verified! Let's set up your business."
- Set `emailVerified` timestamp on user record

**Unverified Account Limitations:**

| Action | Unverified | Verified |
|--------|------------|----------|
| View dashboard | ✓ | ✓ |
| Complete onboarding | ✓ | ✓ |
| Create invoices | ✗ (soft limit: 3) | ✓ (unlimited) |
| Send invoices to clients | ✗ | ✓ |
| Access reports | ✗ | ✓ |
| Invite team members | ✗ | ✓ |

#### 2.3.2 Password Reset

**Reset Flow:**

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Forgot         │────▶│  Email Sent     │────▶│  Reset          │
│  Password       │     │  (if exists)    │     │  Link Clicked   │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
         ┌───────────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  New Password   │────▶│  All Sessions   │
│  Form           │     │  Revoked        │
└─────────────────┘     └─────────────────┘
```

**Token Specifications:**

| Property | Value |
|----------|-------|
| Token length | 32 bytes (64 hex chars) |
| Expiry | 1 hour |
| Single use | Yes |
| Rate limit | 3 requests per hour |

**Security Measures:**
- Email indicates if account exists (generic message to prevent enumeration)
- All existing sessions revoked on successful reset
- Email notification sent to account address

#### 2.3.3 Two-Factor Authentication (2FA)

**Supported Methods:**

| Method | Priority | Description |
|--------|----------|-------------|
| TOTP (Authenticator App) | Primary | Google Authenticator, Authy, 1Password |
| SMS | Backup | Twilio integration, fallback only |
| Recovery Codes | Emergency | 10 single-use codes |

**Enrollment Flow:**

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Security       │────▶│  QR Code /      │────▶│  Verify         │
│  Settings       │     │  Secret Key     │     │  TOTP Code      │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
         ┌───────────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Recovery Codes │────▶│  2FA Enabled   │
│  Generated      │     │  → Backup codes │
└─────────────────┘     │    stored       │
                        └─────────────────┘
```

**TOTP Configuration:**

```typescript
const totpConfig = {
  issuer: "Prince Invoice",
  algorithm: "SHA1",
  digits: 6,
  period: 30,
  window: 1, // Allow 1 step drift (30 seconds)
};
```

**Recovery Code Specifications:**

| Property | Value |
|----------|-------|
| Count | 10 codes |
| Format | XXXX-XXXX-XXXX (12 chars, alphanumeric) |
| Storage | Hashed (bcrypt) |
| Usage | Single-use, revoked after use |

**2FA Enforcement Policy:**

| Scenario | 2FA Required |
|----------|--------------|
| Initial sign-up | Optional |
| Role: Owner/Admin | Enforced after 7 days |
| Role: Member | Optional |
| Sensitive actions (delete org, change billing) | Always require 2FA |
| New device login | Require 2FA |

### 2.4 Session Management

#### 2.4.1 Session Architecture

```typescript
interface Session {
  id: string;              // Unique session ID
  userId: string;          // Associated user
  token: string;           // JWT access token
  refreshToken: string;    // Rotation token
  deviceInfo: DeviceInfo;  // Parsed user agent
  ipAddress: string;       // Hashed for privacy
  location: GeoLocation;   // Approximate from IP
  createdAt: DateTime;     // Session start
  lastActiveAt: DateTime;  // Last activity
  expiresAt: DateTime;     // Absolute expiry
  isCurrent: boolean;      // Current device flag
}

interface DeviceInfo {
  browser: string;         // Chrome, Firefox, Safari, etc.
  os: string;              // Windows, macOS, iOS, etc.
  deviceType: string;      // desktop, mobile, tablet
  userAgent: string;       // Raw UA string
}
```

#### 2.4.2 Token Configuration

| Token | Lifetime | Storage | Purpose |
|-------|----------|---------|---------|
| Access Token (JWT) | 15 minutes | Memory | API authorization |
| Refresh Token | 7 days | HttpOnly Cookie | Session persistence |
| Session Record | 30 days inactive | Database | Device tracking |

#### 2.4.3 Device Tracking

**Active Sessions View:**

```
┌─────────────────────────────────────────────────────────────────┐
│                        Active Sessions                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🖥️ Current Device                                        │   │
│  │    Chrome on Windows · San Francisco, CA                │   │
│  │    Active now                                           │   │
│  │    [This device]                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 📱 iPhone                                               │   │
│  │    Safari on iOS · San Francisco, CA                    │   │
│  │    Last active 2 hours ago                              │   │
│  │    [Revoke]                                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 💻 MacBook                                              │   │
│  │    Chrome on macOS · New York, NY                       │   │
│  │    Last active 3 days ago                               │   │
│  │    [Revoke]                                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [Revoke All Other Sessions]                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Session Security Rules:**

| Event | Action |
|-------|--------|
| New login from unknown device | Email notification |
| Password change | Revoke all sessions except current |
| 2FA enabled | Revoke all sessions except current |
| Suspicious location detected | Require email verification |
| 30 days inactive | Auto-revoke session |
| Concurrent session limit (5) | Require revoking existing session |

#### 2.4.4 Concurrent Session Limits

| Plan | Max Concurrent Sessions |
|------|------------------------|
| Free | 2 |
| Starter | 3 |
| Pro | 5 |
| Business | 10 per user |

---

## 3. Business Onboarding & Profile Automation

### 3.1 Onboarding Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Onboarding State Machine                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐        │
│  │  Auth   │──▶│ Identity│──▶│ Contact │──▶│Compliance│       │
│  │ Complete│   │  Step   │   │  Step   │   │  Step    │       │
│  └─────────┘   └────┬────┘   └────┬────┘   └────┬────┘        │
│                     │             │             │               │
│                     ▼             ▼             ▼               │
│              ┌─────────────────────────────────────┐           │
│              │         Organization Record          │           │
│              │         + Settings Record            │           │
│              │         + Default Template           │           │
│              └─────────────────────────────────────┘           │
│                              │                                  │
│                              ▼                                  │
│                    ┌─────────────────┐                          │
│                    │   Dashboard     │                          │
│                    │   (Ready)       │                          │
│                    └─────────────────┘                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Onboarding Steps

#### Step 0: Welcome & Plan Selection (Optional)

**Purpose:** Set expectations, allow plan selection before data entry

```
┌─────────────────────────────────────────────────────────────────┐
│                    Welcome to Prince!                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Choose your plan to get started:                               │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │   Free   │  │ Starter  │  │   Pro    │  │ Business │        │
│  │   $0     │  │  $9/mo   │  │  $29/mo  │  │  $79/mo  │        │
│  │          │  │          │  │          │  │          │        │
│  │ 5 inv/mo │  │ 25 inv/mo│  │ Unlimited│  │ Unlimited│        │
│  │ 1 user   │  │ 1 user   │  │ 5 users  │  │ Unlimited│        │
│  │          │  │          │  │          │  │          │        │
│  │ [Select] │  │ [Select] │  │ [Select] │  │ [Select] │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│                                                                 │
│  You can skip this and choose a plan later.                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Step 1: Business Identity

**Purpose:** Establish brand identity for invoices

**Form Fields:**

| Field | Required | Default | Auto-Fill | Notes |
|-------|----------|---------|-----------|-------|
| Business Name | Yes | — | From Google profile | Displayed on all invoices |
| Logo | No | Placeholder | — | PNG/SVG, max 5MB |
| Industry | No | "Construction" | — | Dropdown with common options |
| Business Type | No | "LLC" | — | Sole Prop, LLC, S-Corp, C-Corp, Partnership |
| Registration Number | No | — | — | Optional business registration # |
| Website | No | — | From Google profile | Shown on invoice footer |

**Logo Upload Specifications:**

```typescript
const logoConfig = {
  formats: ["image/png", "image/svg+xml", "image/jpeg"],
  maxSize: 5 * 1024 * 1024, // 5MB
  minDimensions: { width: 100, height: 100 },
  recommendedDimensions: { width: 400, height: 200 },
  storage: "s3://bucket/orgs/{orgId}/logo.{ext}",
  variants: {
    thumbnail: { width: 200, height: 100 },
    full: { width: 800, height: 400 },
  },
};
```

#### Step 2: Contact Information

**Purpose:** Populate invoice header and footer

**Form Fields:**

| Field | Required | Default | Auto-Fill | Notes |
|-------|----------|---------|-----------|-------|
| Business Address (Line 1) | Yes | — | — | Street address |
| Business Address (Line 2) | No | — | — | Suite, unit, etc. |
| City | Yes | — | — | — |
| State/Province | No | — | — | Auto-detected from ZIP |
| Postal Code | Yes | — | — | Validates against country |
| Country | Yes | Auto-detected | From IP geolocation | ISO 3166-1 alpha-2 |
| Phone | No | — | — | With country code |
| Business Email | Yes | From auth | From Google profile | Reply-to for client emails |

**Address Validation:**

```typescript
interface AddressValidation {
  isValid: boolean;
  normalized?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  suggestions?: Array<{
    confidence: number;
    address: Address;
  }>;
}
```

#### Step 3: Compliance & Localization

**Purpose:** Configure tax, currency, and regional settings

**Form Fields:**

| Field | Required | Default | Auto-Fill | Notes |
|-------|----------|---------|-----------|-------|
| Tax ID / VAT / GST | No | — | — | Format varies by country |
| Tax ID Type | Conditional | Auto-detected | From country | EIN, VAT, GST, ABN, etc. |
| Default Currency | Yes | Auto-detected | From country | ISO 4217 |
| Default Language | Yes | Auto-detected | From browser | Invoice language |
| Timezone | Yes | Auto-detected | From browser | IANA timezone |
| Date Format | Yes | Auto-detected | From country | MM/DD/YYYY, DD/MM/YYYY, etc. |
| Number Format | Yes | Auto-detected | From country | 1,000.00 vs 1.000,00 |
| Default Tax Rate | No | 0% | — | Applied to new line items |
| Default Payment Terms | No | "Net 30" | — | Due date calculation |

**Tax ID Formats by Country:**

| Country | Tax ID Type | Format | Example |
|---------|-------------|--------|---------|
| US | EIN | XX-XXXXXXX | 12-3456789 |
| UK | VAT | XXXXXXXXXX | 123456789 |
| EU | VAT | XX XXXXXXXXX | DE 123456789 |
| CA | GST/HST | XXXXXXXXXXX | 123456789RT0001 |
| AU | ABN | XX XXX XXX XXX | 12 345 678 901 |
| IN | GSTIN | XXXXXXXXXXXXXXX | 27AABCU9603R1ZM |

**Auto-Detection Logic:**

```typescript
async function autoDetectSettings(ipAddress: string, browserLocale: string) {
  const geo = await geoIpLookup(ipAddress);
  const countrySettings = countryDefaults[geo.countryCode];
  
  return {
    country: geo.countryCode,
    currency: countrySettings.currency,
    timezone: geo.timezone || countrySettings.fallbackTimezone,
    language: browserLocale || countrySettings.defaultLanguage,
    dateFormat: countrySettings.dateFormat,
    numberFormat: countrySettings.numberFormat,
    taxIdType: countrySettings.taxIdType,
  };
}
```

#### Step 4: Review & Confirm

**Purpose:** Verify all entered information before creating records

**Review Sections:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    Review Your Information                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─ Business Identity ─────────────────────────────────────┐   │
│  │  Acme Construction LLC                                   │   │
│  │  [LOGO]                                                  │   │
│  │  Industry: General Construction                          │   │
│  │  Website: www.acmeconstruction.com                       │   │
│  │  [Edit]                                                  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─ Contact Information ───────────────────────────────────┐   │
│  │  123 Main Street, Suite 100                              │   │
│  │  San Francisco, CA 94102                                 │   │
│  │  United States                                           │   │
│  │  Phone: (415) 555-0123                                   │   │
│  │  Email: billing@acmeconstruction.com                     │   │
│  │  [Edit]                                                  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─ Compliance & Localization ────────────────────────────┐   │
│  │  Tax ID: EIN 12-3456789                                  │   │
│  │  Currency: USD ($)                                       │   │
│  │  Timezone: America/Los_Angeles                           │   │
│  │  Date Format: MM/DD/YYYY                                 │   │
│  │  Default Tax Rate: 0%                                    │   │
│  │  Payment Terms: Net 30                                   │   │
│  │  [Edit]                                                  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [← Back]                          [Complete Setup →]          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Data Model

#### 3.3.1 Organization Model

```prisma
model Organization {
  id                    String   @id @default(cuid())
  name                  String
  slug                  String   @unique // URL-friendly identifier
  
  // Identity
  logoUrl               String?
  industry              String?  // Construction, Plumbing, Electrical, etc.
  businessType          String?  // LLC, S-Corp, Sole Prop, etc.
  registrationNumber    String?
  website               String?
  
  // Contact
  addressLine1          String?
  addressLine2          String?
  city                  String?
  state                 String?
  postalCode            String?
  country               String   @default("US") // ISO 3166-1 alpha-2
  phone                 String?
  email                 String?
  
  // Compliance
  taxId                 String?
  taxIdType             String?  // EIN, VAT, GST, ABN, etc.
  
  // Localization
  currency              String   @default("USD") // ISO 4217
  language              String   @default("en")  // BCP 47
  timezone              String   @default("America/New_York") // IANA
  dateFormat            String   @default("MM/DD/YYYY")
  numberFormat          String   @default("en-US") // Intl.NumberFormat locale
  
  // Billing Defaults
  defaultTaxRate        Float    @default(0)
  defaultPaymentTerms   String   @default("NET_30")
  
  // Plan
  plan                  String   @default("free") // free, starter, pro, business
  planExpiresAt         DateTime?
  
  // Relations
  users                 OrganizationUser[]
  invoices              Invoice[]
  customers             Customer[]
  templates             InvoiceTemplate[]
  settings              OrganizationSettings?
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  
  @@index([slug])
  @@index([plan])
}
```

#### 3.3.2 Onboarding State Model

```prisma
model OnboardingState {
  id                    String   @id @default(cuid())
  userId                String   @unique
  user                  User     @relation(fields: [userId], references: [id])
  
  currentStep           String   @default("identity") // identity, contact, compliance, review
  completedSteps        String[] // ["identity", "contact", ...]
  
  // Temporary storage for multi-step form
  identityData          Json?
  contactData           Json?
  complianceData        Json?
  
  // Status
  isComplete            Boolean  @default(false)
  completedAt           DateTime?
  
  // Tracking
  startedAt             DateTime @default(now())
  lastActiveAt          DateTime @updatedAt
  
  @@index([userId])
  @@index([isComplete])
}
```

### 3.4 Invoice Profile Auto-Generation

#### 3.4.1 Pre-Configured Invoice Profile

Upon onboarding completion, the system automatically creates a complete invoice profile:

```typescript
async function createInvoiceProfile(orgId: string) {
  const org = await db.organization.findUnique({ where: { id: orgId } });
  
  // 1. Create default payment info
  const paymentInfo = await db.paymentInfo.create({
    data: {
      orgId,
      showOnInvoice: true,
      paymentInstructions: generateDefaultInstructions(org.defaultPaymentTerms),
    },
  });
  
  // 2. Create default invoice template
  const template = await db.invoiceTemplate.create({
    data: {
      orgId,
      name: "Default Template",
      baseTemplate: "professional",
      isDefault: true,
      logoUrl: org.logoUrl,
      primaryColor: "#1e40af",
      showCompanyName: true,
      showCompanyAddress: true,
      showCompanyPhone: !!org.phone,
      showCompanyEmail: !!org.email,
      showTaxId: !!org.taxId,
      showPaymentInfo: true,
    },
  });
  
  // 3. Create organization settings
  const settings = await db.organizationSettings.create({
    data: {
      orgId,
      defaultTemplateId: template.id,
      emailSubjectTemplate: `Invoice {{invoiceNumber}} from {{companyName}}`,
      emailBodyTemplate: getDefaultEmailBody(org.name),
      autoReminders: false,
    },
  });
  
  return { paymentInfo, template, settings };
}
```

#### 3.4.2 Invoice Generation with Pre-Filled Data

**First Invoice Creation — Zero Manual Entry Required:**

When a user creates their first invoice after onboarding:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Create Invoice                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  From:                                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Acme Construction LLC          [✓ Pre-filled]           │   │
│  │ 123 Main Street, Suite 100     [✓ Pre-filled]           │   │
│  │ San Francisco, CA 94102        [✓ Pre-filled]           │   │
│  │ Phone: (415) 555-0123          [✓ Pre-filled]           │   │
│  │ Email: billing@acme.com        [✓ Pre-filled]           │   │
│  │ Tax ID: 12-3456789             [✓ Pre-filled]           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  To:                                                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Customer: [Select or create...]                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Invoice Details:                                               │
│  Number: [INV-0001]          Date: [08/21/2026]               │
│  Due Date: [09/20/2026]      Terms: [Net 30 ▼]                │
│  Currency: [USD ($)]         Tax Rate: [0%]                    │
│                                                                 │
│  Line Items:                                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Description              Qty     Rate      Amount        │   │
│  │ [________________]      [__]    [______]   [________]    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [+ Add Item]                                                   │
│                                                                 │
│  Subtotal: $0.00                                                │
│  Tax (0%): $0.00                                                │
│  Total: $0.00                                                   │
│                                                                 │
│  Notes:                                                         │
│  Payment is due within 30 days. Thank you for your business!    │
│                                                                 │
│  [Preview] [Save Draft] [Save & Send]                          │
│                                                                 └─────────────────────────────────────────────────────────────────┘
```

**Pre-Filled Fields from Onboarding:**

| Invoice Field | Source | Auto-Filled |
|---------------|--------|-------------|
| Company name | Organization.name | ✓ |
| Company address | Organization address fields | ✓ |
| Company phone | Organization.phone | ✓ |
| Company email | Organization.email | ✓ |
| Tax ID | Organization.taxId | ✓ |
| Logo | Organization.logoUrl | ✓ |
| Currency | Organization.currency | ✓ |
| Tax rate | Organization.defaultTaxRate | ✓ |
| Payment terms | Organization.defaultPaymentTerms | ✓ |
| Due date | Calculated from terms | ✓ |
| Invoice number | Auto-generated sequence | ✓ |
| Template | Default template | ✓ |

### 3.5 Onboarding Progress Persistence

**State Recovery:**

```typescript
// If user abandons onboarding and returns later
async function resumeOnboarding(userId: string) {
  const state = await db.onboardingState.findUnique({
    where: { userId },
  });
  
  if (!state || state.isComplete) {
    return { shouldOnboard: false };
  }
  
  return {
    shouldOnboard: true,
    resumeAtStep: state.currentStep,
    completedSteps: state.completedSteps,
    savedData: {
      identity: state.identityData,
      contact: state.contactData,
      compliance: state.complianceData,
    },
  };
}
```

**Auto-Save Behavior:**

| Event | Action |
|-------|--------|
| Field blur | Save to OnboardingState JSON |
| Step navigation | Save completedSteps array |
| Form error | Preserve all entered values |
| Page refresh | Restore from server state |
| Session expiry | Persist to localStorage + server |

### 3.6 Onboarding Analytics

**Tracked Events:**

| Event | Properties | Purpose |
|-------|------------|---------|
| `onboarding_started` | method (email/oauth) | Entry point tracking |
| `onboarding_step_completed` | step, time_spent_seconds | Funnel analysis |
| `onboarding_step_abandoned` | step, time_spent_seconds | Drop-off identification |
| `onboarding_completed` | total_time_seconds, method | Success metrics |
| `onboarding_resumed` | step, days_since_abandon | Recovery tracking |

**Key Metrics:**

| Metric | Target |
|--------|--------|
| Signup → Onboarding start | > 80% |
| Onboarding completion rate | > 70% |
| Average onboarding time | < 5 minutes |
| Step 1 → Step 2 conversion | > 90% |
| Step 2 → Step 3 conversion | > 85% |
| Step 3 → Completion | > 95% |
| Abandonment recovery | > 30% |

---

## 4. Security & Compliance

### 4.1 Data Protection

| Data Type | Storage | Encryption | Retention |
|-----------|---------|------------|-----------|
| Passwords | Database | bcrypt (cost 12) | Until account deletion |
| Sessions | Database + Cookie | AES-256 | 30 days inactive |
| Verification tokens | Database | Hashed (SHA-256) | 24 hours after use |
| Tax IDs | Database | AES-256 at rest | Duration of account |
| API keys | Database | AES-256 at rest | Until revoked |

### 4.2 Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| Sign-up | 5 requests | Per IP per hour |
| Login | 10 requests | Per email per 15 min |
| Password reset | 3 requests | Per email per hour |
| Email verification resend | 3 requests | Per email per hour |
| Magic link | 5 requests | Per email per hour |

### 4.3 Audit Logging

```typescript
interface AuditLog {
  id: string;
  userId: string;
  organizationId?: string;
  action: string; // user.login, user.logout, user.password_change, etc.
  ipAddress: string; // Hashed
  userAgent: string;
  metadata: Json; // Action-specific details
  success: boolean;
  failureReason?: string;
  createdAt: DateTime;
}
```

**Logged Events:**

| Event | Level | Retention |
|-------|-------|-----------|
| user.signup | Info | 1 year |
| user.login | Info | 1 year |
| user.logout | Info | 90 days |
| user.password_change | Warning | 3 years |
| user.email_change | Warning | 3 years |
| user.2fa_enabled | Info | 3 years |
| user.2fa_disabled | Warning | 3 years |
| session.revoked | Info | 1 year |
| session.suspicious | Critical | 5 years |

---

## 5. Error Handling

### 5.1 Authentication Errors

| Error | User Message | Action |
|-------|--------------|--------|
| Invalid credentials | "Invalid email or password" | Show generic message |
| Account locked | "Account locked. Try again in 15 minutes." | Show countdown timer |
| Email not verified | "Please verify your email first." | Resend verification link |
| OAuth account exists | "An account with this email already exists. Sign in with password." | Link to login |
| OAuth linking failed | "Could not link account. Please try again." | Retry option |
| Session expired | "Your session expired. Please sign in again." | Redirect to login |

### 5.2 Onboarding Errors

| Error | User Message | Action |
|-------|--------------|--------|
| Organization slug taken | "This business name is already in use." | Suggest alternatives |
| Invalid tax ID format | "Please check your tax ID format." | Show format hint |
| Logo upload failed | "Could not upload logo. Please try again." | Retry upload |
| Address validation failed | "Could not verify address. Please check." | Show manual entry |
| Onboarding timeout | "Your session timed out. Please start over." | Save progress, restart |

---

## 6. Implementation Phases

### Phase 1: Core Authentication (Weeks 1-2)
- Email/password sign-up with validation
- NextAuth.js configuration
- JWT session management
- Basic email verification

### Phase 2: Enhanced Auth (Weeks 3-4)
- Google OAuth integration
- Password reset flow
- Magic link authentication
- Session management UI

### Phase 3: Security Hardening (Weeks 5-6)
- Two-factor authentication (TOTP)
- Device tracking
- Rate limiting
- Audit logging

### Phase 4: Onboarding Flow (Weeks 7-8)
- Multi-step onboarding UI
- Auto-detection of country/currency/timezone
- Address validation
- Logo upload with processing

### Phase 5: Profile Automation (Weeks 9-10)
- Default template generation
- Pre-filled invoice creation
- Onboarding state persistence
- Analytics integration

### Phase 6: Polish (Weeks 11-12)
- Progressive enhancement
- Accessibility audit
- Performance optimization
- Error recovery flows

---

## 7. Open Questions

1. **Phone verification:** Should we require phone verification for any actions?
2. **Business verification:** Should we verify business registration numbers?
3. **Multi-org support:** Should users be able to create multiple organizations?
4. **Onboarding skip:** Should users be able to skip onboarding entirely and configure later?
5. **Data portability:** Should users be able to import business data from other platforms?

---

*End of document*