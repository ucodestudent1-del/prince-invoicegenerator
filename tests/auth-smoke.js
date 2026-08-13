#!/usr/bin/env node
/**
 * Smoke test: confirms that /api/auth/providers returns 200 after deployment.
 *
 * Usage:
 *   node tests/auth-smoke.js                     # tests http://localhost:3000
 *   TEST_URL=https://your-app.railway.app node tests/auth-smoke.js
 *
 * Exits with code 0 on success, 1 on failure.
 */

const http = require("http");
const https = require("https");

function getTestUrl() {
  const raw = process.env.TEST_URL || "http://localhost:3000";
  try {
    new URL(raw);
  } catch {
    throw new Error(`TEST_URL is not a valid URL: ${raw}`);
  }
  return raw;
}

function request(baseUrl, pathname) {
  const parsed = new URL(pathname, baseUrl);
  const lib = parsed.protocol === "https:" ? https : http;
  const options = {
    method: "GET",
    hostname: parsed.hostname,
    port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
    path: pathname,
  };
  return new Promise((resolve, reject) => {
    const req = lib.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject);
    req.end();
  });
}

async function main() {
  const baseUrl = getTestUrl();
  let passed = 0;
  let failed = 0;

  function check(name, status, expected) {
    if (status === expected) {
      console.log(`PASS: ${name} returned ${status}`);
      passed++;
    } else {
      console.error(`FAIL: ${name} expected ${expected}, got ${status}`);
      failed++;
    }
  }

  // 1. /api/auth/providers should return 200
  try {
    const res = await request(baseUrl, "/api/auth/providers");
    check("/api/auth/providers", res.status, 200);

    if (res.status === 200) {
      const json = JSON.parse(res.body);
      const providers = Array.isArray(json) ? json : json.providers;
      const count = Array.isArray(json) ? json.length : Object.keys(json).length;
      if (count > 0) {
        console.log(`  -> ${count} provider(s) available`);
      } else {
        console.error("  -> No providers found in response");
        failed++;
      }
    }
  } catch (err) {
    console.error(`FAIL: /api/auth/providers request error: ${err.message}`);
    failed++;
  }

  // 2. /api/auth/signin should return 200 (default NextAuth page renders)
  try {
    const res = await request(baseUrl, "/api/auth/signin");
    check("/api/auth/signin", res.status, 200);
  } catch (err) {
    console.error(`FAIL: /api/auth/signin request error: ${err.message}`);
    failed++;
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
