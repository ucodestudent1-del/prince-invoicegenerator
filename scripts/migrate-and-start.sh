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

  # Resolve the failed TemplateStyle migration if it is still recorded
  # in the production _prisma_migrations table. The migration folder was
  # removed from the repo, so recreate it temporarily just for resolution.
  RESOLVE_CREATED=0
  if [ ! -d "prisma/migrations/20260816223700_replace_template_styles" ]; then
    echo "Creating temporary migration folder for resolve..."
    mkdir -p prisma/migrations/20260816223700_replace_template_styles
    echo "-- placeholder" > prisma/migrations/20260816223700_replace_template_styles/migration.sql
    RESOLVE_CREATED=1
  fi

  echo "Resolving failed migration 20260816223700_replace_template_styles..."
  npx prisma migrate resolve --rolled-back 20260816223700_replace_template_styles || true

  if [ "$RESOLVE_CREATED" = "1" ]; then
    echo "Removing temporary migration folder..."
    rm -rf prisma/migrations/20260816223700_replace_template_styles
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
