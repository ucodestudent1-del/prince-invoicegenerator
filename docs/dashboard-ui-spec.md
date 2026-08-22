# Business Management Dashboard — UI/UX Specification

## 1. Design Philosophy

### 1.1 Core Principles

| Principle | Implementation |
|-----------|----------------|
| **At-a-glance clarity** | Critical metrics visible without scrolling |
| **Progressive disclosure** | High-level summary first, drill-down for details |
| **Action-oriented** | Primary workflows accessible within 2 clicks |
| **Visual hierarchy** | Most important information gets the most visual weight |
| **Responsive** | Functional on desktop, tablet, and mobile |

### 1.2 Layout Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Top Navigation Bar (persistent)                                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    HERO SECTION (Personalized)                   │   │
│  │  "Good morning, Sarah"          [Date: August 21, 2026]         │   │
│  │                                                                  │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │   │
│  │  │ Revenue  │ │Outstanding│ │ Overdue  │ │ Paid This│           │   │
│  │  │ $156,250 │ │ $12,500  │ │  $3,200  │ │  $8,750  │           │   │
│  │  │ ↑ 12%    │ │ ↓ 5%     │ │  ↑ 2%    │ │  ↑ 18%   │           │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    QUICK ACTIONS (Primary)                       │   │
│  │                                                                  │   │
│  │  [+ Create Invoice]  [+ Create Client]  [+ Create Estimate]     │   │
│  │  [+ Record Payment]  [+ View Reports]   [+ Send Reminder]       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌────────────────────────────┐  ┌────────────────────────────────┐   │
│  │   FINANCIAL SUMMARY        │  │   REVENUE TREND CHART          │   │
│  │                            │  │                                │   │
│  │  Total Revenue    $156,250 │  │   ▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇         │   │
│  │  ───────────────────────   │  │   ▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇           │   │
│  │  Paid Invoices    $143,750 │  │   ▇▇▇▇▇▇▇▇▇▇▇▇▇▇             │   │
│  │  Outstanding       $12,500 │  │   ▇▇▇▇▇▇▇▇▇▇▇▇               │   │
│  │  Overdue            $3,200 │  │   ▇▇▇▇▇▇▇▇▇▇                 │   │
│  │  Draft              $5,000 │  │   ▇▇▇▇▇▇▇▇                   │   │
│  │  Cancelled              $0 │  │   ▇▇▇▇▇▇         Jan  Jul    │   │
│  │                            │  │                                │   │
│  └────────────────────────────┘  └────────────────────────────────┘   │
│                                                                         │
│  ┌────────────────────────────┐  ┌────────────────────────────────┐   │
│  │   PAID vs UNPAID CHART     │  │   MONTHLY INVOICE VOLUME       │   │
│  │                            │  │                                │   │
│  │      ┌─────────┐           │  │   24  ▇▇▇▇▇▇▇▇                │   │
│  │     ╱  Paid    ╲          │  │   20  ▇▇▇▇▇▇▇▇▇▇▇▇            │   │
│  │    │   92%      │         │  │   16  ▇▇▇▇▇▇▇▇▇▇▇▇▇▇          │   │
│  │     ╲  Unpaid  ╱          │  │   12  ▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇        │   │
│  │      └─────────┘           │  │    8  ▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇      │   │
│  │         8%                 │  │    4  ▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇    │   │
│  │                            │  │       Jan  Feb  Mar  Apr  May   │   │
│  │  ■ Paid: $143,750         │  │                                │   │
│  │  ■ Unpaid: $12,500        │  │                                │   │
│  └────────────────────────────┘  └────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    RECENT ACTIVITY FEED                          │   │
│  │                                                                  │   │
│  │  • Payment received — INV-024 from Acme Corp ($5,000)    2m ago │   │
│  │  • Invoice sent — INV-025 to Globex Inc ($3,750)        15m ago │   │
│  │  • Client viewed — INV-023 was opened by john@acme.com  1h ago │   │
│  │  • Invoice overdue — INV-020 is now 3 days overdue      2h ago │   │
│  │  • Payment recorded — INV-022 from Initech ($8,500)     3h ago │   │
│  │                                                                  │   │
│  │  [View All Activity →]                                          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Hero Section — Personalized Greeting & Key Metrics

