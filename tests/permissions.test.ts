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
    expect(DEFAULT_ROLE_PERMISSIONS["field_user"])["toContain"]("timeEntries.create");
    expect(DEFAULT_ROLE_PERMISSIONS["field_user"])["toContain"]("invoices.view");
    expect(DEFAULT_ROLE_PERMISSIONS["field_user"])["not"]["toContain"]("invoices.create");
    expect(DEFAULT_ROLE_PERMISSIONS["field_user"])["not"]["toContain"]("projects.create");
  });

  it("controller can void invoices but accountant cannot", () => {
    expect(DEFAULT_ROLE_PERMISSIONS["controller"])["toContain"]("invoices.void");
    expect(DEFAULT_ROLE_PERMISSIONS["accountant"])["not"]["toContain"]("invoices.void");
    expect(DEFAULT_ROLE_PERMISSIONS["accountant"])["not"]["toContain"]("invoices.delete");
  });

  it("controller has financial authority but no team/settings", () => {
    expect(DEFAULT_ROLE_PERMISSIONS["controller"])["toContain"]("payments.view");
    expect(DEFAULT_ROLE_PERMISSIONS["controller"])["toContain"]("payments.create");
    expect(DEFAULT_ROLE_PERMISSIONS["controller"])["toContain"]("reports.export");
    expect(DEFAULT_ROLE_PERMISSIONS["controller"])["not"]["toContain"]("team.invite");
    expect(DEFAULT_ROLE_PERMISSIONS["controller"])["not"]["toContain"]("team.remove");
    expect(DEFAULT_ROLE_PERMISSIONS["controller"])["not"]["toContain"]("settings.edit");
  });

  it("accountant cannot manage team or settings", () => {
    expect(DEFAULT_ROLE_PERMISSIONS["accountant"])["not"]["toContain"]("team.invite");
    expect(DEFAULT_ROLE_PERMISSIONS["accountant"])["not"]["toContain"]("team.remove");
    expect(DEFAULT_ROLE_PERMISSIONS["accountant"])["not"]["toContain"]("settings.edit");
  });

  it("project manager cannot approve, void, or delete", () => {
    expect(DEFAULT_ROLE_PERMISSIONS["project_manager"])["toContain"]("invoices.create");
    expect(DEFAULT_ROLE_PERMISSIONS["project_manager"])["toContain"]("invoices.send");
    expect(DEFAULT_ROLE_PERMISSIONS["project_manager"])["not"]["toContain"]("invoices.approve");
    expect(DEFAULT_ROLE_PERMISSIONS["project_manager"])["not"]["toContain"]("invoices.void");
    expect(DEFAULT_ROLE_PERMISSIONS["project_manager"])["not"]["toContain"]("invoices.delete");
    expect(DEFAULT_ROLE_PERMISSIONS["project_manager"])["not"]["toContain"]("reports.export");
    expect(DEFAULT_ROLE_PERMISSIONS["project_manager"])["not"]["toContain"]("settings.edit");
  });

  it("project engineer can view but not create invoices", () => {
    expect(DEFAULT_ROLE_PERMISSIONS["project_engineer"])["toContain"]("invoices.view");
    expect(DEFAULT_ROLE_PERMISSIONS["project_engineer"])["toContain"]("timeEntries.create");
    expect(DEFAULT_ROLE_PERMISSIONS["project_engineer"])["not"]["toContain"]("invoices.create");
    expect(DEFAULT_ROLE_PERMISSIONS["project_engineer"])["not"]["toContain"]("invoices.send");
    expect(DEFAULT_ROLE_PERMISSIONS["project_engineer"])["not"]["toContain"]("invoices.approve");
  });

  it("superintendent has no invoice creation rights", () => {
    expect(DEFAULT_ROLE_PERMISSIONS["superintendent"])["toContain"]("invoices.view");
    expect(DEFAULT_ROLE_PERMISSIONS["superintendent"])["toContain"]("timeEntries.create");
    expect(DEFAULT_ROLE_PERMISSIONS["superintendent"])["not"]["toContain"]("invoices.create");
    expect(DEFAULT_ROLE_PERMISSIONS["superintendent"])["not"]["toContain"]("invoices.edit");
  });

  it("estimator can create projects and estimates but not payments", () => {
    expect(DEFAULT_ROLE_PERMISSIONS["estimator"])["toContain"]("projects.create");
    expect(DEFAULT_ROLE_PERMISSIONS["estimator"])["toContain"]("estimates.create");
    expect(DEFAULT_ROLE_PERMISSIONS["estimator"])["toContain"]("catalog.create");
    expect(DEFAULT_ROLE_PERMISSIONS["estimator"])["not"]["toContain"]("payments.create");
    expect(DEFAULT_ROLE_PERMISSIONS["estimator"])["not"]["toContain"]("invoices.create");
    expect(DEFAULT_ROLE_PERMISSIONS["estimator"])["not"]["toContain"]("settings.edit");
  });

  it("viewer is read-only only", () => {
    expect(DEFAULT_ROLE_PERMISSIONS["viewer"])["toContain"]("invoices.view");
    expect(DEFAULT_ROLE_PERMISSIONS["viewer"])["toContain"]("projects.view");
    expect(DEFAULT_ROLE_PERMISSIONS["viewer"])["toContain"]("reports.view");
    expect(DEFAULT_ROLE_PERMISSIONS["viewer"])["not"]["toContain"]("invoices.create");
    expect(DEFAULT_ROLE_PERMISSIONS["viewer"])["not"]["toContain"]("invoices.edit");
    expect(DEFAULT_ROLE_PERMISSIONS["viewer"])["not"]["toContain"]("invoices.delete");
    expect(DEFAULT_ROLE_PERMISSIONS["viewer"])["not"]["toContain"]("settings.edit");
    expect(DEFAULT_ROLE_PERMISSIONS["viewer"])["not"]["toContain"]("team.invite");
  });

  it("external customer can view invoices and payments but not settings", () => {
    expect(DEFAULT_ROLE_PERMISSIONS["external_customer"])["toContain"]("invoices.view");
    expect(DEFAULT_ROLE_PERMISSIONS["external_customer"])["toContain"]("payments.view");
    expect(DEFAULT_ROLE_PERMISSIONS["external_customer"])["toContain"]("payments.create");
    expect(DEFAULT_ROLE_PERMISSIONS["external_customer"])["not"]["toContain"]("invoices.create");
    expect(DEFAULT_ROLE_PERMISSIONS["external_customer"])["not"]["toContain"]("settings.edit");
    expect(DEFAULT_ROLE_PERMISSIONS["external_customer"])["not"]["toContain"]("team.invite");
  });

  it("subcontractor can view invoices and create time entries", () => {
    expect(DEFAULT_ROLE_PERMISSIONS["subcontractor"])["toContain"]("invoices.view");
    expect(DEFAULT_ROLE_PERMISSIONS["subcontractor"])["toContain"]("timeEntries.create");
    expect(DEFAULT_ROLE_PERMISSIONS["subcontractor"])["not"]["toContain"]("invoices.create");
    expect(DEFAULT_ROLE_PERMISSIONS["subcontractor"])["not"]["toContain"]("invoices.edit");
    expect(DEFAULT_ROLE_PERMISSIONS["subcontractor"])["not"]["toContain"]("settings.edit");
  });

  it("role hierarchies are strictly ordered by permission breadth", () => {
    const counts = SYSTEM_ROLE_IDS.map((id) => DEFAULT_ROLE_PERMISSIONS[id]["length"]);
    // Owner should have the most permissions
    expect(counts[0]).toBeGreaterThan(counts[2]); // owner > controller
    // Field-level roles (PM, engineer, superintendent, field_user, viewer, subcontractor, customer)
    // should have fewer than admin
    for (let i = 4; i < counts.length; i++) {
      expect(counts[1]).toBeGreaterThan(counts[i]); // admin > all field-level roles
    }
  });
});

describe("system role metadata", () => {
  it("has twelve built-in roles", () => {
    expect(SYSTEM_ROLES.length).toBe(12);
  });

  it("getSystemRole returns the owner definition", () => {
    const owner = getSystemRole("owner");
    expect(owner?.name).toBe("Company Owner");
    expect(owner?.isSystem).toBe(true);
  });

  it("getSystemRole returns the subcontractor definition", () => {
    const sub = getSystemRole("subcontractor");
    expect(sub?.name).toBe("Subcontractor");
    expect(sub?.isSystem).toBe(true);
  });

  it("isSystemRole recognises all twelve ids", () => {
    for (const id of SYSTEM_ROLE_IDS) {
      expect(isSystemRole(id)).toBe(true);
    }
    expect(isSystemRole("custom-role")).toBe(false);
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
