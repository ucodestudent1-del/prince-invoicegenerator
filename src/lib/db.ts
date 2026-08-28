import { Prisma, PrismaClient } from "@prisma/client";
import { logError } from "@/lib/logging";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function buildDatabaseUrl(url: string): string {
  const keepalive =
    "tcp_keepalives_idle=60&tcp_keepalives_interval=10&tcp_keepalives_count=5";
  const separator = url.includes("?") ? "&" : "?";
  const hasPgbouncer = url.includes("pgbouncer=true");
  const hasKeepalive = url.includes("tcp_keepalives_idle=");

  let normalized = url;
  if (!hasPgbouncer) {
    normalized = `${url}${separator}pgbouncer=true`;
  }
  if (!hasKeepalive) {
    normalized = `${normalized}${normalized.includes("?") ? "&" : "?"}${keepalive}`;
  }
  return normalized;
}

export const db =
  globalForPrisma["prisma"] ??
  new PrismaClient({
    log: process["env"]["NODE_ENV"] === "development" ? ["error", "warn"] : ["error"],
    ...(process["env"]["NODE_ENV"] === "production" && process["env"]["DATABASE_URL"]
      ? {
          datasources: {
            db: {
              url: buildDatabaseUrl(process["env"]["DATABASE_URL"]),
            },
          },
        }
      : {}),
  });

globalForPrisma["prisma"] = db;

export async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 500): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isConnectionError =
        err instanceof Prisma["PrismaClientKnownRequestError"] ||
        err instanceof Prisma["PrismaClientInitializationError"] ||
        (err instanceof Error &&
          /ECONNREFUSED|ETIMEDOUT|ECONNRESET|ENOTFOUND|too many connections|SSL error|unexpected eof|connection reset|P2027|P2010|P1012/i["test"](err["message"]));
      if (attempt === retries || !isConnectionError) throw err;
      logError(`DB retry attempt ${attempt}/${retries}`, err);
      await new Promise((resolve) => setTimeout(resolve, delay * attempt));
    }
  }
  throw new Error("Unreachable");
}
