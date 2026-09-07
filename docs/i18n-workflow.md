# i18n workflow

This document describes how localization is wired into the Prince Invoice
Generator, why new features were shipping untranslated, and the process that
now prevents it.

## Supported locales

| Locale | File                | Role        |
|--------|---------------------|-------------|
| `en`   | `src/messages/en.json`  | **Source of truth** — new feature content is authored here first. |
| `de`   | `src/messages/de.json`  | Target — translated. |
| `es`   | `src/messages/es.json`  | Target — translated. |
| `fr`   | `src/messages/fr.json`  | Target — translated. |

Routing is declared once in `src/i18n/routing.ts`; `src/i18n/request.ts`
resolves the active locale per request (cookie → DB user/org →
`Accept-Language` → default) and loads the matching message bundle.

## Root causes of the previous gap

1. **Translation was a manual, out-of-band step.** The only i18n tooling that
   existed (`scripts/i18n-add-phase2.cjs`, `scripts/i18n-add-projects.cjs`)
   wrote **only to `en.json`**. Nothing propagated the new keys into
   `de/es/fr`, so a feature that landed in code on Monday could reach
   production on Friday still missing its German/Spanish/French strings.

2. **CI never checked message parity.** `.github/workflows/ci.yml` ran
   lint → typecheck → test → build. None of those steps can detect that
   `de.json` is missing a key that `en.json` just gained, so the drift was
   invisible to automation and only surfaced as a raw key string in the UI.

3. **`next-intl` fails silently.** `useTranslations()` returns the *literal
   key* (e.g. `"invoiceTemplates.yourTemplates"`) when a key is absent. There
   is no exception, no build error, and no console warning — the end user just
   sees broken copy.

## The fix (three layers)

### Layer 1 — a merge script that closes the authoring gap

`scripts/i18n-merge.cjs` walks the source locale (`en.json`) and, for every
target locale, inserts any key that is missing. Existing translations are
preserved; only genuinely new keys are backfilled with the English value as a
placeholder that a translator then replaces.

```bash
npm run i18n:merge   # write missing keys into de/es/fr (default)
npm run i18n:check   # exit 1 if any target is out of sync (dry run)
```

### Layer 2 — a CI gate that fails the build on drift

`.github/workflows/ci.yml` now runs `npm run i18n:verify` (which calls
`scripts/i18n-verify.cjs`) immediately after lint. The verifier:

- validates that every locale file is syntactically valid JSON,
- checks that every target declares the same top-level namespaces as `en`,
- fails if a target is **missing** a key that exists in the source,
- warns (does not fail) about **stale** keys that exist in a target but not in
  the source.

Because this runs on every push to `main` and on every pull request, a
developer cannot merge a feature that added `t("foo.bar")` without also
merging the key — the CI job turns red until the merge script has been run
and the placeholders translated.

### Layer 3 — a runtime safety net

`src/i18n/request.ts` now backfills any key the active locale is missing from
the source locale bundle, at request time. This is deliberately a *net*, not
a *control*: it guarantees that a missing translation renders English (the
author's wording) rather than the raw key string, even if the CI gate is
bypassed (e.g. a hotfix pushed directly). It is cheap: the source bundle is
imported once and walked only when the active locale is not `en`.

## Process for a new feature

1. Author the English copy and add the keys to `src/messages/en.json`.
   (Developers typically do this inside the feature branch, alongside the
   component that consumes it.)
2. Run `npm run i18n:merge`. This inserts the new keys into `de/es/fr` with
   English placeholders and commits the message files.
3. Translate the newly inserted placeholders in each target locale.
4. CI runs `npm run i18n:verify` and will refuse to pass until every target
   locale is in sync with `en.json`.
5. Ship.

## Debugging

- To see what is out of sync locally: `npm run i18n:check`.
- To see the raw diff after a merge: `git diff src/messages`.
- If a user ever sees a literal key string in the UI, the runtime backfill in
  `src/i18n/request.ts` should have substituted English; if it did not, the
  key is missing from `en.json` itself — add it there first.