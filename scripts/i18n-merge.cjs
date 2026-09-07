#!/usr/bin/env node
/**
 * i18n:merge
 *
 * Merge new keys from the source locale (en.json) into every target locale
 * file (de, es, fr). Keys that already exist in a target are left untouched
 * (preserving an existing human translation); keys that are missing are
 * inserted with the English value as a placeholder so the UI never renders a
 * raw key string.
 *
 * Usage:
 *   node scripts/i18n-merge.cjs            # merge into all targets
 *   node scripts/i18n-merge.cjs --check    # exit 1 if any target is out of sync (CI)
 *   node scripts/i18n-merge.cjs --write    # write missing keys (default behaviour)
 *
 * Exit codes:
 *   0  in sync (or successfully merged)
 *   1  out of sync in --check mode, or a fatal error
 */

"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MESSAGES_DIR = path.join(ROOT, "src", "messages");

// Source of truth. New feature content is authored here first.
const SOURCE_LOCALE = "en";
// Locales that must mirror the source's key set.
const TARGET_LOCALES = ["de", "es", "fr"];

function readLocale(locale) {
  const file = path.join(MESSAGES_DIR, `${locale}.json`);
  const raw = fs.readFileSync(file, "utf8");
  return JSON.parse(raw);
}

function writeLocale(locale, data) {
  const file = path.join(MESSAGES_DIR, `${locale}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
}

/**
 * Recursively collect every leaf key path in a nested object as
 * "namespace.key.subkey" strings.
 */
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

function diff(sourceKeys, targetKeys) {
  const targetSet = new Set(targetKeys);
  const missing = sourceKeys.filter((k) => !targetSet.has(k));
  return missing;
}

function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes("--check");
  const write = !checkOnly || args.includes("--write");

  if (!fs.existsSync(MESSAGES_DIR)) {
    console.error(`Messages directory not found: ${MESSAGES_DIR}`);
    process.exit(1);
  }

  let source;
  try {
    source = readLocale(SOURCE_LOCALE);
  } catch (err) {
    console.error(`Failed to read source locale ${SOURCE_LOCALE}: ${err.message}`);
    process.exit(1);
  }
  const sourceKeys = collectKeys(source);

  let anyMissing = false;
  const report = [];

  for (const locale of TARGET_LOCALES) {
    let target;
    try {
      target = readLocale(locale);
    } catch (err) {
      console.error(`[i18n] ${locale}.json is unreadable: ${err.message}`);
      anyMissing = true;
      continue;
    }

    const missing = diff(sourceKeys, collectKeys(target));
    if (missing.length === 0) {
      report.push(`${locale}: in sync (${collectKeys(target).length} keys)`);
      continue;
    }

    anyMissing = true;
    report.push(`${locale}: ${missing.length} missing key(s)`);

    if (write) {
      // Insert missing keys with the English value as a translation placeholder.
      for (const keyPath of missing) {
        const parts = keyPath.split(".");
        let cursor = target;
        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          if (cursor[part] === undefined || typeof cursor[part] !== "object") {
            cursor[part] = {};
          }
          cursor = cursor[part];
        }
        const leaf = parts[parts.length - 1];
        // Walk the source to fetch the English value.
        let srcCursor = source;
        for (let i = 0; i < parts.length - 1; i++) {
          srcCursor = srcCursor[parts[i]];
        }
        cursor[leaf] = srcCursor[leaf];
      }
      writeLocale(locale, target);
      console.log(`[i18n] wrote ${missing.length} missing key(s) to ${locale}.json`);
    }
  }

  for (const line of report) {
    console.log(`[i18n] ${line}`);
  }

  if (checkOnly && anyMissing) {
    console.error(
      "[i18n] FAIL: target locales are missing keys that exist in the source locale. " +
        "Run `npm run i18n:merge` to auto-fill placeholders, then translate them."
    );
    process.exit(1);
  }

  if (checkOnly) {
    console.log("[i18n] OK: all target locales are in sync with the source locale.");
  }
  process.exit(0);
}

main();