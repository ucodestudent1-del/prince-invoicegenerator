# Docker Build & Dependency Remediation Plan

## 1. Prisma Schema Not Found During postinstall

### Problem

pm ci --omit=dev in the deps stage runs postinstall (prisma generate). The
prisma/ directory is not copied into that stage, and the prisma CLI itself is a
devDependency (omitted). Both cause the failure: Error: Could not load schema.

### Fix (applied)
- deps stage: added --ignore-scripts to skip postinstall; Prisma CLI is not
  needed for the production dependency install.
- uilder stage: installed openssl (Alpine package), then explicitly ran
  
px prisma generate after copying the full source.
- unner stage: copied the generated Prisma artifacts
  (
ode_modules/.prisma, 
ode_modules/@prisma/client) from the uilder stage
  so the runtime 
ext start has a working Prisma Client.

## 2. OpenSSL / libssl Warning

### Problem

ode:20-alpine is Alpine-based and does not ship a system OpenSSL that Prisma
can detect, so it warns: "failed to detect the libssl/openssl version" and
defaults to openssl-1.1.x.

### Fix (applied)
- Added RUN apk add --no-cache openssl in the uilder stage before
  prisma generate. This makes OpenSSL available for the Prisma query engine
  generation step.

## 3. Deprecated npm Packages

All deprecations originate from older transitive dependencies. Below is the
inventory and upgrade path.

| Package | Version | Brought by | Upgrade Target |
|---------|---------|-----------|----------------|
| rimraf | 3.0.2 | prisma, eslint-config-next | 6.x |
| inflight | 1.0.6 | glob | replaced by lru-cache (internal) |
| glob | 7.2.3 / 10.3.10 | multiple | 11.x |
| uuid | 9.0.1 | next-auth, @next-auth/prisma-adapter | 11.x |
| @humanwhocodes/* | 0.13/2.0 | eslint 8 | replace with @eslint/* |
| eslint | 8.57.1 | direct devDep | 9.x (flat config) |

### Strategy
1. **Upgrade direct devDependencies first**:
   - prisma + @prisma/client: 5.22.0 → 6.x
   - eslint + eslint-config-next: 8.x → 9.x
   - 	ypescript: 5.6.3 → 5.8+
2. **Regenerate lockfile** after each upgrade, committing package-lock.json.
3. Transitive deprecated packages resolve automatically once their consumers are updated.
4. **Avoid pinning** old versions via overrides; prefer upgrading the source.

## 4. Build Optimization Recommendations

- Keep --omit=dev in the deps stage but add --ignore-scripts to prevent
  postinstall-side-effects (Prisma generation belongs in the builder).
- Run prisma generate in the uilder stage only, after source is copied.
- Copy generated Prisma artifacts (
ode_modules/.prisma, @prisma/client)
  overlays into the runner rather than re-running postinstall at runtime.
- Use --no-cache builds in CI after changes to avoid stale layers.
- Consider pinning 
ode:20-alpine to a digest for reproducibility.