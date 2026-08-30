/**
 * Structured logging and error reporting (Plan 1.4 / 2.1).
 *
 * - Emits single-line JSON in production so log aggregators can index fields,
 *   and human-readable lines in development.
 * - Automatically attaches the `x-request-id` correlation ID when the call
 *   happens inside a request scope.
 * - Forwards errors to an external sink when one is configured. Both sinks are
 *   optional: with no environment variables set the sink is a no-op and
 *   behaviour is identical to plain console logging.
 *
 * Supported sinks (env-gated, no SDK dependency):
 * - `SENTRY_DSN`        — posts a minimal Sentry envelope over plain `fetch`.
 * - `ERROR_WEBHOOK_URL` — posts the structured JSON event to any HTTP endpoint.
 */

import { getRequestId } from "@/lib/request-id";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogMeta = Record<string, unknown>;

/** Keys whose values are replaced with `[redacted]` before leaving the process. */
const REDACTED_KEYS = [
  "password",
  "token",
  "secret",
  "authorization",
  "cookie",
  "apikey",
  "api_key",
  "accesskey",
  "portalpin",
  "pin",
  "clientsecret",
];

const MAX_STRING_LENGTH = 2000;

function isProduction(): boolean {
  return process["env"]["NODE_ENV"] === "production";
}

function environmentName(): string {
  return (
    process["env"]["SENTRY_ENVIRONMENT"] ||
    process["env"]["RAILWAY_ENVIRONMENT_NAME"] ||
    process["env"]["NODE_ENV"] ||
    "development"
  );
}

function releaseName(): string | undefined {
  return (
    process["env"]["APP_RELEASE"] ||
    process["env"]["RAILWAY_GIT_COMMIT_SHA"] ||
    process["env"]["VERCEL_GIT_COMMIT_SHA"] ||
    undefined
  );
}

function shouldRedact(key: string): boolean {
  const normalized = key["toLowerCase"]()["replace"](/[-_\s]/g, "");
  return REDACTED_KEYS["some"]((candidate) => normalized["includes"](candidate["replace"](/_/g, "")));
}

/** Recursively strip secrets and clamp oversized values out of log metadata. */
function sanitize(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth > 4) return "[truncated]";

  if (typeof value === "string") {
    return value["length"] > MAX_STRING_LENGTH ? `${value["slice"](0, MAX_STRING_LENGTH)}…` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value["toISOString"]();
  if (value instanceof Error) return { name: value["name"], message: value["message"] };

  if (Array["isArray"](value)) {
    return value["slice"](0, 50)["map"]((entry) => sanitize(entry, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object["entries"](value as Record<string, unknown>)) {
      out[key] = shouldRedact(key) ? "[redacted]" : sanitize(entry, depth + 1);
    }
    return out;
  }
  return String(value);
}

function describeError(err: unknown): { name: string; message: string; stack?: string; code?: string } {
  if (err instanceof Error) {
    const code = (err as { code?: unknown })["code"];
    return {
      name: err["name"] || "Error",
      message: err["message"] || String(err),
      stack: err["stack"],
      code: typeof code === "string" ? code : undefined,
    };
  }
  return { name: "NonError", message: String(err) };
}

function emit(level: LogLevel, context: string, message: string, meta?: LogMeta) {
  const requestId = getRequestId();
  const payload = {
    level,
    time: new Date()["toISOString"](),
    context,
    message,
    ...(requestId ? { requestId } : {}),
    ...(meta ? (sanitize(meta) as LogMeta) : {}),
  };

  const sink =
    level === "error"
      ? console["error"]
      : level === "warn"
        ? console["warn"]
        : level === "debug"
          ? console["debug"]
          : console["info"];

  if (isProduction()) {
    try {
      sink(JSON["stringify"](payload));
      return;
    } catch {
      // Circular metadata — fall through to the readable form.
    }
  }

  const suffix = meta && Object["keys"](meta)["length"] > 0 ? ` ${safeInspect(sanitize(meta))}` : "";
  const idPrefix = requestId ? `[${requestId}] ` : "";
  sink(`${idPrefix}[${context}] ${message}${suffix}`);
}

function safeInspect(value: unknown): string {
  try {
    return JSON["stringify"](value);
  } catch {
    return "[unserializable]";
  }
}

/**
 * Log an error and forward it to the configured error-tracking sink.
 * Signature is backwards compatible with the previous `logError(context, err)`.
 */
export function logError(context: string, err: unknown, meta?: LogMeta) {
  const details = describeError(err);
  emit("error", context, details["message"], {
    ...meta,
    errorName: details["name"],
    ...(details["code"] ? { errorCode: details["code"] } : {}),
    ...(details["stack"] && !isProduction() ? { stack: details["stack"] } : {}),
  });
  if (isProduction() && details["stack"]) {
    // Stacks are noisy inline but essential in aggregated logs.
    emit("debug", context, "stack", { stack: details["stack"] });
  }
  void captureException(context, details, meta);
}

export function logWarn(context: string, message: string, meta?: LogMeta) {
  emit("warn", context, message, meta);
}

export function logInfo(context: string, message: string, meta?: LogMeta) {
  emit("info", context, message, meta);
}

export function logDebug(context: string, message: string, meta?: LogMeta) {
  if (isProduction() && process["env"]["LOG_LEVEL"] !== "debug") return;
  emit("debug", context, message, meta);
}

// ---------------------------------------------------------------------------
// Error tracking sink
// ---------------------------------------------------------------------------

let sinkDisabled = false;

/**
 * Whether an external error sink is configured. Exposed for the health check.
 */
export function errorTrackingConfigured(): boolean {
  return Boolean(process["env"]["SENTRY_DSN"] || process["env"]["ERROR_WEBHOOK_URL"]);
}

async function captureException(
  context: string,
  details: { name: string; message: string; stack?: string; code?: string },
  meta?: LogMeta
): Promise<void> {
  if (sinkDisabled || !errorTrackingConfigured()) return;
  if (typeof fetch !== "function") return;

  const event = {
    event_id: randomHex(32),
    timestamp: Date["now"]() / 1000,
    platform: "node",
    level: "error",
    logger: context,
    environment: environmentName(),
    ...(releaseName() ? { release: releaseName() } : {}),
    exception: {
      values: [
        {
          type: details["name"],
          value: details["message"],
          ...(details["stack"] ? { stacktrace: { frames: parseStack(details["stack"]) } } : {}),
        },
      ],
    },
    tags: {
      context,
      ...(getRequestId() ? { request_id: getRequestId() as string } : {}),
      ...(details["code"] ? { error_code: details["code"] } : {}),
    },
    extra: meta ? (sanitize(meta) as LogMeta) : undefined,
  };

  try {
    const dsn = process["env"]["SENTRY_DSN"];
    if (dsn) {
      await sendSentryEnvelope(dsn, event);
      return;
    }
    const webhook = process["env"]["ERROR_WEBHOOK_URL"];
    if (webhook) {
      await fetch(webhook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON["stringify"](event),
        // Never let reporting hold a request open.
        signal: timeoutSignal(3000),
      });
    }
  } catch {
    // Reporting must never surface as an application error. If the sink is
    // misconfigured we stop trying so we don't log-amplify on every request.
    sinkDisabled = true;
  }
}

