import { PrismaClient } from "@prisma/client";

export async function getNextInvoiceNumber(prisma: PrismaClient, orgId: string): Promise<string> {
  const last = await prisma["invoice"]["findFirst"]({
    select: { number: true },
    where: { orgId },
    orderBy: { number: "desc" },
  });
  const lastNum = last ? parseInt(last["number"]["replace"]("INV-", ""), 10) : 0;
  return `INV-${String(lastNum + 1)["padStart"](4, "0")}`;
}

export async function getNextEstimateNumber(prisma: PrismaClient, orgId: string): Promise<string> {
  const last = await prisma["estimate"]["findFirst"]({
    select: { number: true },
    where: { orgId },
    orderBy: { number: "desc" },
  });
  const lastNum = last ? parseInt(last["number"]["replace"]("EST-", ""), 10) : 0;
  return `EST-${String(lastNum + 1)["padStart"](4, "0")}`;
}

export async function getNextChangeOrderNumber(prisma: PrismaClient, orgId: string): Promise<string> {
  const last = await prisma["changeOrder"]["findFirst"]({
    select: { number: true },
    where: { orgId },
    orderBy: { number: "desc" },
  });
  const lastNum = last ? parseInt(last["number"]["replace"]("CO-", ""), 10) : 0;
  return `CO-${String(lastNum + 1)["padStart"](4, "0")}`;
}

