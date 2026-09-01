import { PrismaClient } from "@prisma/client";

const MAX_PAD = 7;

export async function getNextInvoiceNumber(
  prisma: PrismaClient,
  orgId: string
): Promise<string> {
  const last = await prisma.invoice.findFirst({
    select: { number: true },
    where: { orgId, number: { startsWith: "INV-" } },
    orderBy: { number: "desc" },
  });
  return nextFromLast("INV-", last?.number, MAX_PAD);
}

export async function getNextEstimateNumber(
  prisma: PrismaClient,
  orgId: string
): Promise<string> {
  const last = await prisma.estimate.findFirst({
    select: { number: true },
    where: { orgId, number: { startsWith: "EST-" } },
    orderBy: { number: "desc" },
  });
  return nextFromLast("EST-", last?.number, MAX_PAD);
}

export async function getNextChangeOrderNumber(
  prisma: PrismaClient,
  orgId: string
): Promise<string> {
  const last = await prisma.changeOrder.findFirst({
    select: { number: true },
    where: { orgId, number: { startsWith: "CO-" } },
    orderBy: { number: "desc" },
  });
  return nextFromLast("CO-", last?.number, MAX_PAD);
}

function nextFromLast(
  prefix: string,
  lastNumber: string | undefined,
  pad: number
): string {
  const lastNum =
    lastNumber && lastNumber.startsWith(prefix)
      ? parseInt(lastNumber.slice(prefix.length), 10)
      : 0;
  const nextNum = Number.isFinite(lastNum) ? lastNum + 1 : 1;
  if (nextNum >= 10 ** pad) {
    throw new Error(
      `Numbering limit reached for ${prefix} (max ${10 ** pad - 1}). Contact support to extend the sequence.`
    );
  }
  return `${prefix}${String(nextNum).padStart(pad, "0")}`;
}

