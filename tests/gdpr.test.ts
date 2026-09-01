import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recordAudit: vi.fn().mockResolvedValue(undefined),
  revalidate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/audit", () => ({
  recordAudit: mocks.recordAudit,
  auditContextFromRequest: () => ({}),
}));
vi.mock("@/lib/revalidate", () => ({
  revalidateWithLocale: mocks.revalidate,
}));
vi.mock("@/lib/logging", () => ({
  logWarn: vi.fn(),
  logError: vi.fn(),
  logInfo: vi.fn(),
  logDebug: vi.fn(),
  captureException: vi.fn(),
}));
vi.mock("@/lib/org", () => ({
  isMissingColumnError: () => false,
}));
vi.mock("@/lib/action-errors", () => ({
  actionError: (msg: string) => {
    throw new Error(msg);
  },
  withActionError: async <T>(_label: string, fn: () => Promise<T>): Promise<T> => fn(),
}));
// next-intl -> next/navigation resolution chain: stub to avoid import errors.
vi.mock("next-intl/navigation", () => ({
  createNavigation: () => ({
    Link: () => null,
    redirect: vi.fn(),
    usePathname: () => "/",
    useRouter: () => ({}),
    getPathname: (p: unknown) => (typeof p === "string" ? p : "/"),
  }),
}));
vi.mock("@/i18n/navigation", () => ({ redirect: vi.fn(), Link: () => null }));

import {
  exportUserData,
  anonymizeUser,
  exportCustomerData,
  anonymizeCustomer,
  deleteCustomerData,
  Db,
  Actor,
  GDPRDeps,
} from "@/lib/actions/gdpr-core";
import { db as srcDb } from "@/lib/db";

vi.mock("@/lib/db", () => {
  const db: Record<string, any> = {
    user: {
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({ id: "u_1" }),
    },
    session: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }), count: vi.fn().mockResolvedValue(1) },
    account: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }), findMany: vi.fn().mockResolvedValue([]) },
    onboardingState: { findFirst: vi.fn().mockResolvedValue(null), deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    customer: {
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({ id: "c_1" }),
      delete: vi.fn().mockResolvedValue({ id: "c_1" }),
    },
    customerAddress: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    invoice: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    estimate: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    invoiceItem: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    estimateItem: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    payment: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    recurringInvoiceConfig: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    changeOrder: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    project: { findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    portalSession: { findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    timeEntry: { findMany: vi.fn().mockResolvedValue([]) },
    auditLog: { findMany: vi.fn().mockResolvedValue([]) },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(db)),
  };
  return { db };
});

const mockDb = srcDb as unknown as Db;

const owner: Actor = {
  userId: "owner_1",
  orgId: "org_1",
  email: "owner@example.com",
  role: "OWNER",
};

function makeDeps(): GDPRDeps {
  return {
    db: mockDb,
    recordAudit: mocks.recordAudit,
    revalidateWithLocale: mocks.revalidate,
    isMissingColumnError: () => false,
  };
}

afterEach(() => vi.clearAllMocks());

