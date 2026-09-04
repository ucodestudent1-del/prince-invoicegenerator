FROM node:24-alpine3.20 AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM node:24-alpine3.20 AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package*.json ./
# --ignore-scripts: skip postinstall (prisma generate) until the prisma/ schema is copied below
RUN npm ci --ignore-scripts
COPY . .
# Build args for NEXT_PUBLIC_* vars: these are inlined by Next.js at build time
# into the client bundle. Since .env is excluded by .dockerignore, pass them
# explicitly during docker build (e.g. --build-arg NEXT_PUBLIC_APP_NAME=Prince).
ARG NEXT_PUBLIC_APP_NAME
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_UNLOCK_ALL_FEATURES
ENV NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME:-Prince}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_PUBLIC_UNLOCK_ALL_FEATURES=${NEXT_PUBLIC_UNLOCK_ALL_FEATURES}
# Prevent Next.js from attempting to patch the lockfile at build time.
# next@14.2.35's patch-incorrect-lockfile.js crashes with a TypeError when it
# fetches @next/swc-* from the npm registry looking for version "14.2.35"
# (which doesn't exist on npm — the SWC packages max out at 14.2.33).
# The lockfile is already correct, so the patch is unnecessary.
ENV NEXT_IGNORE_INCORRECT_LOCKFILE=true
RUN npx prisma generate
RUN npm run build

FROM node:24-alpine3.20 AS runner
WORKDIR /app
ENV NODE_ENV production
# Mirror the env var from the builder so runtime code is consistent.
ENV NEXT_IGNORE_INCORRECT_LOCKFILE=true
# Provide OpenSSL 3.x (libssl.so.3) + glibc compat symbols for the Prisma
# OpenSSL-3 musl Query Engine stitched by the builder (see binaryTargets).
RUN apk add --no-cache libc6-compat openssl
# Copy production deps (includes @prisma/engines needed by the prisma CLI)
COPY --from=deps /app/node_modules ./node_modules
# Copy generated Prisma client + engine binaries from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
# Copy prisma CLI and schema/migrations from builder so migrate-deploy works at runtime
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=builder /app/prisma ./prisma
# Copy build output and public assets from builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY package*.json ./
# Copy startup script
COPY scripts/migrate-and-start.sh ./scripts/migrate-and-start.sh
RUN chmod +x ./scripts/migrate-and-start.sh
EXPOSE 3000
CMD ["./scripts/migrate-and-start.sh"]

