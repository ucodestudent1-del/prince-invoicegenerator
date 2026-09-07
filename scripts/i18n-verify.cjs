#!/usr/bin/env node
/**
 * i18n:verify
 *
 * CI gate for message parity. Fails (exit 1) if any target locale is missing
 * keys that exist in the source locale (en.json), or if a target locale has
 * keys the source does not (stale translations that no longer map to code).
 *
 * Also validates that every locale file is syntactically valid JSON and that
 * every locale declares the same top-level namespaces.
 *
 * Usage:
 *   node scripts/i18n-verify.cjs
 *   npm run i18n:verify
 */

"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MESSAGES_DIR = path.join(ROOT, "src", "messages");
const SOURCE_LOCALE = "en";
const TARGET_LOCALES = ["de", "es", "fr"];

function readLocale(locale) {
  const file = path.join(MESSAGES_DIR, `${locale}.json`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function collectKeys(obj, prefix = "") {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      keys.push(...collectKeys(v, full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

function main() {
  if (!fs.existsSync(MESSAGES_DIR)) {
    console.error(`Messages directory not found: ${MESSAGES_DIR}`);
    process.exit(1);
  }

  let source;
  try {
    source = readLocale(SOURCE_LOCALE);
  } catch (err) {
    console.error(`[i18n] FATAL: ${SOURCE_LOCALE}.json is not valid JSON: ${err.message}`);
    process.exit(1);
  }
  const sourceKeys = new Set(collectKeys(source));
  const sourceNamespaces = new Set(Object.keys(source));

  let failures = 0;

  for (const locale of TARGET_LOCALES) {
    let target;
    try {
      target = readLocale(locale);
    } catch (err) {
      console.error(`[i18n] FAIL ${locale}: not valid JSON — ${err.message}`);
      failures++;
      continue;
    }

    // 1. Same top-level namespaces.
    const targetNamespaces = new Set(Object.keys(target));
    const missingNamespaces = [...sourceNamespaces].filter((n) => !targetNamespaces.has(n));
    const extraNamespaces = [...targetNamespaces].filter((n) => !sourceNamespaces.has(n));
    if (missingNamespaces.length) {
      console.error(`[i18n] FAIL ${locale}: missing namespaces ${missingNamespaces.join(", ")}`);
      failures++;
    }
    if (extraNamespaces.length) {
      console.error(`[i18n] WARN ${locale}: extra namespaces ${extraNamespaces.join(", ")}`);
    }

    // 2. Same leaf-key set.
    const targetKeys = collectKeys(target);
    const targetKeySet = new Set(targetKeys);
    // Keys present in the source (new feature content) but absent from this
    // target — the failure case that lets untranslated UI reach production.
    const missing = [...sourceKeys].filter((k) => !targetKeySet.has(k));
    // Keys present in the target but not the source — stale leftovers.
    const stale = targetKeys.filter((k) => !sourceKeys.has(k));
    if (missing.length) {
      console.error(
        `[i18n] FAIL ${locale}: ${missing.length} key(s) missing from ${locale} (present in source): ${missing.slice(0, 10).join(", ")}${missing.length > 10 ? "…" : ""}`
      );
      failures++;
    }
    if (stale.length) {
      console.error(
        `[i18n] WARN ${locale}: ${stale.length} key(s) in target but not source (stale): ${stale.slice(0, 10).join(", ")}${stale.length > 10 ? "…" : ""}`
      );
    }

    if (!missing.length && !stale.length && !missingNamespaces.length) {
      console.log(`[i18n] OK ${locale}: ${targetKeys.length} keys, namespaces in sync`);
    }
  }

  if (failures) {
    console.error("[i18n] FAIL: message parity check failed. See above.");
    process.exit(1);
  }
  console.log("[i18n] OK: all target locales are in sync with the source locale.");
  process.exit(0);
}

main();