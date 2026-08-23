import { NextRequest } from "next/server";

export const BACKGROUND_JOB_API_KEY_HEADER = "x-api-key";

export function isBackgroundJobAuthorized(req: NextRequest): boolean {
  const provided = req["headers"]["get"](BACKGROUND_JOB_API_KEY_HEADER);
  const expected = process["env"]["BACKGROUND_JOB_API_KEY"];

  if (!expected) {
    if (process["env"]["NODE_ENV"] === "production") {
      console["error"]("[auth] BACKGROUND_JOB_API_KEY is not set in production");
      return false;
    }
    return true;
  }

  if (!provided) return false;

  return provided === expected;
}
