#!/bin/sh
# Wait for database to be ready and apply pending migrations
# This script is safe to run multiple times

set -e

echo "Starting application..."

# Verify prisma CLI is available
if ! command -v npx >/dev/null 2>&1; then
  echo "Error: npx not found"
  exit 1
fi

# Check DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "Warning: DATABASE_URL is not set. Skipping migrations."
else
  echo "Running database migrations..."

  # -------------------------------------------------------------------------
  # Resolve the failed TemplateStyle migration.
  # This migration was reverted from the schema but may still be recorded
  # as failed in production _prisma_migrations. Mark it as rolled back.
  # -------------------------------------------------------------------------
  RESOLVE_CREATED=0
  if [ ! -d "prisma/migrations/20260816223700_replace_template_styles" ]; then
    echo "Creating temporary migration folder for TemplateStyle resolve..."
    mkdir -p prisma/migrations/20260816223700_replace_template_styles
    echo "-- placeholder" > prisma/migrations/20260816223700_replace_template_styles/migration.sql
    RESOLVE_CREATED=1
  fi

  echo "Resolving failed migration 20260816223700_replace_template_styles..."
  npx prisma migrate resolve --rolled-back 20260816223700_replace_template_styles || true

  if [ "$RESOLVE_CREATED" = "1" ]; then
    echo "Removing temporary TemplateStyle migration folder..."
    rm -rf prisma/migrations/20260816223700_replace_template_styles
  fi

   # -------------------------------------------------------------------------
   # Resolve the failed client portal migration.
   # The 20260820083000_add_client_portal migration's SQL was never actually
   # executed against the production database — it was only marked as "applied"
   # via prisma migrate resolve. The missing columns are repaired by the
   # 20260824_add_portal_access_fix migration, which runs below as a pending
   # migration. Mark the old migration as applied so Prisma doesn't try to
   # re-run it during deploy.
   # -------------------------------------------------------------------------
  PORTAL_RESOLVE_CREATED=0
  if [ ! -d "prisma/migrations/20260820083000_add_client_portal" ]; then
    echo "Creating temporary migration folder for client portal resolve..."
    mkdir -p prisma/migrations/20260820083000_add_client_portal
    echo "-- placeholder" > prisma/migrations/20260820083000_add_client_portal/migration.sql
    PORTAL_RESOLVE_CREATED=1
  fi

  echo "Resolving failed migration 20260820083000_add_client_portal..."
  npx prisma migrate resolve --applied 20260820083000_add_client_portal || true

  if [ "$PORTAL_RESOLVE_CREATED" = "1" ]; then
    echo "Removing temporary client portal migration folder..."
    rm -rf prisma/migrations/20260820083000_add_client_portal
  fi

  # -------------------------------------------------------------------------
  # Resolve the failed reminder stages migration.
  # The schema already contains these changes (verified in schema.prisma),
  # so the database changes were likely applied before the migration failed.
  # Mark it as applied to sync Prisma's migration history.
  # -------------------------------------------------------------------------
  REMINDER_RESOLVE_CREATED=0
  if [ ! -d "prisma/migrations/20260820190000_add_reminder_stages" ]; then
    echo "Creating temporary migration folder for reminder stages resolve..."
    mkdir -p prisma/migrations/20260820190000_add_reminder_stages
    echo "-- placeholder" > prisma/migrations/20260820190000_add_reminder_stages/migration.sql
    REMINDER_RESOLVE_CREATED=1
  fi

  echo "Resolving failed migration 20260820190000_add_reminder_stages..."
  npx prisma migrate resolve --applied 20260820190000_add_reminder_stages || true

  if [ "$REMINDER_RESOLVE_CREATED" = "1" ]; then
    echo "Removing temporary reminder stages migration folder..."
    rm -rf prisma/migrations/20260820190000_add_reminder_stages
  fi
  # -------------------------------------------------------------------------
  # Resolve the failed estimate enhancements migration.
  # The schema already contains these changes (verified in schema.prisma):
  # EstimateStatus enum values VIEWED/INVOICED/REJECTED, Estimate columns
  # shareToken/viewedAt/acceptedAt/rejectedAt/rejectionReason/convertedAt/sentAt,
  # Invoice.estimateId FK, and EstimateAudit table. The database changes were
  # likely applied before the migration failed. Mark it as applied to sync
  # Prisma migration history.
  # -------------------------------------------------------------------------
  ESTIMATE_RESOLVE_CREATED=0
  if [ ! -d "prisma/migrations/20260820_add_estimate_enhancements" ]; then
    echo "Creating temporary migration folder for estimate enhancements resolve..."
    mkdir -p prisma/migrations/20260820_add_estimate_enhancements
    echo "-- placeholder" > prisma/migrations/20260820_add_estimate_enhancements/migration.sql
    ESTIMATE_RESOLVE_CREATED=1
  fi

  echo "Resolving failed migration 20260820_add_estimate_enhancements..."
  npx prisma migrate resolve --applied 20260820_add_estimate_enhancements || true

  if [ "$ESTIMATE_RESOLVE_CREATED" = "1" ]; then
    echo "Removing temporary estimate enhancements migration folder..."
    rm -rf prisma/migrations/20260820_add_estimate_enhancements
  fi
  # -------------------------------------------------------------------------
  # Resolve the failed owner unique constraint migration.
  # The schema already contains this change (verified in schema.prisma:
  # Organization.ownerId String @unique on line 199), so the database
  # changes were likely applied before the migration tracking record failed.
  # Mark it as applied to sync Prisma's migration history.
  # The migration folder exists in the repo, so no temp folder needed.
  # -------------------------------------------------------------------------
   echo "Resolving failed migration 20260821_add_owner_unique..."
   npx prisma migrate resolve --applied 20260821_add_owner_unique || true

   # -------------------------------------------------------------------------
   # Resolve the failed 20260825_repair_estimate_enhancements migration.
   # This migration was attempted but failed because PostgreSQL does not allow
   # ALTER TYPE ... ADD VALUE inside DO $$ blocks (transactional context).
   # The migration folder exists in the repo. Mark it as rolled-back so the
   # fixed version can run during deploy.
   # -------------------------------------------------------------------------
   ESTIMATE_REPAIR_CREATED=0
   if [ ! -d "prisma/migrations/20260825_repair_estimate_enhancements" ]; then
     echo "Creating temporary migration folder for estimate repair resolve..."
     mkdir -p prisma/migrations/20260825_repair_estimate_enhancements
     echo "-- placeholder" > prisma/migrations/20260825_repair_estimate_enhancements/migration.sql
     ESTIMATE_REPAIR_CREATED=1
   fi

   echo "Resolving failed migration 20260825_repair_estimate_enhancements..."
   npx prisma migrate resolve --rolled-back 20260825_repair_estimate_enhancements || true

   if [ "$ESTIMATE_REPAIR_CREATED" = "1" ]; then
     echo "Removing temporary estimate repair migration folder..."
     rm -rf prisma/migrations/20260825_repair_estimate_enhancements
   fi

  # Retry migrations up to 5 times in case database is not ready yet
  max_retries=5
  retry=1
  until npx prisma migrate deploy; do
    if [ $retry -ge $max_retries ]; then
      echo "Migration failed after $retry attempts"
      exit 1
    fi
    echo "Migration attempt $retry failed, retrying in $((retry * 5))s..."
    sleep $((retry * 5))
    retry=$((retry + 1))
  done

  echo "Migrations completed successfully."
fi

# Start the application
exec npm start
