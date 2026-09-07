import { describe, expect, it } from "vitest";
import {
	ALL_PERMISSIONS,
	DEFAULT_ROLE_PERMISSIONS,
	SYSTEM_ROLE_IDS,
	SYSTEM_ROLES,
	ORG_SCOPE_ONLY,
	isValidPermission,
	getSystemRole,
	isSystemRole,
	findInvalidPermissions,
	INVOICE_ACTION_PERMISSION,
	INVOICE_PERMISSIONS,
	parsePermission,
	permissionToString,
} from "@/lib/permissions";

describe("team RBAC — expanded construction industry roles", () => {
	it("exposes exactly 12 system roles", () => {
		expect(SYSTEM_ROLES.length).toBe(12);
		expect(SYSTEM_ROLE_IDS.length).toBe(12);
	});

	it("every system role has a permission set", () => {
		for (const id of SYSTEM_ROLE_IDS) {
			expect(DEFAULT_ROLE_PERMISSIONS[id].length).toBeGreaterThan(0);
		}
	});

	it("owner has every permission", () => {
		const ownerPerms = new Set(DEFAULT_ROLE_PERMISSIONS.owner);
		for (const perm of ALL_PERMISSIONS) {
			expect(ownerPerms.has(perm)).toBe(true);
		}
	});

  it("administrator can void invoices but cannot delete", () => {
    expect(DEFAULT_ROLE_PERMISSIONS.administrator).toContain("invoices.void");
    expect(DEFAULT_ROLE_PERMISSIONS.administrator).not.toContain("invoices.delete");
    expect(DEFAULT_ROLE_PERMISSIONS.administrator).toContain("settings.edit");
  });

	it("controller has full financial authority including void/approve", () => {
		expect(DEFAULT_ROLE_PERMISSIONS.controller).toContain("invoices.void");
		expect(DEFAULT_ROLE_PERMISSIONS.controller).toContain("invoices.approve");
		expect(DEFAULT_ROLE_PERMISSIONS.controller).toContain("payments.view");
		expect(DEFAULT_ROLE_PERMISSIONS.controller).toContain("payments.create");
		expect(DEFAULT_ROLE_PERMISSIONS.controller).toContain("reports.export");
		expect(DEFAULT_ROLE_PERMISSIONS.controller).not.toContain("team.invite");
		expect(DEFAULT_ROLE_PERMISSIONS.controller).not.toContain("team.remove");
		expect(DEFAULT_ROLE_PERMISSIONS.controller).not.toContain("settings.edit");
	});

	it("accountant can approve but not void invoices", () => {
		expect(DEFAULT_ROLE_PERMISSIONS.accountant).toContain("invoices.approve");
		expect(DEFAULT_ROLE_PERMISSIONS.accountant).not.toContain("invoices.void");
		expect(DEFAULT_ROLE_PERMISSIONS.accountant).not.toContain("invoices.delete");
		expect(DEFAULT_ROLE_PERMISSIONS.accountant).not.toContain("team.invite");
		expect(DEFAULT_ROLE_PERMISSIONS.accountant).not.toContain("settings.edit");
	});

	it("project manager can create and send invoices but not approve/void", () => {
		expect(DEFAULT_ROLE_PERMISSIONS.project_manager).toContain("invoices.create");
		expect(DEFAULT_ROLE_PERMISSIONS.project_manager).toContain("invoices.send");
		expect(DEFAULT_ROLE_PERMISSIONS.project_manager).not.toContain("invoices.approve");
		expect(DEFAULT_ROLE_PERMISSIONS.project_manager).not.toContain("invoices.void");
		expect(DEFAULT_ROLE_PERMISSIONS.project_manager).not.toContain("invoices.delete");
		expect(DEFAULT_ROLE_PERMISSIONS.project_manager).not.toContain("settings.edit");
		expect(DEFAULT_ROLE_PERMISSIONS.project_manager).not.toContain("team.invite");
	});

	it("project engineer can view invoices but not create them", () => {
		expect(DEFAULT_ROLE_PERMISSIONS.project_engineer).toContain("invoices.view");
		expect(DEFAULT_ROLE_PERMISSIONS.project_engineer).toContain("timeEntries.create");
		expect(DEFAULT_ROLE_PERMISSIONS.project_engineer).not.toContain("invoices.create");
		expect(DEFAULT_ROLE_PERMISSIONS.project_engineer).not.toContain("invoices.send");
		expect(DEFAULT_ROLE_PERMISSIONS.project_engineer).not.toContain("invoices.approve");
		expect(DEFAULT_ROLE_PERMISSIONS.project_engineer).not.toContain("settings.edit");
	});

	it("superintendent has no invoice creation rights", () => {
		expect(DEFAULT_ROLE_PERMISSIONS.superintendent).toContain("invoices.view");
		expect(DEFAULT_ROLE_PERMISSIONS.superintendent).toContain("timeEntries.create");
		expect(DEFAULT_ROLE_PERMISSIONS.superintendent).not.toContain("invoices.create");
		expect(DEFAULT_ROLE_PERMISSIONS.superintendent).not.toContain("invoices.edit");
		expect(DEFAULT_ROLE_PERMISSIONS.superintendent).not.toContain("settings.edit");
	});

	it("estimator can create projects and estimates but not payments or invoices", () => {
		expect(DEFAULT_ROLE_PERMISSIONS.estimator).toContain("projects.create");
		expect(DEFAULT_ROLE_PERMISSIONS.estimator).toContain("estimates.create");
		expect(DEFAULT_ROLE_PERMISSIONS.estimator).toContain("catalog.create");
		expect(DEFAULT_ROLE_PERMISSIONS.estimator).not.toContain("payments.create");
		expect(DEFAULT_ROLE_PERMISSIONS.estimator).not.toContain("invoices.create");
		expect(DEFAULT_ROLE_PERMISSIONS.estimator).not.toContain("settings.edit");
		expect(DEFAULT_ROLE_PERMISSIONS.estimator).not.toContain("team.invite");
	});

	it("field user can view and create time entries only", () => {
		expect(DEFAULT_ROLE_PERMISSIONS.field_user).toContain("timeEntries.create");
		expect(DEFAULT_ROLE_PERMISSIONS.field_user).toContain("invoices.view");
		expect(DEFAULT_ROLE_PERMISSIONS.field_user).not.toContain("invoices.create");
		expect(DEFAULT_ROLE_PERMISSIONS.field_user).not.toContain("projects.create");
		expect(DEFAULT_ROLE_PERMISSIONS.field_user).not.toContain("settings.edit");
	});

	it("viewer is read-only across all resources", () => {
		expect(DEFAULT_ROLE_PERMISSIONS.viewer).toContain("invoices.view");
		expect(DEFAULT_ROLE_PERMISSIONS.viewer).toContain("projects.view");
		expect(DEFAULT_ROLE_PERMISSIONS.viewer).toContain("reports.view");
		expect(DEFAULT_ROLE_PERMISSIONS.viewer).toContain("templates.edit");
		expect(DEFAULT_ROLE_PERMISSIONS.viewer).not.toContain("invoices.create");
		expect(DEFAULT_ROLE_PERMISSIONS.viewer).not.toContain("invoices.edit");
		expect(DEFAULT_ROLE_PERMISSIONS.viewer).not.toContain("invoices.delete");
		expect(DEFAULT_ROLE_PERMISSIONS.viewer).not.toContain("settings.edit");
		expect(DEFAULT_ROLE_PERMISSIONS.viewer).not.toContain("team.invite");
	});

	it("external customer can view invoices and make payments but not settings", () => {
		expect(DEFAULT_ROLE_PERMISSIONS.external_customer).toContain("invoices.view");
		expect(DEFAULT_ROLE_PERMISSIONS.external_customer).toContain("payments.view");
		expect(DEFAULT_ROLE_PERMISSIONS.external_customer).toContain("payments.create");
		expect(DEFAULT_ROLE_PERMISSIONS.external_customer).not.toContain("invoices.create");
		expect(DEFAULT_ROLE_PERMISSIONS.external_customer).not.toContain("settings.edit");
		expect(DEFAULT_ROLE_PERMISSIONS.external_customer).not.toContain("team.invite");
	});

	it("subcontractor can view invoices and create time entries", () => {
		expect(DEFAULT_ROLE_PERMISSIONS.subcontractor).toContain("invoices.view");
		expect(DEFAULT_ROLE_PERMISSIONS.subcontractor).toContain("timeEntries.create");
		expect(DEFAULT_ROLE_PERMISSIONS.subcontractor).not.toContain("invoices.create");
		expect(DEFAULT_ROLE_PERMISSIONS.subcontractor).not.toContain("invoices.edit");
		expect(DEFAULT_ROLE_PERMISSIONS.subcontractor).not.toContain("settings.edit");
	});

	it("all permission strings are valid", () => {
		for (const roleId of SYSTEM_ROLE_IDS) {
			const perms = DEFAULT_ROLE_PERMISSIONS[roleId];
			const invalid = findInvalidPermissions(perms);
			expect(invalid.length).toBe(0);
		}
	});

	it("role permission counts are strictly ordered by hierarchy", () => {
		const counts = SYSTEM_ROLE_IDS.map((id) => DEFAULT_ROLE_PERMISSIONS[id].length);
		// Owner should have the most
		expect(counts[0]).toBeGreaterThan(counts[1]);
		expect(counts[1]).toBeGreaterThan(counts[2]);
		// All field-level roles should have fewer than admin
		for (let i = 3; i < counts.length; i++) {
			expect(counts[1]).toBeGreaterThan(counts[i]);
		}
	});

	it("getSystemRole returns definitions for all 12 roles", () => {
		for (const role of SYSTEM_ROLES) {
			const found = getSystemRole(role.id);
			expect(found).not.toBeNull();
			expect(found?.name).toBe(role.name);
			expect(found?.isSystem).toBe(true);
		}
	});

	it("isSystemRole recognises all 12 ids and rejects custom roles", () => {
		for (const id of SYSTEM_ROLE_IDS) {
			expect(isSystemRole(id)).toBe(true);
		}
		expect(isSystemRole("custom-role")).toBe(false);
		expect(isSystemRole("owner_override")).toBe(false);
	});

	it("permissionToString and parsePermission round-trip", () => {
		for (const perm of ALL_PERMISSIONS) {
			const parsed = parsePermission(perm);
			expect(parsed).not.toBeNull();
			if (parsed) {
				expect(permissionToString(parsed.resource, parsed.action)).toBe(perm);
			}
		}
	});

	it("INVOICE_ACTION_PERMISSION covers all invoice actions", () => {
		for (const action of ["view", "create", "edit", "send", "approve", "void", "delete"] as const) {
			expect(INVOICE_ACTION_PERMISSION[action]).toBeTruthy();
		}
	});

	it("ORG_SCOPE_ONLY contains expected guardrails", () => {
		expect(ORG_SCOPE_ONLY).toContain("settings.edit");
		expect(ORG_SCOPE_ONLY).toContain("team.invite");
	});

	it("INVOICE_PERMISSIONS is the full invoice set", () => {
		expect(INVOICE_PERMISSIONS.length).toBe(7);
	});

	it("isValidPermission distinguishes known from unknown", () => {
		expect(isValidPermission("invoices.create")).toBe(true);
		expect(isValidPermission("invoices.hack")).toBe(false);
		expect(isValidPermission("foobar")).toBe(false);
	});

	it("no role has duplicate permissions", () => {
		for (const roleId of SYSTEM_ROLE_IDS) {
			const perms = DEFAULT_ROLE_PERMISSIONS[roleId];
			const unique = new Set(perms);
			expect(unique.size).toBe(perms.length);
		}
	});

	it("controller has more permissions than accountant", () => {
		const controllerCount = DEFAULT_ROLE_PERMISSIONS.controller.length;
		const accountantCount = DEFAULT_ROLE_PERMISSIONS.accountant.length;
		expect(controllerCount).toBeGreaterThan(accountantCount);
	});

	it("estimator cannot access payments or team management", () => {
		expect(DEFAULT_ROLE_PERMISSIONS.estimator).not.toContain("payments.view");
		expect(DEFAULT_ROLE_PERMISSIONS.estimator).not.toContain("payments.create");
		expect(DEFAULT_ROLE_PERMISSIONS.estimator).not.toContain("team.invite");
		expect(DEFAULT_ROLE_PERMISSIONS.estimator).not.toContain("team.remove");
	});

	it("viewer cannot create anything", () => {
		const createPerms = ALL_PERMISSIONS.filter((p) => p.endsWith(".create"));
		for (const perm of createPerms) {
			expect(DEFAULT_ROLE_PERMISSIONS.viewer).not.toContain(perm);
		}
	});
});
