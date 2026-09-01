import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { isBackgroundJobAuthorized } from "@/lib/background-job-auth";

const ORIGINAL_ENV = { ...process["env"] };

function requestWithHeader(value?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (value !== undefined) headers["x-api-key"] = value;
  return new NextRequest("https://app.example.com/api/reminders/check", {
    method: "GET",
    headers,
  });
}

afterEach(() => {
  process["env"] = { ...ORIGINAL_ENV };
});

describe("isBackgroundJobAuthorized", () => {
  it("rejects when BACKGROUND_JOB_API_KEY is unset (fail-closed)", () => {
    delete process["env"]["BACKGROUND_JOB_API_KEY"];
    expect(isBackgroundJobAuthorized(requestWithHeader("anything")))["toBe"](false);
  });

  it("rejects when the key is set but the header is missing", () => {
    process["env"]["BACKGROUND_JOB_API_KEY"] = "secret";
    expect(isBackgroundJobAuthorized(requestWithHeader()))["toBe"](false);
  });

  it("rejects when the header value does not match the configured key", () => {
    process["env"]["BACKGROUND_JOB_API_KEY"] = "secret";
    expect(isBackgroundJobAuthorized(requestWithHeader("wrong")))["toBe"](false);
  });

  it("accepts when the header value matches the configured key", () => {
    process["env"]["BACKGROUND_JOB_API_KEY"] = "secret";
    expect(isBackgroundJobAuthorized(requestWithHeader("secret")))["toBe"](true);
  });
});
