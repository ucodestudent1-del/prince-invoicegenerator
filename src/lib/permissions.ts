/**
 * Permission vocabulary & default role definitions.
 *
 * This module is pure (zero I/O) so it can be imported by both server actions
 * and unit tests. It defines the resource-and-action permission model
 * (`resource.action`) and the canned permission sets for each system role.
 *
 * Roles are attached to users through `OrganizationMembership`, never on the
 * User row itself. This decouples "who you are" from "what you can do" and lets
 * each organisation customise its own roles without code changes.
 */

// ---------------------------------------------------------------------------
// Resource + Action vocabulary
// ---------------------------------------------------------------------------

export type Resource =
	| "invoices"
	| "payments"
	| "expenses"
	| "projects"
	| "customers"
	| "estimates"
	| "changeOrders"
	| "timeEntries"
	| "catalog"
	| "reports"
	| "team"
	| "settings"
	| "templates";

export type Action = "view" | "create" | "edit" | "delete" | "send" | "approve" | "void" | "export" | "invite" | "remove";

export type Permission = `${Resource}.${Action}`;

/** Invoice lifecycle states. `PENDING_REVIEW` and `APPROVED` are introduced by
 * the permission-aware state machine; the legacy enum kept `UNSENT`/`OVERDUE`
 * but these are intentionally excluded from state-driven authorisation to keep
 * the transition graph predictable. */
export type InvoiceState =
	| "DRAFT"
	| "PENDING_REVIEW"
	| "APPROVED"
	| "SENT"
	| "PARTIALLY_PAID"
	| "PAID"
	| "VOID";

/** Actions that carry financial/state implications and therefore need to be
 * checked against the invoice's current state. */
export type InvoiceAction = "view" | "create" | "edit" | "send" | "approve" | "void" | "delete";

/** Maps an invoice action to its permission string. */
export const INVOICE_ACTION_PERMISSION: Record<InvoiceAction, Permission> = {
	view: "invoices.view",
	create: "invoices.create",
	edit: "invoices.edit",
	send: "invoices.send",
	approve: "invoices.approve",
	void: "invoices.void",
	delete: "invoices.delete",
};

// ---------------------------------------------------------------------------
// The full, canonical set of permissions (used to validate & enumerate)
// ---------------------------------------------------------------------------

export const ALL_PERMISSIONS: Permission[] = [
	"invoices.view",
	"invoices.create",
	"invoices.edit",
	"invoices.send",
	"invoices.approve",
	"invoices.void",
	"invoices.delete",
	"payments.view",
	"payments.create",
	"expenses.view",
	"expenses.create",
	"projects.view",
	"projects.create",
	"customers.view",
	"customers.create",
	"estimates.view",
	"estimates.create",
	"changeOrders.view",
	"changeOrders.create",
	"timeEntries.view",
	"timeEntries.create",
	"catalog.view",
	"catalog.create",
	"reports.view",
	"reports.export",
	"team.invite",
	"team.remove",
	"settings.edit",
	"templates.edit",
];

/**
 * Permissions that are inherently organisation-scoped (not tied to a single
 * project / invoice instance). Everything not listed here is also org-scoped by
 * default for the purposes of membership resolution, but these are the ones that
 * must never be granted at the project level.
 */
export const ORG_SCOPE_ONLY: Permission[] = [
	"team.invite",
	"team.remove",
	"settings.edit",
];

// ---------------------------------------------------------------------------
// System roles
// ---------------------------------------------------------------------------

export interface SystemRoleDef {
	id: string;
	name: string;
	label: string;
	description: string;
	isSystem: true;
}

