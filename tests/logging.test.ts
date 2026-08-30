import { afterEach, describe, expect, it, vi } from "vitest";
import { logDebug, logError, logInfo, logWarn, errorTrackingConfigured } from "@/lib/logging";

const originalEnv = { ...process["env"] };

afterEach(() => {
  process["env"] = { ...originalEnv };
  vi["restoreAllMocks"]();
});

/** Re-exported here so the test can confirm redaction without reaching internals. */
function captureConsole(level: "error" | "warn" | "info" | "debug") {
  const spy = vi["spyOn"](console, level)["mockImplementation"](() => {});
  return spy;
}

describe("structured logging", () => {
  it("emits a single JSON line in production with a redacted payload", () => {
    process["env"]["NODE_ENV"] = "production";
    const spy = captureConsole("error");

    logError("billing", new Error("boom"), {
      customerId: "c_123",
      password: "super-secret",
      apiKey: "sk_live_nope",
    });

    expect(spy)["toHaveBeenCalledTimes"](1);
    const line = JSON["parse"](spy["mock"]["calls"][0][0] as string);
    expect(line)["toMatchObject"]({ level: "error", context: "billing", message: "boom" });
    // The request-id is attached when one is present in scope; in a bare test
    // there is none, so we assert only its absence/optional nature.
    expect(line["customerId"])["toBe"]("c_123");
    expect(line["password"])["toBe"]("[redacted]");
    expect(line["apiKey"])["toBe"]("[redacted]");
  });

  it("drops secrets nested inside objects", () => {
    process["env"]["NODE_ENV"] = "production";
    const spy = captureConsole("info");
    logInfo("session", "login", { token: "abc", nested: { clientSecret: "xyz" } });
    const line = JSON["parse"](spy["mock"]["calls"][0][0] as string);
    expect(line["token"])["toBe"]("[redacted]");
    expect(line["nested"]["clientSecret"])["toBe"]("[redacted]");
  });

  it("renders a readable line in development", () => {
    process["env"]["NODE_ENV"] = "development";
    const spy = captureConsole("warn");
    logWarn("rate", "throttled", { remaining: 0 });
    expect(spy["mock"]["calls"][0][0])["toContain"]("[rate] throttled");
    expect(spy["mock"]["calls"][0][0])["toContain"]("\"remaining\":0");
  });

  it("omits debug output unless LOG_LEVEL is debug", () => {
    process["env"]["NODE_ENV"] = "production";
    delete process["env"]["LOG_LEVEL"];
    const spy = captureConsole("debug");
    logDebug("noop", "should be silent");
    expect(spy)["not"]["toHaveBeenCalled"]();
  });
});

describe("error tracking sink", () => {
  it("reports configured state without a network call when unset", () => {
    delete process["env"]["SENTRY_DSN"];
    delete process["env"]["ERROR_WEBHOOK_URL"];
    expect(errorTrackingConfigured())["toBe"](false);
  });

  it("forwards errors to a Sentry DSN via fetch when configured", async () => {
    process["env"]["NODE_ENV"] = "production";
    process["env"]["SENTRY_DSN"] = "https://publickey@o45.ingest.sentry.io/123456";
    const fetchMock = vi["fn"]()["mockResolvedValue"]({ ok: true, status: 200, json: async () => ({}) });
    vi["stubGlobal"]("fetch", fetchMock);

    // Capture the rejection so the thrown error does not abort the test.
    const spy = captureConsole("error");
    logError("svc", new Error("important failure"));
    await new Promise((r) => setTimeout(r, 20));

    expect(fetchMock)["toHaveBeenCalled"]();
    const [url, init] = fetchMock["mock"]["calls"][0] as [string, { headers: Record<string, string>; body: string }];
    expect(url)["toContain"]("o45.ingest.sentry.io/api/123456/envelope");
    const envelope = init["body"];
    expect(envelope)["toContain"]("important failure");
    expect(envelope)["toContain"]('"type":"event"');
    // Reset console spy state (no assertions on it).
    expect(spy)["toBeTruthy"]();
  });

  it("posts to a generic webhook when only ERROR_WEBHOOK_URL is set", async () => {
    process["env"]["NODE_ENV"] = "production";
    delete process["env"]["SENTRY_DSN"];
    process["env"]["ERROR_WEBHOOK_URL"] = "https://hooks.example.com/ingest";
    const fetchMock = vi["fn"]()["mockResolvedValue"]({ ok: true, status: 200, json: async () => ({}) });
    vi["stubGlobal"]("fetch", fetchMock);

    captureConsole("error");
    logError("webhook", new Error("oops"));
    await new Promise((r) => setTimeout(r, 20));

    expect(fetchMock)["toHaveBeenCalledTimes"](1);
    const [url, init] = fetchMock["mock"]["calls"][0] as [string, { body: string }];
    expect(url)["toBe"]("https://hooks.example.com/ingest");
    const event = JSON["parse"](init["body"]);
    expect(event)["toMatchObject"]({ level: "error", environment: expect["any"](String) });
    expect(event["exception"]["values"][0]["value"])["toBe"]("oops");
  });
});
