import { validateEnv } from "@/lib/errors";

export { validateEnv };

let validated = false;

export function ensureEnv() {
  if (validated) return;
  validateEnv();
  validated = true;
}