/** Immutable, built-in roles. `id` is stable and used by the seed/data layer. */
export const SYSTEM_ROLES: SystemRoleDef[] = [
	{
		id: "owner",
		name: "Company Owner",
		label: "Company Owner",
		description: "Complete organisation-level control: manage company information, subscriptions, users, roles, permissions, projects, financial data, invoices, payments, change orders, reports, accounting integrations, payment settings, audit logs, security settings, exports, and ownership transfers.",
		isSystem: true,
	},
	{
		id: "administrator",
		name: "Administrator",
		label: "Administrator",
		description: "Manages operational configuration: users, invitations, roles, project assignments, company settings, invoice templates, notifications, integrations, documents, and audit logs. Restricted from subscription management, payment configuration, ownership transfer, and sensitive financial exports.",
		isSystem: true,
	},
	{
		id: "controller",
		name: "Controller / Finance Manager",
		label: "Controller / Finance Manager",
		description: "Broad financial authority: view financial information, create/edit/approve/void invoices, issue credits, record payments, process refunds, manage retainage, review change-order financial impacts, view AR aging, export financial reports, manage accounting integrations, reconcile payments, and review financial audit history. No access to user administration, security, subscriptions, or ownership settings.",
		isSystem: true,
	},
	{
		id: "accountant",
		name: "Accounting",
		label: "Accounting",
		description: "Accounts receivable focus: create, edit, send, and manage invoices, record and apply payments, view customer balances, review AR aging, send payment reminders, issue credits, view retainage, download invoices, and export financial information. Cannot approve own invoices, change contract values, approve change orders, modify project budgets, or manage users.",
		isSystem: true,
	},
	{
		id: "project_manager",
		name: "Project Manager",
		label: "Project Manager",
		description: "Project-centred: view project and contract info, create/submit change orders, review/approve invoices within authority, view billing and financial summaries, upload documents, review subcontractor info, view retainage, monitor payment status, communicate with customers, and access project reports. No access to unrelated projects, company-wide accounting config, refunds, integrations, or user administration.",
		isSystem: true,
	},
	{
		id: "project_engineer",
		name: "Project Engineer",
		label: "Project Engineer",
		description: "Project administration and billing preparation: view assigned projects, upload documents, enter quantities and progress, create draft invoices, prepare change-order documentation, track commitments, and review subcontractor invoices. Invoices may require Project Manager or Accounting approval before issuance.",
		isSystem: true,
	},
	{
		id: "superintendent",
		name: "Superintendent",
		label: "Superintendent",
		description: "Field operations focus: access assigned projects, enter progress information, upload photos/receipts/delivery tickets, review work completed, add notes, and submit information for billing. Cannot modify sensitive financial records.",
		isSystem: true,
	},
	{
		id: "estimator",
		name: "Estimator",
		label: "Estimator",
		description: "Preconstruction and contract focus: create projects, prepare estimates, view budgets and contract values, create cost codes, prepare proposals, review historical project info, and create draft change orders. No access to payments, refunds, invoice issuance, or accounting settings.",
		isSystem: true,
	},
	{
		id: "field_user",
		name: "Field User",
		label: "Field User",
		description: "Simplified mobile interface for field operations: My Projects, Today's Tasks, Upload Receipt, Upload Photo, Enter Progress, Submit Document. Creates operational information reviewed by project managers or accounting staff.",
		isSystem: true,
	},
	{
		id: "viewer",
		name: "Viewer",
		label: "Viewer",
		description: "Read-only access for executives, owners, investors, or employees who need visibility: view projects, invoices, contracts, payments, reports, and documents. Cannot alter financial or project records.",
		isSystem: true,
	},
	{
		id: "external_customer",
		name: "External Customer",
		label: "External Customer",
		description: "Customer portal access: view invoices and payments for their own projects. Read-only on their own data; cannot alter financial or project records.",
		isSystem: true,
	},
	{
		id: "subcontractor",
		name: "Subcontractor",
		label: "Subcontractor",
		description: "Project-scoped subcontractor access: view assigned projects, log time entries, upload documents, and review project notes. Cannot create invoices, modify financial records, or access unrelated projects.",
		isSystem: true,
	},
];

/** Stable order preserved when rendering the role picker. Owner first. */
export const SYSTEM_ROLE_IDS = [
	"owner",
	"administrator",
	"controller",
	"accountant",
	"project_manager",
	"project_engineer",
	"superintendent",
	"estimator",
	"field_user",
	"viewer",
	"external_customer",
	"subcontractor",
] as const;

export type SystemRoleId = (typeof SYSTEM_ROLE_IDS)[number];

