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
  # The schema already contains these changes (verified in schema.prisma),
  # so the database changes were likely applied before the migration failed.
  # Mark it as applied to sync Prisma's migration history.
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
