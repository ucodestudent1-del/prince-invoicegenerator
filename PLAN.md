# Plan: Comprehensive Team Roles RBAC System for Construction Invoice SaaS

## Summary

Transform the Team section from a simple employee invitation page into a comprehensive role-based access control system tailored for construction companies. The existing codebase already has the RBAC *infrastructure* (permissions vocabulary, system role definitions, authorization service, database schema, server actions) but it is **dormant** — system roles are never seeded, membership rows are never created, the invite form uses legacy enum roles, and there is no Roles management UI or member directory operations.

This plan wires the existing RBAC machinery into the live flows and builds the complete Team management UI per the construction industry role model specified.

## Current State Analysis

### Already Built (Infrastructure — needs wiring)
- **`src/lib/permissions.ts`** — 13 resources × 10 actions = 28 permissions; 5 system roles defined (`owner`, `administrator`, `accountant`, `project_manager`, `field_worker`)
- **`src/lib/authorization.ts`** — `authorize()`, `resolveOrgPermissions()`, `resolveUserPermissions()` with legacy fallback
- **`src/lib/authorization-policy.ts`** — pure policy with invoice state machine
- **`src/lib/actions/roles.ts`** — `listRoles`, `getRole`, `createRole`, `updateRole`, `deleteRole` (no UI)
- **`src/lib/actions/memberships.ts`** — `listMemberships`, `updateMemberRole`, `removeMember`, plus uncalled `ensureSystemRoles` / `syncMembershipFromLegacyRole`
- **`src/lib/actions/team.ts`** — `inviteTeamMember` (uses legacy role enum)
- **Schema** — `OrganizationRole`, `OrganizationRolePermission`, `OrganizationMembership`, `ProjectMember` tables exist with migrations

### Gaps to Fill
1. System roles never seeded (`ensureSystemRoles` has zero callers)
2. No membership backfill on login/org creation (`syncMembershipFromLegacyRole` has zero callers)
3. Invite form uses legacy `OWNER | ADMIN | MEMBER | VIEWER` enum, not system roles
4. No Roles management UI page
5. No member directory row actions (change role, deactivate/reactivate, resend invite, assign projects, view activity)
6. `listMemberships` doesn't include invitation status, account status, last activity, job title, or assigned projects
7. Settings page uses legacy `user.role` check instead of `authorize(..., "settings.edit")`
8. Customization actions have no `settings.edit` permission guard
9. Only 5 system roles defined; spec calls for ~12 roles (Owner, Administrator, Controller/Finance Manager, Accounting, Project Manager, Project Engineer, Superintendent, Estimator, Field User, Viewer, External Customer, Subcontractor)

## Implementation Phases

### Phase 1: Expand System Roles to Construction Industry Model

**File: `src/lib/permissions.ts`**

Expand `SYSTEM_ROLES` and `DEFAULT_ROLE_PERMISSIONS` from 5 to 12 roles matching the construction domain:

| ID | Label | Key Permissions | Scope |
|----|-------|----------------|-------|
| `owner` | Company Owner | All 28 permissions | Org-wide |
| `administrator` | Administrator | All except `invoices.void`, `invoices.delete` | Org-wide (no subscription/payment/ownership) |
| `controller` | Controller / Finance Manager | invoices.\* (incl. void/approve), payments.\*, expenses.\*, reports.\* (incl. export), changeOrders.\* (view/create), templates.\* | Org-wide (no team/settings/subscription) |
| `accountant` | Accounting | invoices create/edit/send/approve, payments view/create, expenses view/create, customers view/create, reports view/export, templates edit | Org-wide (no team/settings/void/delete, no approve-self) |
| `project_manager` | Project Manager | invoices create/edit/send (project-scoped), projects view, customers view, timeEntries view, estimates view | Project-scoped (no approve/void/company-wide-accounting) |
| `project_engineer` | Project Engineer | projects view, invoices view/create (draft only), estimates view, timeEntries view/create, changeOrders view, documents upload | Project-scoped (no issue/send/approve, no accounting integrations) |
| `superintendent` | Superintendent | projects view, timeEntries view/create, invoices view, documents upload, progress entry | Project-scoped (no financial modification) |
| `estimator` | Estimator | projects create, estimates view/create, customers view, catalog view/create, changeOrders view (draft) | Preconstruction-scoped (no payments/refunds/invoice issuance) |
| `field_user` | Field User | projects view, invoices view, timeEntries view/create, documents upload | Mobile/project (simplified interface) |
| `viewer` | Viewer | read-only: invoices view, projects view, customers view, estimates view, reports view | Org-wide (no mutations) |
| `external_customer` | External Customer | invoices view, payments view/create (own invoices only) | Customer-scoped |
| `subcontractor` | Subcontractor | projects view (assigned only), invoices view, timeEntries view/create, documents upload | Project-scoped (assigned projects only) |