### 2.1 Personalized Greeting

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  Good morning, Sarah! 🌤️                                               │
│  Here's what's happening with your business today.                      │
│                                                                         │
│  Friday, August 21, 2026                                                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Time-based Greeting Logic:**
```javascript
const getGreeting = (hour) => {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

const getGreetingIcon = (hour) => {
  if (hour < 12) return "🌤️"; // morning
  if (hour < 17) return "☀️"; // afternoon
  return "🌙"; // evening
};
```

### 2.2 Key Performance Indicators (KPIs)

**Layout:**
```
┌────────────────┐  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│                │  │                │  │                │  │                │
│  Total Revenue │  │  Outstanding   │  │    Overdue     │  │  Paid This     │
│                │  │    Balance     │  │     Amount     │  │    Month       │
│                │  │                │  │                │  │                │
│   $156,250.00  │  │   $12,500.00   │  │    $3,200.00   │  │    $8,750.00   │
│                │  │                │  │                │  │                │
│   ↑ 12% vs     │  │   ↓ 5% vs      │  │    ↑ 2% vs     │  │    ↑ 18% vs    │
│   last month   │  │   last month   │  │    last month  │  │    last month  │
│                │  │                │  │                │  │                │
└────────────────┘  └────────────────┘  └────────────────┘  └────────────────┘
```

**KPI Card Specifications:**

| Metric | Color Indicator | Trend | Click Action |
|--------|----------------|-------|--------------|
| Total Revenue | Blue accent | ↑/↓ percentage | Navigate to Revenue Report |
| Orange accent | Yellow/Orange | ↑/↓ percentage | Filter invoices by "Overdue" |
| Paid This Month | Green accent | ↑/↓ percentage | Navigate to Payments list |

**Visual Design:**
- Large, bold numbers (24-28px font)
- Trend indicator with colored arrow (green for positive, red for negative)
- Subtle card background with light border
- Hover effect reveals click affordance

---

## 3. Quick Actions Section

### 3.1 Layout & Hierarchy

**Design Rationale:** Quick Actions occupy prime real estate directly below the hero section, ensuring users can initiate primary workflows without scrolling or hunting through navigation.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  Quick Actions                                                          │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐│
│  │      +       │  │      +       │  │      +       │  │      +       ││
│  │   Create     │  │   Create     │  │   Create     │  │   Record     ││
│  │   Invoice    │  │   Client     │  │   Estimate   │  │   Payment    ││
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘│
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐                                    │
│  │      📊       │  │      📧       │                                  │
│  │   View        │  │   Send        │                                  │
│  │   Reports     │  │   Reminder    │                                  │
│  └──────────────┘  └──────────────┘                                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Action Button Specifications

| Action | Icon | Color | Primary? | Shortcut |
|--------|------|-------|----------|----------|
| Create Invoice | `+` | Primary (Blue) | Yes | `C` then `I` |
| Create Client | `+` | Secondary | Yes | `C` then `C` |
| Create Estimate | `+` | Secondary | Yes | `C` then `E` |
| Record Payment | `$` | Green | Yes | `R` then `P` |
| View Reports | `📊` | Outline | No | — |
| Send Reminder | `📧` | Outline | No | — |

**Button States:**
- **Default:** Solid fill with icon and label
- **Hover:** Slight elevation increase, color darkens 10%
- **Active:** Pressed state, slight inward shadow
- **Loading:** Spinner replaces icon, text changes to "Creating..."

---

## 4. Financial Summary Module

### 4.1 Layout