/**
 * The canonical permission set for each system role.
 *
 *  - Owner gets everything.
 *  - Administrator gets everything except `invoices.void` and `invoices.delete`
 *    (destructive financial actions are restricted to the Owner).
 *  - Controller gets invoice create/edit/send/approve/void + payments + expenses +
 *    reports (incl. export) + templates, but no team/settings, no delete.
 *  - Accountant gets invoice create/edit/send/approve (but not void/delete) +
 *    payments + expenses + reports, but no team/settings.
 *  - Project Manager gets project-scoped invoice create/edit/send (no approve,
 *    void, delete), plus customer/estimate read access.
 *  - Project Engineer gets project-scoped read + time entry creation + draft
 *    invoice preparation (no send/approve/void).
 *  - Superintendent gets project-scoped read + time entry creation + document
 *    upload (field ops only, no financial modification).
 *  - Estimator gets preconstruction access: project/estimate/catalog creation,
 *    budget viewing, draft change orders (no payments/refunds/invoice issuance).
 *  - Field User gets project-scoped read + time entry creation (mobile-first).
 *  - Viewer gets read-only access across invoices, projects, customers,
 *    estimates, reports, and templates.
 *  - External Customer gets their own invoices/payments read + payment creation.
 *  - Subcontractor gets project-scoped read + time entry creation (assigned
 *    projects only).
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<SystemRoleId, Permission[]> = {
	owner: [...ALL_PERMISSIONS],
	administrator: [
		"invoices.view",
		"invoices.create",
		"invoices.edit",
		"invoices.send",
		"invoices.approve",
		"invoices.void",
		"payments.view",
		"payments.create",
		"expenses.view",
		"expenses.create",
		"projects.view",
		"projects.create",
		"customers.view",
		"customers.create",
		"estimates.view",
		"estimates.create",
		"changeOrders.view",
		"changeOrders.create",
		"timeEntries.view",
		"timeEntries.create",
		"catalog.view",
		"catalog.create",
		"reports.view",
		"reports.export",
		"team.invite",
		"team.remove",
		"settings.edit",
		"templates.edit",
	],
	controller: [
		"invoices.view",
		"invoices.create",
		"invoices.edit",
		"invoices.send",
		"invoices.approve",
		"invoices.void",
		"payments.view",
		"payments.create",
		"expenses.view",
		"expenses.create",
		"projects.view",
		"customers.view",
		"customers.create",
		"estimates.view",
		"changeOrders.view",
		"changeOrders.create",
		"timeEntries.view",
		"catalog.view",
		"reports.view",
		"reports.export",
		"templates.edit",
	],
	accountant: [
		"invoices.view",
		"invoices.create",
		"invoices.edit",
		"invoices.send",
		"invoices.approve",
		"payments.view",
		"payments.create",
		"expenses.view",
		"expenses.create",
		"projects.view",
		"customers.view",
		"customers.create",
		"estimates.view",
		"timeEntries.view",
		"catalog.view",
		"reports.view",
		"reports.export",
		"templates.edit",
	],
	project_manager: [
		"invoices.view",
		"invoices.create",
		"invoices.edit",
		"invoices.send",
		"projects.view",
		"customers.view",
		"timeEntries.view",
		"estimates.view",
	],
	project_engineer: [
		"invoices.view",
		"projects.view",
		"customers.view",
		"timeEntries.view",
		"timeEntries.create",
		"estimates.view",
		"changeOrders.view",
	],
	superintendent: [
		"invoices.view",
		"projects.view",
		"timeEntries.view",
		"timeEntries.create",
	],
	estimator: [
		"invoices.view",
		"projects.view",
		"projects.create",
		"customers.view",
		"estimates.view",
		"estimates.create",
		"catalog.view",
		"catalog.create",
		"changeOrders.view",
	],
	field_user: [
		"invoices.view",
		"projects.view",
		"customers.view",
		"timeEntries.view",
		"timeEntries.create",
	],
	viewer: [
		"invoices.view",
		"projects.view",
		"expenses.view",
		"customers.view",
		"estimates.view",
		"reports.view",
		"templates.edit",
	],
	external_customer: [
		"invoices.view",
		"payments.view",
		"payments.create",
	],
	subcontractor: [
		"invoices.view",
		"projects.view",
		"timeEntries.view",
		"timeEntries.create",
	],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse `"resource.action"` into its parts. Returns null for unknown perms. */
export function parsePermission(perm: string): { resource: Resource; action: Action } | null {
	const [resource, action] = perm["split"](".") as [string, string | undefined];
	if (!resource || !action) return null;
	return { resource: resource as Resource, action: action as Action };
}

/** Re-join parts into a canonical permission string. */
export function permissionToString(resource: Resource, action: Action): Permission {
	return `${resource}.${action}`;
}

/** True when `perm` is a known, valid permission string. */
export function isValidPermission(perm: string): perm is Permission {
	return (ALL_PERMISSIONS as string[])["includes"](perm);
}

/** Return the system role definition for a role id, or null. */
export function getSystemRole(id: string): SystemRoleDef | null {
	return SYSTEM_ROLES["find"]((r) => r["id"] === id) ?? null;
}

/** Whether a role id is one of the immutable system roles. */
export function isSystemRole(id: string): boolean {
	return SYSTEM_ROLE_IDS["includes"](id as SystemRoleId);
}

/**
 * Validate a list of permission strings. Returns the subset that are invalid.
 */
export function findInvalidPermissions(perms: string[]): string[] {
	return perms["filter"]((p) => !isValidPermission(p));
}

/**
 * Permissions required to perform each invoice action, keyed by action.
 * Used by the state machine to look up the permission before considering the
 * current state.
 */
export function permissionForInvoiceAction(action: InvoiceAction): Permission {
	return INVOICE_ACTION_PERMISSION[action];
}

/** All invoice-state-related permissions in one place for state checks. */
export const INVOICE_PERMISSIONS = [
	"invoices.view",
	"invoices.create",
	"invoices.edit",
	"invoices.send",
	"invoices.approve",
	"invoices.void",
	"invoices.delete",
] as const;