**New permission resources added** (if needed beyond existing 13):
- `projects` already covers project access
- `changeOrders` already covers change order access
- `expenses` already covers expense access
- `estimates` already covers estimate access

**Key permission mapping changes:**
- `controller` role: add `invoices.void` + `invoices.approve` + `invoices.delete` (broad financial authority)
- `accountant` role: keep existing minus void/delete, add `expenses.create`
- `project_engineer`: project-scoped create on invoices (draft), view on changeOrders
- `superintendent`: view invoices, create timeEntries, view projects (no invoice creation)
- `estimator`: projects.create, estimates.create, catalog.create (preconstruction focus)
- `viewer`: view-only across invoices, projects, customers, estimates, reports, templates
- `external_customer`: invoices.view, payments.view, payments.create (limited to own invoices)
- `subcontractor`: projects.view, timeEntries.view/create, documents view (assigned projects)

### Phase 2: Wire RBAC Seeding into Onboarding and Login

**File: `src/lib/actions/onboarding.ts`**
- After org creation in `completeOnboarding()`, call `ensureSystemRoles(orgId)` to seed the 12 system roles
- After creating the owner's `OrganizationMembership`, assign the `owner` role

**File: `src/lib/auth.ts`** (session callback)
- After resolving user session, call `syncMembershipFromLegacyRole(user.id, organizationId)` to backfill any user whose legacy `User.role` column is set but has no `OrganizationMembership` row
- This makes the RBAC tables the source of truth on every subsequent login

**File: `src/lib/actions/memberships.ts`**
- Update `syncMembershipFromLegacyRole` mapping to map legacy roles to the expanded system roles:
  - `OWNER` → `owner`
  - `ADMIN` → `administrator`
  - `MEMBER` → `project_manager`
  - `VIEWER` → `viewer` (changed from `field_worker`)

### Phase 3: Expand Member Directory Data Model

**File: `src/lib/actions/memberships.ts`**
- Update `MembershipRow` interface to include:
  - `jobTitle: string | null` — from a new `jobTitle` column on `User` OR from `OrganizationMembership.jobTitle`
  - `assignedProjectIds: string[]` — projects the user is assigned to (from `ProjectMember` table)
  - `assignedProjectNames: string[]` — human-readable project names
  - `accountStatus: "active" | "invited" | "inactive" | "deactivated"` — derived
  - `invitationStatus: "accepted" | "pending" | "expired" | "not_invited"` — derived from email verification + membership presence
  - `lastActivity: Date | null` — from `AuditLog` most recent `createdAt` for this user, or `Session` last `updatedAt`, or `OnboardingState.lastActiveAt`
  - `roleId` / `roleName` / `permissions` — already present

- Add `listProjectsForOrg(orgId)` helper (query `Project` scoped by orgId, return id + name)

**File: `prisma/schema.prisma`**
- Add `jobTitle String?` column to `User` model (to distinguish job title from system role)
- Add `jobTitle String?` column to `OrganizationMembership` model (allows per-org-title override)
- Add `invitedById String?` to `OrganizationMembership` (tracks who invited)
- Add `invitedAt DateTime?` and `invitationAcceptedAt DateTime?` to `OrganizationMembership`

**File: `prisma/migrations/<timestamp>_expand_membership_fields/migration.sql`** — new migration

### Phase 4: Rewrite Invite Flow to Use System Roles

**File: `src/lib/actions/team.ts`**
- Change `InviteTeamMemberInput.role` from legacy enum to `SystemRoleId`
- `inviteTeamMember`:
  - Resolve caller permissions, require `team.invite`
  - Look up system role via `getRole(roleId, orgId)` to validate it exists
  - Create user with legacy `role` column mapped from the system role (fallback compatibility)
  - Create `OrganizationMembership` row with the `roleId` pointing to the system role
  - Set `jobTitle` on the membership if provided
  - Write `PASSWORD_RESET` verification token + send invite email (existing behavior)
  - Audit `USER_INVITED` with system role id

**File: `src/components/team/invite-team-member-form.tsx`**
- Replace legacy role select with system role picker using `listRoles` data
- Add optional "Job Title" field
- Show system role descriptions as helper text

### Phase 5: Member Directory Row Actions (Server Actions)

**File: `src/lib/actions/memberships.ts`** — Add new actions:

1. **`resendInvitation({ orgId, userId })`**
   - Require `team.invite`
   - Generate new password-reset token, send email
   - Audit `INVITATION_RESENT`