```
┌──────────────────────────────────────────────────────────┐
│  Financial Summary                                        │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Total Revenue          $156,250.00                │  │
│  │  ████████████████████████████████████████████████  │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  By Status:                                              │
│                                                          │
│  Paid          $143,750.00    92%    ████████████████▌  │
│  Outstanding   $12,500.00     8%     ██▌                │
│  Overdue       $3,200.00      2%     ▌                  │
│  Draft         $5,000.00      3%     ▌                  │
│  Cancelled     $0.00          0%                        │
│                                                          │
│  [View All Invoices →]                                   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 4.2 Status Breakdown

| Status | Color | Bar Fill | Click Action |
|--------|-------|----------|--------------|
| Paid | Green (#10b981) | Proportional | Filter to paid invoices |
| Outstanding | Blue (#3b82f6) | Proportional | Filter to outstanding |
| Overdue | Red (#ef4444) | Proportional | Filter to overdue |
| Draft | Gray (#6b7280) | Proportional | Filter to drafts |
| Cancelled | Light Gray | Proportional | Filter to cancelled |

---

## 5. Data Visualization (Charts)

### 5.1 Chart Layout Grid

```
┌─────────────────────────────────────┐  ┌─────────────────────────────────────┐
│                                     │  │                                     │
│   Revenue Trend (Line Chart)        │  │   Paid vs Unpaid (Donut Chart)      │
│                                     │  │                                     │
│   $180K │          ╱──╲             │  │          ╭─────────╮               │
│   $150K │    ╱────╱    ╲──╱        │  │         ╱   92%    ╲              │
│   $120K │──╱                    ╲    │  │        │   Paid     │             │
│   $90K  │                        ╲  │  │         ╲  8%     ╱              │
│   $60K  │                         ╲ │  │          ╲Unpaid ╱               │
│   $30K  │                          │  │           ╰─────╯                │
│     $0  └────────────────────────  │  │                                     │
│         Jan  Feb  Mar  Apr  May  Jun│  │   ■ Paid: $143,750                 │
│                                     │  │   ■ Unpaid: $12,500                │
│   [6M] [1Y] [All]                   │  │                                     │
│                                     │  │                                     │
└─────────────────────────────────────┘  └─────────────────────────────────────┘

