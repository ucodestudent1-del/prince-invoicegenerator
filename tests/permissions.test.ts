import { describe, expect, it } from "vitest";
import {
	ALL_PERMISSIONS,
	DEFAULT_ROLE_PERMISSIONS,
	SYSTEM_ROLE_IDS,
	SYSTEM_ROLES,
	ORG_SCOPE_ONLY,
	parsePermission,
	permissionToString,
	isValidPermission,
	getSystemRole,
	isSystemRole,
	findInvalidPermissions,
	permissionForInvoiceAction,
	INVOICE_ACTION_PERMISSION,
	INVOICE_PERMISSIONS,
} from "@/lib/permissions";

describe("permission vocabulary", () => {
	it("exposes a non-empty set of permissions", () => {
		expect(ALL_PERMISSIONS["length"])["toBeGreaterThan"](0);
	});

	it("every system role has a permission set", () => {
		for (const id of SYSTEM_ROLE_IDS) {
			expect(DEFAULT_ROLE_PERMISSIONS[id]["length"])["toBeGreaterThan"](0);
		}
	});

	it("owner has every permission", () => {
		const ownerPerms = new Set(DEFAULT_ROLE_PERMISSIONS["owner"]);
		for (const perm of ALL_PERMISSIONS) {
			expect(ownerPerms["has"](perm))["toBe"](true);
		}
	});

	it("administrator can void invoices", () => {
		expect(DEFAULT_ROLE_PERMISSIONS["administrator"])["toContain"]("invoices.void");
	});

	it("accountant cannot void or delete invoices", () => {
		expect(DEFAULT_ROLE_PERMISSIONS["accountant"])["not"]["toContain"]("invoices.void");
		expect(DEFAULT_ROLE_PERMISSIONS["accountant"])["not"]["toContain"]("invoices.delete");
	});

	it("accountant cannot manage team or settings", () => {
		expect(DEFAULT_ROLE_PERMISSIONS["accountant"])["not"]["toContain"]("team.invite");
		expect(DEFAULT_ROLE_PERMISSIONS["accountant"])["not"]["toContain"]("team.remove");
		expect(DEFAULT_ROLE_PERMISSIONS["accountant"])["not"]["toContain"]("settings.edit");
	});

	it("project manager cannot approve", () => {
		expect(DEFAULT_ROLE_PERMISSIONS["project_manager"])["toContain"]("invoices.create");
		expect(DEFAULT_ROLE_PERMISSIONS["project_manager"])["toContain"]("invoices.send");
		expect(DEFAULT_ROLE_PERMISSIONS["project_manager"])["not"]["toContain"]("invoices.approve");
		expect(DEFAULT_ROLE_PERMISSIONS["project_manager"])["not"]["toContain"]("invoices.void");
	});

	it("field worker can only view and create time entries", () => {
		expect(DEFAULT_ROLE_PERMISSIONS["field_worker"])["toContain"]("timeEntries.create");
		expect(DEFAULT_ROLE_PERMISSIONS["field_worker"])["toContain"]("invoices.view");
		expect(DEFAULT_ROLE_PERMISSIONS["field_worker"])["not"]["toContain"]("invoices.create");
		expect(DEFAULT_ROLE_PERMISSIONS["field_worker"])["not"]["toContain"]("projects.create");
	});

	it("role hierarchies are strictly ordered by permission breadth", () => {
		const counts = SYSTEM_ROLE_IDS["map"]((id) => DEFAULT_ROLE_PERMISSIONS[id]["length"]);
		expect(counts[0])["toBeGreaterThan"](counts[3]);
		expect(counts[3])["toBeGreaterThan"](counts[4]);
	});
});

describe("system role metadata", () => {
	it("has five built-in roles", () => {
		expect(SYSTEM_ROLES["length"])["toBe"](5);
	});

	it("getSystemRole returns the definition", () => {
		const owner = getSystemRole("owner");
		expect(owner?.["name"])["toBe"]("Owner");
		expect(owner?.["isSystem"])["toBe"](true);
	});

	it("isSystemRole recognises all five ids", () => {
		for (const id of SYSTEM_ROLE_IDS) {
			expect(isSystemRole(id))["toBe"](true);
		}
		expect(isSystemRole("custom-role"))["toBe"](false);
	});
});

describe("permission parsing", () => {
	it("parses valid permissions", () => {
		expect(parsePermission("invoices.create"))["toEqual"]({ resource: "invoices", action: "create" });
		expect(parsePermission("team.invite"))["toEqual"]({ resource: "team", action: "invite" });
	});

	it("returns null for malformed strings", () => {
		expect(parsePermission("invoices"))["toBeNull"]();
		expect(parsePermission("invoices."))["toBeNull"]();
		expect(parsePermission(""))["toBeNull"]();
	});

	it("isValidPermission distinguishes known from unknown", () => {
		expect(isValidPermission("invoices.create"))["toBe"](true);
		expect(isValidPermission("invoices.hack"))["toBe"](false);
		expect(isValidPermission("foobar"))["toBe"](false);
	});

	it("permissionToString round-trips", () => {
		expect(permissionToString("invoices", "send"))["toBe"]("invoices.send");
	});
});

describe("findInvalidPermissions", () => {
	it("returns only unknown permissions", () => {
		const result = findInvalidPermissions(["invoices.view", "invoices.hack", "team.invite"]);
		expect(result)["toEqual"](["invoices.hack"]);
	});
});

describe("invoice action -> permission mapping", () => {
	it("maps every action", () => {
		expect(permissionForInvoiceAction("create"))["toBe"]("invoices.create");
		expect(permissionForInvoiceAction("void"))["toBe"]("invoices.void");
		expect(permissionForInvoiceAction("approve"))["toBe"]("invoices.approve");
	});

	it("INVOICE_ACTION_PERMISSION covers all invoice actions", () => {
		for (const action of ["view", "create", "edit", "send", "approve", "void", "delete"] as const) {
			expect(INVOICE_ACTION_PERMISSION[action])["toBeTruthy"]();
		}
	});

	it("ORG_SCOPE_ONLY contains expected financial guard rails", () => {
		expect(ORG_SCOPE_ONLY)["toContain"]("settings.edit");
		expect(ORG_SCOPE_ONLY)["toContain"]("team.invite");
	});

	it("INVOICE_PERMISSIONS is the full invoice set", () => {
		expect(INVOICE_PERMISSIONS["length"])["toBe"](7);
	});
});
