#!/bin/sh
# Wait for database to be ready and apply pending migrations
# This script is safe to run multiple times

set -e

echo "Running database migrations..."

# Run migrations
npx prisma migrate deploy

echo "Migrations completed successfully."

# Start the application
exec npm start