/**
 * Post a Sentry envelope using the documented store endpoint. This avoids a
 * hard dependency on `@sentry/nextjs` while still producing real Sentry issues.
 */
async function sendSentryEnvelope(dsn: string, event: Record<string, unknown>): Promise<void> {
  const parsed = parseDsn(dsn);
  if (!parsed) {
    sinkDisabled = true;
    return;
  }
  const url = `${parsed["protocol"]}//${parsed["host"]}${parsed["path"]}/api/${parsed["projectId"]}/envelope/?sentry_key=${parsed["publicKey"]}&sentry_version=7`;
  const header = JSON["stringify"]({ event_id: event["event_id"], sent_at: new Date()["toISOString"]() });
  const itemHeader = JSON["stringify"]({ type: "event" });
  const body = `${header}\n${itemHeader}\n${JSON["stringify"](event)}\n`;

  await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-sentry-envelope" },
    body,
    signal: timeoutSignal(3000),
  });
}

function parseDsn(dsn: string): {
  protocol: string;
  host: string;
  path: string;
  projectId: string;
  publicKey: string;
} | null {
  try {
    const url = new URL(dsn);
    const segments = url["pathname"]["split"]("/")["filter"](Boolean);
    const projectId = segments["pop"]();
    if (!projectId || !url["username"]) return null;
    return {
      protocol: url["protocol"],
      host: url["host"],
      path: segments["length"] ? `/${segments["join"]("/")}` : "",
      projectId,
      publicKey: url["username"],
    };
  } catch {
    return null;
  }
}

function parseStack(stack: string): { filename: string; function: string; lineno?: number }[] {
  return stack
    ["split"]("\n")
    ["slice"](1, 30)
    ["map"]((line) => {
      const match = /at\s+(.*?)\s+\((.*?):(\d+):(\d+)\)/["exec"](line["trim"]());
      if (match) {
        return { filename: match[2], function: match[1], lineno: Number(match[3]) };
      }
      return { filename: line["trim"](), function: "<unknown>" };
    })
    ["reverse"]();
}

function randomHex(length: number): string {
  const bytes = new Uint8Array(length / 2);
  try {
    globalThis["crypto"]["getRandomValues"](bytes);
  } catch {
    for (let i = 0; i < bytes["length"]; i++) bytes[i] = Math["floor"](Math["random"]() * 256);
  }
  return Array["from"](bytes)
    ["map"]((b) => b["toString"](16)["padStart"](2, "0"))
    ["join"]("");
}

function timeoutSignal(ms: number): AbortSignal | undefined {
  try {
    return AbortSignal["timeout"](ms);
  } catch {
    return undefined;
  }
}
