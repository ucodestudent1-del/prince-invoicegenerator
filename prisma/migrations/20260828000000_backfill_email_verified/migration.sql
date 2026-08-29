-- Backfill email verification for pre-existing credential users.
--
-- The dashboard gate (src/app/[locale]/dashboard/layout.tsx) now requires
-- emailVerified before granting access. Existing credential users created
-- before verification was enforced have emailVerified = NULL, which would
-- lock them out of the dashboard after deploy. This one-time backfill marks
-- them as verified so enforcement applies only to NEW signups going forward.
-- New signups still insert emailVerified = NULL and remain enforced.
--
-- OAuth/Google users already have emailVerified set by NextAuth, so they are
-- excluded by the WHERE clause. This statement is idempotent.
--
-- Apply with: npx prisma migrate deploy

UPDATE "User" SET "emailVerified" = now() WHERE "emailVerified" IS NULL;
