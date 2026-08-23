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