2. **`deactivateMember({ orgId, userId })`**
   - Require `team.remove` (or a new `team.deactivate` permission in `settings.edit`)
   - Set `OrganizationMembership.isActive = false` (new column) and `User` deactivated flag
   - Audit `MEMBER_DEACTIVATED`

3. **`reactivateMember({ orgId, userId })`**
   - Require `team.invite`
   - Clear deactivation flag
   - Audit `MEMBER_REACTIVATED`

4. **`assignProjects({ orgId, userId, projectIds })`**
   - Require `projects.create` or `settings.edit`
   - Upsert `ProjectMember` rows for the user on each project
   - Audit `PROJECTS_ASSIGNED`

5. **`updateMemberJobTitle({ orgId, userId, jobTitle })`**
   - Require `team.invite`
   - Update `OrganizationMembership.jobTitle`
   - Audit `JOB_TITLE_CHANGED`

### Phase 6: Roles Management UI Page

**New file: `src/app/[locale]/dashboard/settings/roles/page.tsx`**
- Server component listing all roles via `listRoles(orgId)`
- Each role card shows: name, description, permission count, member count, editable/system badge
- System roles are read-only (view permissions only)
- Custom roles have edit/delete buttons (if `settings.edit` permission)
- "Create Custom Role" button → opens a form to create a custom role with name, description, and permission toggles
- Permission toggles organized by resource group (invoices, payments, projects, etc.) with checkboxes

**New file: `src/components/team/role-form.tsx`** (client component)
- Form for creating/editing custom roles
- Permission matrix: resources as rows, actions as columns
- Zod validation

### Phase 7: Rewrite Team Page as Comprehensive Member Directory

**File: `src/app/[locale]/dashboard/team/page.tsx`**
- Replace the current simple table with a comprehensive directory
- Columns: Avatar+Name, Email, Job Title, System Role (badge), Assigned Projects (comma-separated), Account Status (badge), Invitation Status (badge), Last Activity, Permissions (badge list)
- Row actions dropdown menu:
  - "Change Role" → opens role selector modal
  - "Resend Invitation" (only for invited/pending users)
  - "Deactivate" / "Reactivate" (only for active/inactive users)
  - "Assign Projects" → opens project selector modal
  - "Change Job Title" → inline edit
  - "View Activity" → navigates to audit log view for this user
  - "Remove from Team" (only if `team.remove`)
- Invite form at top uses system roles (Phase 4)

**New file: `src/components/team/member-action-menu.tsx`** — dropdown menu component
**New file: `src/components/team/change-role-dialog.tsx`** — role selector modal
**New file: `src/components/team/assign-projects-dialog.tsx`** — project selector modal
**New file: `src/components/team/member-activity-view.tsx`** — audit log viewer for a user

### Phase 8: User Activity / Audit Log

**File: `src/lib/actions/memberships.ts`**
- Add `getUserActivity({ userId, orgId })` — queries `AuditLog` for all entries where `actorId = userId` or `targetId = userId`, ordered by `createdAt desc`, limited to 100

**File: `src/components/team/member-activity-view.tsx`**
- Table showing: Date, Event, Action, Category, Target, Outcome
- Filters by category

### Phase 9: Fix Settings Page Authorization

**File: `src/app/[locale]/dashboard/settings/page.tsx`**
- Replace `canManageData = user.role === "OWNER" || user.role === "ADMIN"` with `authorize(user.id, orgId, "settings.edit")`
- Gate data management actions behind `settings.edit` permission

**File: `src/lib/actions/data.ts`**
- Update `requireOrgAdmin()` to use `authorize(user.id, orgId, "settings.edit")` instead of legacy role check

**File: `src/lib/actions/customization.ts`**
- Add `authorize({ userId: user.id, orgId, permission: "settings.edit" })` to all save methods (`saveThemeSettings`, `saveBrandColors`, `saveFontSettings`, `saveLayoutSettings`)

### Phase 10: Add "Team" Link to Settings Hub

**File: `src/app/[locale]/dashboard/settings/page.tsx`**
- Add a card linking to `/dashboard/settings/roles` (Roles & Permissions management)

### Phase 11: i18n Updates

**Files: `src/messages/{en,fr,es,de}.json`**
- Expand `team` namespace with new keys: `jobTitle`, `systemRole`, `assignedProjects`, `accountStatus`, `invitationStatus`, `lastActivity`, `permissions`, `actions`, `changeRole`, `resendInvitation`, `deactivate`, `reactivate`, `assignProjects`, `viewActivity`, `remove`, `statusActive`, `statusInvited`, `statusInactive`, `statusDeactivated`, `invitePending`, `inviteAccepted`, `inviteExpired`, `roles`, `rolesDescription`, `createRole`, `roleName`, `roleDescription`, `editRole`, `deleteRole`, `customRole`, `systemRole`, `permissionMatrix`