┌─────────────────────────────────────┐  ┌─────────────────────────────────────┐
│                                     │  │                                     │
│   Monthly Invoice Volume (Bar)      │  │   Outstanding & Overdue (Area)      │
│                                     │  │                                     │
│   30 │   ▇                          │  │   $15K │╲                          │
│   25 │   ▇  ▇                       │  │   $12K │ ╲    ╱╲                  │
│   20 │▇ ▇  ▇  ▇                     │  │   $9K  │  ╲  ╱  ╲                 │
│   15 │▇ ▇  ▇  ▇  ▇                  │  │   $6K  │   ╲╱    ╲    ╱╲          │
│   10 │▇ ▇  ▇  ▇  ▇  ▇               │  │   $3K  │         ╲  ╱  ╲         │
│    5 │▇ ▇  ▇  ▇  ▇  ▇  ▇            │  │    $0  │          ╲╱    ╲        │
│    0 └────────────────────────      │  │         Jan  Feb  Mar  Apr  May    │
│      Jan Feb Mar Apr May Jun        │  │                                     │
│                                     │  │   ── Outstanding  ── Overdue        │
│                                     │  │                                     │
└─────────────────────────────────────┘  └─────────────────────────────────────┘
```

### 5.2 Chart Specifications

#### Revenue Trend (Line Chart)
- **Type:** Area chart with gradient fill
- **X-axis:** Time periods (months)
- **Y-axis:** Revenue amount
- **Interactivity:** Hover tooltip with exact value
- **Time range toggles:** 6M, 1Y, All
- **Color:** Primary blue with gradient fill underneath

#### Paid vs Unpaid (Donut Chart)
- **Type:** Donut/pie chart
- **Segments:** Paid (92%), Unpaid (8%)
- **Center label:** Total amount
- **Legend:** Below chart with amounts
- **Colors:** Green (Paid), Orange (Unpaid)

#### Monthly Invoice Volume (Bar Chart)
- **Type:** Vertical bar chart
- **X-axis:** Months
- **Y-axis:** Number of invoices
- **Interactivity:** Hover shows count + amount
- **Color:** Primary blue with hover highlight

#### Outstanding & Overdue Trends (Area Chart)
- **Type:** Stacked area chart
- **X-axis:** Months
- **Y-axis:** Dollar amount
- **Series:** Outstanding (blue), Overdue (red)
- **Interactivity:** Hover tooltip with breakdown

---

## 6. Recent Activity Feed

### 6.1 Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Recent Activity                                          [View All →] │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  🟢  Payment received — INV-024 from Acme Corp ($5,000)         │  │
│  │      2 minutes ago                                               │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │  📤  Invoice sent — INV-025 to Globex Inc ($3,750)              │  │
│  │      15 minutes ago                                              │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │  👁️  Client viewed — INV-023 was opened by john@acme.com       │  │
│  │      1 hour ago                                                  │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │  🔴  Invoice overdue — INV-020 is now 3 days overdue            │  │
│  │      2 hours ago                                                 │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │  💰  Payment recorded — INV-022 from Initech ($8,500)           │  │
│  │      3 hours ago                                                 │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │  📊  Invoice created — INV-026 for Acme Corp ($2,500)           │  │
│  │      5 hours ago                                                 │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Activity Types & Icons

| Activity Type | Icon | Color | Description |
|---------------|------|-------|-------------|
| Payment Received | 🟢 | Green | Client paid an invoice |
| Invoice Sent | 🔵 | Blue | Invoice emailed to client |
| Client Viewed | 👁️ | Gray | Client opened/viewed invoice |
| Invoice Overdue | 🔴 | Red | Invoice passed due date |
| Payment Recorded | 💰 | Green | Manual payment recorded |
| Invoice Created | 📊 | Purple | New invoice created |
| Estimate Sent | 📋 | Orange | Estimate emailed to client |
| Reminder Sent | 📧 | Yellow | Payment reminder sent |

### 6.3 Activity Feed Behavior
- **Chronological order:** Most recent first
- **Auto-refresh:** Poll every 60 seconds for new activity
- **Pagination:** Show 10 most recent, "View All" for full history
- **Clickable items:** Click invoice number to view invoice detail
- **Empty state:** "No recent activity. Create your first invoice to get started!"

---

## 7. Visual Hierarchy & UX Best Practices

### 7.1 Information Architecture

```
Priority 1 (Above the fold):
├── Personalized greeting
├── KPI cards (4 metrics)
└── Quick actions (6 buttons)

Priority 2 (Scroll to view):
├── Financial summary breakdown
├── Revenue trend chart
└── Paid vs Unpaid chart

Priority 3 (Further down):
├── Monthly invoice volume
├── Outstanding/Overdue trends
└── Recent activity feed
```

### 7.2 Color System

| Purpose | Color | Hex | Usage |
|---------|-------|-----|-------|
| Primary | Blue | #3b82f6 | CTAs, links, paid status |
| Success | Green | #10b981 | Positive trends, paid amounts |
| Warning | Orange | #f59e0b | Outstanding balances |
| Danger | Red | #ef4444 | Overdue, negative trends |
| Neutral | Gray | #6b7280 | Draft, cancelled, secondary text |
| Background | Light Gray | #f9fafb | Card backgrounds |

### 7.3 Typography Scale

| Element | Size | Weight | Color |
|---------|------|--------|-------|
| Greeting | 24px | Bold | #111827 |
| KPI Value | 28px | Bold | #111827 |
| KPI Label | 12px | Medium | #6b7280 |
| Section Title | 18px | Semibold | #111827 |
| Body Text | 14px | Regular | #374151 |
| Timestamp | 12px | Regular | #9ca3af |

### 7.4 Spacing & Grid

```
Desktop (≥1024px):
├── Max-width: 1280px
├── Grid: 12 columns
├── Gap: 24px
└── Padding: 32px

Tablet (768-1023px):
├── Max-width: 100%
├── Grid: 8 columns
├── Gap: 16px
└── Padding: 24px

