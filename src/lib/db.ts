import { Prisma, PrismaClient } from "@prisma/client";
import { logError } from "@/lib/logging";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

globalForPrisma.prisma = db;

export async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 500): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isConnectionError =
        err instanceof Prisma.PrismaClientKnownRequestError ||
        err instanceof Prisma.PrismaClientInitializationError ||
        (err instanceof Error &&
          /ECONNREFUSED|ETIMEDOUT|ECONNRESET|ENOTFOUND|too many connections/i.test(err.message));
      if (attempt === retries || !isConnectionError) throw err;
      logError(`DB retry attempt ${attempt}/${retries}`, err);
      await new Promise((resolve) => setTimeout(resolve, delay * attempt));
    }
  }
  throw new Error("Unreachable");
}
