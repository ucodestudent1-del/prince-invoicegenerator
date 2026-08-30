-- Security / compliance audit trail (Plan 2.4)
--
-- Apply with: npx prisma migrate deploy
-- The application's isMissingColumnError fallbacks tolerate an unmigrated
-- database: audit writes are best-effort and degrade to a warning log when this
-- table is absent, so deploying the code before the migration is safe.

-- ---------------------------------------------------------------------------
-- 1. Create the AuditLog table
-- ---------------------------------------------------------------------------
-- No foreign key on "orgId" by design: audit history must outlive the records
-- it describes, and a CASCADE/SET NULL would mutate immutable rows.

CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "actorRole" TEXT,
    "category" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "outcome" TEXT NOT NULL DEFAULT 'SUCCESS',
    "ip" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "AuditLog_orgId_createdAt_idx" ON "AuditLog" ("orgId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_actorId_createdAt_idx" ON "AuditLog" ("actorId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_category_action_idx" ON "AuditLog" ("category", "action");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog" ("createdAt");

-- ---------------------------------------------------------------------------
-- 2. Enforce append-only semantics at the database level
-- ---------------------------------------------------------------------------
-- The application exposes no UPDATE or DELETE path for AuditLog. This trigger
-- makes that a database guarantee rather than a convention, so a future code
-- change (or a compromised application role) cannot rewrite history.
--
-- Retention pruning and legally mandated erasure remain possible for an
-- operator by opting out for the duration of a single transaction:
--
--   BEGIN;
--   SET LOCAL "app.audit_bypass" = 'on';
--   DELETE FROM "AuditLog" WHERE "createdAt" < now() - interval '2 years';
--   COMMIT;
--
-- See docs/runbooks/backup-restore.md for the retention procedure.

CREATE OR REPLACE FUNCTION "auditlog_reject_mutation"() RETURNS trigger AS $$
BEGIN
  IF coalesce(current_setting('app.audit_bypass', true), 'off') = 'on' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'AuditLog is append-only: % is not permitted', TG_OP
    USING HINT = 'Set LOCAL "app.audit_bypass" = ''on'' for approved retention or erasure work.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "AuditLog_reject_update" ON "AuditLog";
CREATE TRIGGER "AuditLog_reject_update"
    BEFORE UPDATE ON "AuditLog"
    FOR EACH ROW EXECUTE FUNCTION "auditlog_reject_mutation"();

DROP TRIGGER IF EXISTS "AuditLog_reject_delete" ON "AuditLog";
CREATE TRIGGER "AuditLog_reject_delete"
    BEFORE DELETE ON "AuditLog"
    FOR EACH ROW EXECUTE FUNCTION "auditlog_reject_mutation"();
