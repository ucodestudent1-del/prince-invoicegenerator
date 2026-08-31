import { describe, it, expect, vi } from "vitest";

describe("getNextInvoiceNumber", () => {
  it("returns INV-0000001 when no invoice exists", async () => {
    const { getNextInvoiceNumber } = await import("../src/lib/numbering");
    const prisma = {
      invoice: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const result = await getNextInvoiceNumber(prisma as any, "org1");
    expect(result).toBe("INV-0000001");
    expect(prisma.invoice.findFirst).toHaveBeenCalledWith({
      select: { number: true },
      where: { orgId: "org1", number: { startsWith: "INV-" } },
      orderBy: { number: "desc" },
    });
  });

  it("returns INV-0000002 after INV-0000001", async () => {
    const { getNextInvoiceNumber } = await import("../src/lib/numbering");
    const prisma = {
      invoice: {
        findFirst: vi.fn().mockResolvedValue({ number: "INV-0000001" }),
      },
    };
    const result = await getNextInvoiceNumber(prisma as any, "org1");
    expect(result).toBe("INV-0000002");
  });

  it("handles invoices with non-INV prefix gracefully", async () => {
    // If the last number doesn't have the INV- prefix, parseInt returns NaN
    // and the code falls back to 1.
    const { getNextInvoiceNumber } = await import("../src/lib/numbering");
    const prisma = {
      invoice: {
        findFirst: vi.fn().mockResolvedValue({ number: "CUSTOM-123" }),
      },
    };
    const result = await getNextInvoiceNumber(prisma as any, "org1");
    expect(result).toBe("INV-0000001");
  });

  it("pads to 7 digits with leading zeros", async () => {
    const { getNextInvoiceNumber } = await import("../src/lib/numbering");
    const prisma = {
      invoice: {
        findFirst: vi.fn().mockResolvedValue({ number: "INV-0000099" }),
      },
    };
    const result = await getNextInvoiceNumber(prisma as any, "org1");
    expect(result).toBe("INV-0000100");
  });
});

describe("getNextEstimateNumber", () => {
  it("returns EST-0000001 when no estimate exists", async () => {
    const { getNextEstimateNumber } = await import("../src/lib/numbering");
    const prisma = {
      estimate: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const result = await getNextEstimateNumber(prisma as any, "org1");
    expect(result).toBe("EST-0000001");
  });

  it("returns EST-0000003 after EST-0000002", async () => {
    const { getNextEstimateNumber } = await import("../src/lib/numbering");
    const prisma = {
      estimate: {
        findFirst: vi.fn().mockResolvedValue({ number: "EST-0000002" }),
      },
    };
    const result = await getNextEstimateNumber(prisma as any, "org1");
    expect(result).toBe("EST-0000003");
  });
});

describe("getNextChangeOrderNumber", () => {
  it("returns CO-0000001 when no change order exists", async () => {
    const { getNextChangeOrderNumber } = await import("../src/lib/numbering");
    const prisma = {
      changeOrder: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const result = await getNextChangeOrderNumber(prisma as any, "org1");
    expect(result).toBe("CO-0000001");
  });

  it("returns CO-0000005 after CO-0000004", async () => {
    const { getNextChangeOrderNumber } = await import("../src/lib/numbering");
    const prisma = {
      changeOrder: {
        findFirst: vi.fn().mockResolvedValue({ number: "CO-0000004" }),
      },
    };
    const result = await getNextChangeOrderNumber(prisma as any, "org1");
    expect(result).toBe("CO-0000005");
  });
});

describe("numbering overflow", () => {
  it("throws when next number exceeds MAX_PAD digits", async () => {
    const { getNextInvoiceNumber } = await import("../src/lib/numbering");
    const prisma = {
      invoice: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ number: "INV-9999999" }),
      },
    };
    await expect(getNextInvoiceNumber(prisma as any, "org1")).rejects.toThrow(
      /Numbering limit reached/
    );
  });
});