### Phase 12: Tests

**File: `tests/team-rbac.test.ts`** (new)
- Test new permission mappings for all 12 system roles
- Test that controller has `invoices.void` but accountant does not
- Test that estimator has `projects.create` but not `payments.create`
- Test that subcontractor has `timeEntries.create` but not `invoices.create`
- Test `listMemberships` returns expanded fields (jobTitle, assignedProjects, statuses, lastActivity)

**File: `tests/permissions.test.ts`**
- Update system role count from 5 to 12
- Update role permission assertions to match new construction roles

---

## Execution Order

1. **Phase 1** — Expand `permissions.ts` (new roles + permissions) — *unblocks Phase 2, 4, 6, 7*
2. **Phase 12** — Update `permissions.test.ts` for new role count
3. **Phase 2** — Wire `ensureSystemRoles` into onboarding + `syncMembershipFromLegacyRole` into auth session callback
4. **Phase 3** — Schema migration + expand `MembershipRow` + project listing helper
5. **Phase 4** — Rewrite `inviteTeamMember` + `invite-team-member-form.tsx`
6. **Phase 5** — Add member action server actions (resend, deactivate/reactivate, assign projects, job title)
7. **Phase 7** — Rewrite Team page as directory + new UI components
8. **Phase 6** — Roles management UI page
9. **Phase 8** — User activity view
10. **Phase 9** — Fix Settings page + data.ts + customization.ts authorization
11. **Phase 10** — Add Roles card to Settings hub
12. **Phase 11** — i18n translations
13. **Phase 12** — New test file `team-rbac.test.ts`

## Files to Create

| File | Purpose |
|------|---------|
| `src/app/[locale]/dashboard/settings/roles/page.tsx` | Roles management page |
| `src/components/team/role-form.tsx` | Custom role create/edit form |
| `src/components/team/member-action-menu.tsx` | Per-member dropdown actions |
| `src/components/team/change-role-dialog.tsx` | Role selector modal |
| `src/components/team/assign-projects-dialog.tsx` | Project assignment modal |
| `src/components/team/member-activity-view.tsx` | Audit log viewer for a user |
| `prisma/migrations/20260907000000_expand_membership_fields/migration.sql` | Schema migration |
| `tests/team-rbac.test.ts` | RBAC permission mapping tests |
| `docs/team-rbac-spec.md` | Reference spec for construction roles |

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/permissions.ts` | Expand 5→12 system roles, update `DEFAULT_ROLE_PERMISSIONS`, update `SYSTEM_ROLE_IDS` |
| `src/lib/actions/onboarding.ts` | Call `ensureSystemRoles` + create owner membership after org creation |
| `src/lib/auth.ts` | Call `syncMembershipFromLegacyRole` in session callback |
| `src/lib/actions/memberships.ts` | Expand `MembershipRow`, add project listing, update legacy mapping, add 5 new actions |
| `src/lib/actions/team.ts` | Switch invite input to `SystemRoleId`, pass `jobTitle` |
| `src/components/team/invite-team-member-form.tsx` | Use system role picker + job title field |
| `src/app/[locale]/dashboard/team/page.tsx` | Full directory rewrite with row actions |
| `src/app/[locale]/dashboard/settings/page.tsx` | `authorize(settings.edit)` + Roles card |
| `src/lib/actions/data.ts` | Replace `requireOrgAdmin` legacy check with `authorize` |
| `src/lib/actions/customization.ts` | Add `authorize(settings.edit)` to all save methods |
| `prisma/schema.prisma` | Add `jobTitle`, `isActive`, `invitedById`, `invitedAt`, `invitationAcceptedAt` fields |
| `tests/permissions.test.ts` | Update for 12 roles |
| `src/messages/{en,fr,es,de}.json` | New i18n keys |

## Risk Mitigation

- **Schema drift tolerance**: All new DB columns follow the existing `isMissingColumnError` fallback pattern. Every query that touches new columns has a try/catch with a reduced-column fallback.
- **Backward compatibility**: Legacy `User.role` column is still written (for the session callback and any code reading it directly) but is no longer the source of truth for permissions. System roles are the primary path; legacy is the fallback.
- **Graceful degradation**: If `OrganizationMembership` / `OrganizationRole` tables are absent, `listMemberships` falls back to legacy `User.role` (existing behavior) and the UI still renders.
- **No breaking migrations**: New columns are all optional (`String?`, `Boolean?` with defaults, `DateTime?`), so existing databases continue working without migration.