Mobile (<768px):
├── Max-width: 100%
├── Grid: 4 columns (single column for most)
├── Gap: 12px
└── Padding: 16px
```

### 7.5 Interaction Patterns

| Pattern | Implementation |
|---------|----------------|
| **Hover states** | Cards elevate (shadow increase), buttons darken |
| **Click feedback** | Ripple effect on buttons, card press animation |
| **Loading states** | Skeleton screens for data, spinners for actions |
| **Empty states** | Illustration + CTA to create first record |
| **Error states** | Inline error messages with retry option |
| **Success feedback** | Toast notification for completed actions |

### 7.6 Accessibility

| Requirement | Implementation |
|-------------|----------------|
| **Color contrast** | Minimum 4.5:1 for text, 3:1 for large text |
| **Keyboard navigation** | All interactive elements reachable via Tab |
| **Screen readers** | ARIA labels on icons, semantic HTML |
| **Focus indicators** | Visible focus ring on all interactive elements |
| **Reduced motion** | Respect `prefers-reduced-motion` setting |

---

## 8. Responsive Behavior

### 8.1 Desktop (≥1024px)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Good morning, Sarah!                                                   │
│                                                                         │
│  [Revenue] [Outstanding] [Overdue] [Paid This Month]                   │
│                                                                         │
│  [Create Invoice] [Create Client] [Create Estimate] [Record Payment]    │
│                                                                         │
│  ┌─────────────────────┐  ┌─────────────────────────────────────────┐  │
│  │  Financial Summary  │  │  Revenue Trend                          │  │
│  │                     │  │                                         │  │
│  │  Paid: $143,750     │  │  ╱──╲                                   │  │
│  │  Outstanding: $12,500│  │ ╱    ╲──╱                              │  │
│  │  Overdue: $3,200    │  │                                         │  │
│  │                     │  │                                         │  │
│  └─────────────────────┘  └─────────────────────────────────────────┘  │
│                                                                         │
│  ┌─────────────────────┐  ┌─────────────────────────────────────────┐  │
│  │  Paid vs Unpaid     │  │  Monthly Volume                         │  │
│  │                     │  │                                         │  │
│  │     ╭───╮           │  │  ▇▇▇▇▇▇▇▇                              │  │
│  │    │92% │           │  │  ▇▇▇▇▇▇▇▇▇▇▇▇                          │  │
│  │     ╰───╯           │  │  ▇▇▇▇▇▇▇▇▇▇▇▇▇▇                        │  │
│  │                     │  │                                         │  │
│  └─────────────────────┘  └─────────────────────────────────────────┘  │
│                                                                         │
│  Recent Activity                                                        │
│  • Payment received — INV-024 ($5,000) 2m ago                         │
│  • Invoice sent — INV-025 ($3,750) 15m ago                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Tablet (768-1023px)

```
┌───────────────────────────────────────────────────┐
│  Good morning, Sarah!                             │
│                                                   │
│  [Revenue] [Outstanding]                         │
│  [Overdue] [Paid This Month]                     │
│                                                   │
│  [Create Invoice] [Create Client]                │
│  [Create Estimate] [Record Payment]              │
│                                                   │
│  ┌─────────────────────────────────────────────┐  │
│  │  Financial Summary                          │  │
│  └─────────────────────────────────────────────┘  │
│                                                   │
│  ┌─────────────────────────────────────────────┐  │
│  │  Revenue Trend                              │  │
│  └─────────────────────────────────────────────┘  │
│                                                   │
│  ┌─────────────────────────────────────────────┐  │
│  │  Paid vs Unpaid                             │  │
│  └─────────────────────────────────────────────┘  │
│                                                   │
│  Recent Activity                                  │
│  • Payment received — INV-024 ($5,000) 2m ago   │
│                                                   │
└───────────────────────────────────────────────────┘
```

### 8.3 Mobile (<768px)

```
┌─────────────────────────┐
│  Good morning, Sarah!   │
│                         │
│  [Revenue] [Outstanding]│
│  [Overdue] [Paid Month] │
│                         │
│  [+ Invoice] [+ Client] │
│  [+ Estimate] [+ Payment│
│                         │
│  Financial Summary      │
│  Paid: $143,750         │
│  Outstanding: $12,500   │
│  Overdue: $3,200        │
│                         │
│  Revenue Trend          │
│  ╱──╲                   │
│ ╱    ╲──╱              │
│                         │
│  Recent Activity        │
│  • Payment — $5,000    │
│  • Invoice — $3,750    │
│                         │
└─────────────────────────┘
```

---

## 9. Technical Implementation Notes

### 9.1 Data Fetching Strategy

| Data | Fetch Strategy | Cache Duration |
|------|----------------|----------------|
| KPIs | Server-side on page load | 5 minutes |
| Financial Summary | Server-side on page load | 5 minutes |
| Charts | Client-side fetch after mount | 10 minutes |
| Activity Feed | Client-side with polling | 60 seconds |
| Quick Actions | Static (no fetch) | N/A |

### 9.2 Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| First Contentful Paint | < 1.5s | Lighthouse |
| Largest Contentful Paint | < 2.5s | Lighthouse |
| Time to Interactive | < 3.0s | Lighthouse |
| Cumulative Layout Shift | < 0.1 | Lighthouse |
| Chart render time | < 500ms | Custom timing |

### 9.3 Component Structure

```
dashboard/
├── page.tsx                    # Main dashboard page (server component)
├── layout.tsx                  # Dashboard layout wrapper
├── _components/
│   ├── HeroSection.tsx         # Greeting + KPIs
│   ├── QuickActions.tsx        # Action buttons
│   ├── FinancialSummary.tsx    # Status breakdown
│   ├── RevenueChart.tsx        # Line/area chart
│   ├── PaidVsUnpaidChart.tsx   # Donut chart
│   ├── VolumeChart.tsx         # Bar chart
│   ├── OutstandingChart.tsx    # Stacked area chart
│   ├── ActivityFeed.tsx        # Recent activity list
│   └── KPICard.tsx             # Individual KPI card
├── _hooks/
│   ├── useDashboardData.ts     # Data fetching hook
│   └── useActivityFeed.ts      # Activity polling hook
└── _utils/
    ├── formatCurrency.ts       # Currency formatting
    ├── formatPercentage.ts     # Percentage formatting
    └── getGreeting.ts          # Time-based greeting
```

### 9.4 State Management

| State | Location | Persistence |
|-------|----------|-------------|
| Dashboard data | React Query / SWR | 5-minute stale time |
| Activity feed | React Query / SWR | 60-second polling |
| Chart time range | Local state | Session storage |
| User preferences | Context API | Local storage |

---

## 10. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Dashboard load time | < 2 seconds | Server timing |
| Task completion rate | > 80% | Analytics (create invoice, etc.) |
| User engagement | Daily active users | Analytics |
| Error rate | < 0.5% | Error tracking |
| User satisfaction | > 4.5/5 | In-app survey |

---

## 11. Future Enhancements

| Feature | Priority | Description |
|---------|----------|-------------|
| Customizable widgets | Medium | Drag-and-drop dashboard customization |
| Date range picker | Medium | Filter all data by custom date range |
| Export dashboard | Low | Download dashboard as PDF |
| Dark mode | Medium | Toggle between light/dark themes |
| Notifications bell | Medium | Real-time notification center |
| Goal tracking | Low | Set and track revenue goals |
| Team activity | Low | See team member actions |
| Mobile app | Low | Native mobile dashboard |

---

## 12. Open Questions

1. **Real-time updates:** Should the dashboard use WebSockets for real-time updates, or is polling sufficient? → **Decision: Polling for v1; WebSockets for v2**

2. **Chart library:** Which charting library should be used? → **Decision: Recharts (React-native, already in project)**

3. **Date range default:** What should the default date range be? → **Decision: Current year to date**

4. **Empty state behavior:** Should empty states show sample data or just CTAs? → **Decision: CTA-focused with illustration**

5. **Permission levels:** Should all users see the same dashboard? → **Decision: Role-based (owners see all, members see limited)**