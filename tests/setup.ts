/**
 * Global test setup.
 *
 * Keeps every test run hermetic: no test may reach a real Stripe account, Redis
 * instance, error-tracking sink or SMTP server just because the developer's
 * shell happens to have those variables exported.
 */

// Credentials that would cause outbound network calls if present.
for (const key of [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "REDIS_REST_URL",
  "REDIS_REST_TOKEN",
  "SENTRY_DSN",
  "ERROR_WEBHOOK_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "SMTP_HOST",
  "SMTP_PASSWORD",
  "RESEND_API_KEY",
]) {
  delete process.env[key];
}

// Deterministic defaults for code that branches on configuration.
process.env["NEXTAUTH_URL"] = "https://app.example.com";
process.env["NEXT_PUBLIC_BASE_URL"] = "https://app.example.com";
process.env["NEXTAUTH_SECRET"] = "test-secret-not-used-for-signing";
process.env["FF_CSRF"] = "enforce";
process.env["FF_CSP"] = "strict";
delete process.env["FF_COEP"];
