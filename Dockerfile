FROM node:20-alpine3.20 AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM node:20-alpine3.20 AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package*.json ./
# --ignore-scripts: skip postinstall (prisma generate) until the prisma/ schema is copied below
RUN npm ci --ignore-scripts
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine3.20 AS runner
WORKDIR /app
ENV NODE_ENV production
# Provide OpenSSL 3.x (libssl.so.3) + glibc compat symbols for the Prisma
# OpenSSL-3 musl Query Engine stitched by the builder (see binaryTargets).
RUN apk add --no-cache libc6-compat openssl
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY package*.json ./
EXPOSE 3000
CMD ["npm", "start"]

