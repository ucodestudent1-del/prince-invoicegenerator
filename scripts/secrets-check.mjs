#!/usr/bin/env node
/**
 * Secret scanner (Plan 1.1).
 *
 * Fails the build when a credential pattern appears in tracked files. Run with
 * no arguments to scan the whole working tree, or `--staged` / `--diff <ref>` to
 * scan only what changed — which is what CI uses on pull requests.
 *
 *   node scripts/secrets-check.mjs                 # every tracked file
 *   node scripts/secrets-check.mjs --staged        # staged changes only
 *   node scripts/secrets-check.mjs --diff origin/main
 *
 * Exit codes: 0 clean, 1 findings, 2 scanner error.
 *
 * Deliberately dependency-free so it runs before `npm ci` in CI.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { extname } from "node:path";

/**
 * Each rule is intentionally narrow. Broad rules train people to ignore this
 * tool, which is worse than having no tool at all.
 */
const RULES = [
  { id: "stripe-live-secret", description: "Stripe live secret key", pattern: /sk_live_[0-9a-zA-Z]{16,}/ },
  { id: "stripe-live-restricted", description: "Stripe live restricted key", pattern: /rk_live_[0-9a-zA-Z]{16,}/ },
  { id: "stripe-webhook-secret", description: "Stripe webhook signing secret", pattern: /whsec_[0-9a-zA-Z]{16,}/ },
  { id: "aws-access-key-id", description: "AWS/R2 access key id", pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { id: "google-oauth-secret", description: "Google OAuth client secret", pattern: /GOCSPX-[0-9A-Za-z_-]{20,}/ },
  { id: "google-api-key", description: "Google API key", pattern: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { id: "openai-key", description: "OpenAI API key", pattern: /\bsk-[A-Za-z0-9]{20,}\b/ },
  { id: "github-token", description: "GitHub token", pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { id: "slack-token", description: "Slack token", pattern: /\bxox[abposr]-[0-9A-Za-z-]{10,}\b/ },
  { id: "private-key-block", description: "PEM private key block", pattern: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { id: "jwt", description: "Hard-coded JWT", pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
  {
    id: "postgres-url-with-password",
    description: "Postgres URL containing a password",
    pattern: /postgres(?:ql)?:\/\/[^\s:@/]+:[^\s:@/]+@/,
  },
  {
    id: "assigned-secret",
    description: "Secret-looking value assigned to a known secret variable",
    // Matches NEXTAUTH_SECRET="…" / R2_SECRET_ACCESS_KEY: '…' with >=16 chars of
    // high-entropy-ish value. Placeholders are filtered by PLACEHOLDERS below.
    pattern:
      /\b(?:NEXTAUTH_SECRET|BACKGROUND_JOB_API_KEY|R2_SECRET_ACCESS_KEY|R2_ACCESS_KEY_ID|UPSTASH_REDIS_REST_TOKEN|SMTP_PASSWORD|GOOGLE_CLIENT_SECRET|SENTRY_AUTH_TOKEN)\s*[:=]\s*["']?([A-Za-z0-9+/_=-]{16,})["']?/,
  },
];

/** Values that look like secrets but are documentation, not credentials. */
const PLACEHOLDERS = [
  /^(?:your|my|the)[-_]/i,
  /^x{4,}$/i,
  /^\.{3,}$/,
  /change[-_]?me/i,
  /replace[-_]?me/i,
  /^example/i,
  /^placeholder/i,
  /^generate/i,
  /^<.*>$/,
  /^\$\{.*\}$/,
  /^(?:test|dummy|fake|sample|redacted)/i,
  /^sk_live_your/i,
  /^sk_test_/i,
];

/** Paths that legitimately document secret shapes. */
const IGNORED_PATHS = [
  /^scripts\/secrets-check\.mjs$/,
  /^\.env\.example$/,
  /^\.env\.railway\.example$/,
  /^package-lock\.json$/,
  /^\.github\/workflows\/secrets-scan\.yml$/,
  /^docs\/runbooks\//,
  /(?:^|\/)node_modules\//,
  /(?:^|\/)\.next\//,
];

const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".zip", ".gz",
  ".woff", ".woff2", ".ttf", ".eot", ".mp4", ".mp3", ".dat", ".wasm",
]);

const MAX_FILE_BYTES = 2 * 1024 * 1024;

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function filesToScan(argv) {
  const stagedIndex = argv.indexOf("--staged");
  const diffIndex = argv.indexOf("--diff");

  let output;
  if (stagedIndex !== -1) {
    output = git(["diff", "--cached", "--name-only", "--diff-filter=ACMR"]);
  } else if (diffIndex !== -1) {
    const ref = argv[diffIndex + 1];
    if (!ref) throw new Error("--diff requires a git ref");
    output = git(["diff", "--name-only", "--diff-filter=ACMR", `${ref}...HEAD`]);
  } else {
    output = git(["ls-files"]);
  }

  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((file) => !IGNORED_PATHS.some((rule) => rule.test(file)))
    .filter((file) => !BINARY_EXTENSIONS.has(extname(file).toLowerCase()));
}

function isPlaceholder(value) {
  if (!value) return false;
  return PLACEHOLDERS.some((rule) => rule.test(value));
}

function scanFile(file) {
  let contents;
  try {
    if (statSync(file).size > MAX_FILE_BYTES) return [];
    contents = readFileSync(file, "utf8");
  } catch {
    // Deleted between listing and reading, or not valid UTF-8.
    return [];
  }

  const findings = [];
  const lines = contents.split("\n");

  lines.forEach((line, index) => {
    // Allow an explicit, reviewable opt-out on a single line.
    if (line.includes("secrets-check:ignore")) return;

    for (const rule of RULES) {
      const match = rule.pattern.exec(line);
      if (!match) continue;
      const captured = match[1] ?? match[0];
      if (isPlaceholder(captured)) continue;
      findings.push({
        file,
        line: index + 1,
        rule: rule.id,
        description: rule.description,
        preview: redact(line.trim()),
      });
    }
  });

  return findings;
}

/** Never print the secret itself — that would leak it into CI logs. */
function redact(line) {
  const clipped = line.length > 120 ? `${line.slice(0, 120)}…` : line;
  return clipped.replace(/[A-Za-z0-9+/_=-]{12,}/g, (token) => `${token.slice(0, 4)}***${token.slice(-2)}`);
}

function main() {
  let files;
  try {
    files = filesToScan(process.argv.slice(2));
  } catch (err) {
    console.error(`[secrets-check] Unable to list files: ${err.message}`);
    process.exit(2);
  }

  const findings = files.flatMap(scanFile);

  if (findings.length === 0) {
    console.log(`[secrets-check] OK — scanned ${files.length} file(s), no secrets found.`);
    return;
  }

  console.error(`[secrets-check] FAILED — ${findings.length} potential secret(s) found:\n`);
  for (const finding of findings) {
    console.error(`  ${finding.file}:${finding.line}  [${finding.rule}] ${finding.description}`);
    console.error(`    ${finding.preview}\n`);
  }
  console.error("Remove the credential, rotate it, and re-run.");
  console.error("If a match is a documented placeholder, append a 'secrets-check:ignore' comment to that line.");
  process.exit(1);
}

main();
