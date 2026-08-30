import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auditLogCreate: vi.fn().mockResolvedValue({ id: "audit_1" }),
  auditLogFindMany: vi.fn(),
}));

// These tests never render navigation, but their import graph reaches
// next-intl -> next/navigation, which does not resolve under vitest. Stub the
// whole chain so module evaluation succeeds.
vi.mock("next-intl/navigation", () => ({
  createNavigation: () => ({
    Link: () => null,
    redirect: vi.fn(),
    usePathname: () => "/",
    useRouter: () => ({}),
    getPathname: (p: unknown) => (typeof p === "string" ? p : "/"),
  }),
}));
vi.mock("@/i18n/navigation", () => ({
  redirect: () => {
    throw new Error("NEXT_REDIRECT");
  },
  Link: () => null,
}));

vi.mock("@/lib/db", () => ({
  db: {
    auditLog: {
      create: mocks.auditLogCreate,
      findMany: mocks.auditLogFindMany,
    },
  },
}));

vi.mock("@/lib/org", () => ({
  isMissingColumnError: (err: unknown) => err instanceof Error && err["message"]["includes"]("column"),
}));

vi.mock("@/lib/request-id", () => ({
  getRequestId: () => "req_test_123",
}));

import { db } from "@/lib/db";
import { recordAudit, listAuditEntries, auditContextFromRequest } from "@/lib/audit";

function dbMock() {
  return db as unknown as {
    auditLog: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("recordAudit", () => {
  it("persists the entry with the correlation id attached", async () => {
    await recordAudit({
      category: "AUTH",
      action: "LOGIN_SUCCESS",
      actorId: "u_1",
      actorEmail: "a@example.com",
    });
    expect(dbMock().auditLog.create).toHaveBeenCalledTimes(1);
    const data = dbMock().auditLog.create.mock.calls[0][0]["data"];
    expect(data).toMatchObject({
      category: "AUTH",
      action: "LOGIN_SUCCESS",
      actorId: "u_1",
      actorEmail: "a@example.com",
      requestId: "req_test_123",
      outcome: "SUCCESS",
    });
  });

  it("includes sensible defaults without overriding explicit values", async () => {
    await recordAudit({
      category: "BILLING",
      action: "PLAN_CHANGED",
      outcome: "FAILURE",
    });
    const data = dbMock().auditLog.create.mock.calls[0][0]["data"];
    expect(data["outcome"]).toBe("FAILURE");
    expect(data["category"]).toBe("BILLING");
  });

  it("drops forbidden keys from metadata before persisting", async () => {
    await recordAudit({
      category: "AUTH",
      action: "LOGIN_FAILED",
      metadata: { reason: "bad-password", password: "hunter2", token: "abc" },
    });
    const metadata = dbMock().auditLog.create.mock.calls[0][0]["data"]["metadata"];
    expect(metadata).toHaveProperty("reason");
    expect(metadata).not.toHaveProperty("password");
    expect(metadata).not.toHaveProperty("token");
  });

  it("clamps oversized free-text fields", async () => {
    await recordAudit({
      category: "AUTH",
      action: "LOGIN_FAILED",
      actorEmail: "a".repeat(500),
      userAgent: "b".repeat(900),
    });
    const data = dbMock().auditLog.create.mock.calls[0][0]["data"];
    expect(data["actorEmail"]["length"]).toBeLessThanOrEqual(320);
    expect(data["userAgent"]["length"]).toBeLessThanOrEqual(512);
  });

  it("warns and drops the entry when the AuditLog table is absent", async () => {
    mocks.auditLogCreate.mockRejectedValueOnce(new Error("relation \"AuditLog\" does not exist (SQLSTATE 42P01)"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Must not throw.
    await expect(
      recordAudit({ category: "DATA", action: "DATA_EXPORTED" })
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("does not throw on an ordinary write failure", async () => {
    mocks.auditLogCreate.mockRejectedValueOnce(new Error("connection reset"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(recordAudit({ category: "DATA", action: "BULK_DELETE" })).resolves.toBeUndefined();
    error.mockRestore();
  });
});

describe("listAuditEntries", () => {
  it("returns entries newest-first and capped", async () => {
    mocks.auditLogFindMany.mockResolvedValueOnce([
      { id: "a", createdAt: new Date() },
    ]);
    const rows = await listAuditEntries({ orgId: "org_1", limit: 10 });
    expect(rows).toHaveLength(1);
    const call = mocks.auditLogFindMany.mock.calls[0][0];
    expect(call).toMatchObject({ where: { orgId: "org_1" }, take: 10, orderBy: { createdAt: "desc" } });
  });
});

describe("auditContextFromRequest", () => {
  it("extracts client IP from the forwarded header", () => {
    const req = new Request("https://app.example.com/x", {
      headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1", "user-agent": "vitest" },
    });
    const context = auditContextFromRequest(req);
    expect(context).toMatchObject({ ip: "203.0.113.7", userAgent: "vitest" });
  });
});