describe("GDPR — users", () => {
  it("exports a member's own data for Article 15", async () => {
    const deps = makeDeps();
    deps["db"]["user"]["findFirst"]["mockResolvedValueOnce"]({
      id: "u_1",
      name: "Jane",
      email: "jane@example.com",
      role: "MEMBER",
      organizationId: "org_1",
      emailVerified: null,
      image: null,
      locale: "en",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const bundle = await exportUserData(deps, owner, "u_1");
    expect(bundle["subjectType"])["toBe"]("User");
    expect(bundle["data"]["profile"]["email"])["toBe"]("jane@example.com");
  });

  it("rejects exporting a user outside the caller's organization", async () => {
    const deps = makeDeps();
    deps["db"]["user"]["findFirst"]["mockResolvedValueOnce"](null);
    await expect(exportUserData(deps, owner, "u_other"))["rejects"]["toThrow"](
      "User not found in your organization."
    );
  });

  it("anonymizes a member, destroying credentials and revoking sessions", async () => {
    const deps = makeDeps();
    deps["db"]["user"]["findFirst"]["mockResolvedValueOnce"]({ id: "u_1", email: "jane@example.com", role: "MEMBER" });
    await anonymizeUser(deps, owner, "u_1");
    const updateCall = deps["db"]["user"]["update"]["mock"]["calls"][0][0];
    expect(updateCall["data"]["password"])["toBeNull"]();
    expect(updateCall["data"]["email"])["toMatch"](/^anonymized\+/);
    expect(deps["db"]["session"]["deleteMany"])["toHaveBeenCalledWith"]({ where: { userId: "u_1" } });
  });

  it("refuses to anonymize the caller themselves", async () => {
    const deps = makeDeps();
    await expect(anonymizeUser(deps, owner, "owner_1"))["rejects"]["toThrow"]("your own account");
  });

  it("refuses to anonymize an organization owner", async () => {
    const deps = makeDeps();
    deps["db"]["user"]["findFirst"]["mockResolvedValueOnce"]({ id: "u_1", email: "x@y.z", role: "OWNER" });
    await expect(anonymizeUser(deps, owner, "u_1"))["rejects"]["toThrow"]("owner");
  });
});

describe("GDPR — customers", () => {
  const customer = {
    id: "c_1",
    name: "Acme Co",
    email: "billing@acme.com",
    portalPin: "1234",
    taxId: "US-99",
    orgId: "org_1",
  };

  it("exports customer data without leaking the portal PIN", async () => {
    const deps = makeDeps();
    deps["db"]["customer"]["findFirst"]["mockResolvedValueOnce"]({ ...customer });
    const bundle = await exportCustomerData(deps, owner, "c_1");
    expect(bundle["subjectType"])["toBe"]("Customer");
    expect(bundle["data"]["customer"]["email"])["toBe"]("billing@acme.com");
    expect(bundle["data"]["customer"]["portalPin"])["toBeUndefined"]();
  });

  it("includes payment rows in the Article 15 export (C3)", async () => {
    const deps = makeDeps();
    deps["db"]["customer"]["findFirst"]["mockResolvedValueOnce"]({ ...customer });
    deps["db"]["payment"]["findMany"]["mockResolvedValueOnce"]([
      { id: "pay_1", amount: 100, method: "BANK_TRANSFER", reference: "TX-1", createdAt: new Date(), invoice: { id: "inv_1", number: "INV-1" } },
      { id: "pay_2", amount: 50, method: "CASH", reference: null, createdAt: new Date(), invoice: { id: "inv_2", number: "INV-2" } },
    ]);
    const bundle = await exportCustomerData(deps, owner, "c_1");
    expect(bundle["data"]["payments"])["toHaveLength"](2);
    expect(bundle["data"]["payments"][0]["id"])["toBe"]("pay_1");
    expect(bundle["data"]["payments"][0]["amount"])["toBe"](100);
  });

  it("treats a missing portalSession table as drift, not an error (C2)", async () => {
    const deps = makeDeps();
    deps["db"]["customer"]["findFirst"]["mockResolvedValueOnce"]({ ...customer });
    deps["db"]["portalSession"]["findMany"]["mockImplementationOnce"](() => {
      throw new Error("relation portalSession does not exist in the current database");
    });
    // Without isDriftError the call would re-throw. With it, the export
    // returns an empty portalSessions array and succeeds.
    const bundle = await exportCustomerData(deps, owner, "c_1");
    expect(bundle["data"]["portalSessions"])["toEqual"]([]);
  });

  it("anonymizes a customer, nulling personal identifiers", async () => {
    const deps = makeDeps();
    deps["db"]["customer"]["findFirst"]["mockResolvedValueOnce"]({ id: "c_1", orgId: "org_1" });
    await anonymizeCustomer(deps, owner, "c_1");
    const updateCall = deps["db"]["customer"]["update"]["mock"]["calls"][0][0];
    expect(updateCall["data"]["name"])["toMatch"](/Anonymized customer/);
    expect(updateCall["data"]["email"])["toBeNull"]();
    expect(updateCall["data"]["taxId"])["toBeNull"]();
    expect(updateCall["data"]["portalPin"])["toBeNull"]();
    expect(updateCall["data"]["portalAccess"])["toBe"](false);
  });

  it("hard-deletes a customer and its documents", async () => {
    const deps = makeDeps();
    deps["db"]["customer"]["findFirst"]["mockResolvedValueOnce"]({ id: "c_1", orgId: "org_1" });
    deps["db"]["invoice"]["findMany"]["mockResolvedValueOnce"]([]);
    deps["db"]["estimate"]["findMany"]["mockResolvedValueOnce"]([]);
    const result = await deleteCustomerData(deps, owner, "c_1");
    expect(result["count"])["toBe"](1);
    expect(deps["db"]["customer"]["delete"])["toHaveBeenCalled"]();
  });

  it("rejects a customer outside the caller's organization", async () => {
    const deps = makeDeps();
    deps["db"]["customer"]["findFirst"]["mockResolvedValueOnce"](null);
    await expect(exportCustomerData(deps, owner, "c_other"))["rejects"]["toThrow"](
      "Customer not found in your organization."
    );
  });
});
