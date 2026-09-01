import { NextRequest } from "next/server";

export const BACKGROUND_JOB_API_KEY_HEADER = "x-api-key";

/**
 * Validate the `x-api-key` header on a background-job request.
 *
 * Fails closed: if `BACKGROUND_JOB_API_KEY` is not configured the request is
 * rejected, even in development. Background jobs run as the operationally most
 * sensitive endpoints (reminders, late fees, recurring invoice generation);
 * the previous dev escape hatch turned a missing env var into an open door
 * the moment the application was deployed. Set the key in `.env.local` if
 * you want to exercise these routes locally.
 */
export function isBackgroundJobAuthorized(req: NextRequest): boolean {
  const provided = req["headers"]["get"](BACKGROUND_JOB_API_KEY_HEADER);
  const expected = process["env"]["BACKGROUND_JOB_API_KEY"];

  if (!expected) {
    // One log per process is enough — `console.warn` would otherwise flood the
    // log on every probe.
    warnOnceMissingKey();
    return false;
  }

  if (!provided) return false;

  // Constant-time compare to keep the comparison side-channel-free. The keys
  // are static and high-entropy, but the check is cheap.
  return constantTimeEquals(provided, expected);
}

let warned = false;
function warnOnceMissingKey() {
  if (warned) return;
  warned = true;
  console["warn"]("BACKGROUND_JOB_API_KEY not set; rejecting automation request");
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a["length"] !== b["length"]) return false;
  let diff = 0;
  for (let i = 0; i < a["length"]; i++) {
    diff |= a["charCodeAt"](i) ^ b["charCodeAt"](i);
  }
  return diff === 0;
}
