import { PrismaClient } from "@prisma/client";

export async function getNextInvoiceNumber(prisma: PrismaClient, orgId: string): Promise<string> {
  const last = await prisma["invoice"]["findFirst"]({
    select: { number: true },
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });
  const lastNum = last ? parseInt(last?.["number"]?.["replace"](/^INV-/, ""), 10) : 0;
  const nextNum = Number.isNaN(lastNum) ? 1 : lastNum + 1;
  return `INV-${String(nextNum)["padStart"](4, "0")}`;
}

export async function getNextEstimateNumber(prisma: PrismaClient, orgId: string): Promise<string> {
  const last = await prisma["estimate"]["findFirst"]({
    select: { number: true },
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });
  const lastNum = last ? parseInt(last?.["number"]?.["replace"](/^EST-/, ""), 10) : 0;
  const nextNum = Number.isNaN(lastNum) ? 1 : lastNum + 1;
  return `EST-${String(nextNum)["padStart"](4, "0")}`;
}

export async function getNextChangeOrderNumber(prisma: PrismaClient, orgId: string): Promise<string> {
  const last = await prisma["changeOrder"]["findFirst"]({
    select: { number: true },
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });
  const lastNum = last ? parseInt(last?.["number"]?.["replace"](/^CO-/, ""), 10) : 0;
  const nextNum = Number.isNaN(lastNum) ? 1 : lastNum + 1;
  return `CO-${String(nextNum)["padStart"](4, "0")}`;
}

