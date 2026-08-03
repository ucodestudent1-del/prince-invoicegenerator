const REQUIRED_ENV_VARS = [
  "DATABASE_URL",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
] as const;

export function validateEnv(): void {
  if (typeof window !== "undefined") return;
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(
      `[env] Missing required environment variables: ${missing.join(", ")}`
    );
  }
}

export function logServerError(context: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  console.error(`[${context}] ${message}`, stack ? `\n${stack}` : "");
}