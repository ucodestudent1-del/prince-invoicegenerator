import { validateEnv } from "@/lib/errors";

export { validateEnv };

let validated = false;

export function ensureEnv() {
  if (validated) return;
  try {
    validateEnv();
  } catch (err: any) {
    console["error"]("[env] Environment validation failed:", err["message"]);
  } finally {
    validated = true;
  }
}
