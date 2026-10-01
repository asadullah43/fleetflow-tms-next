# Build context is the REPO ROOT (see docker-compose.yml: context: .,
# dockerfile: backend/Dockerfile) because this service needs the sibling
# /proto directory, not just backend/.
FROM node:22-alpine AS base
# Prisma's engines (query + migrations) link against OpenSSL.
RUN apk add --no-cache openssl
WORKDIR /app

FROM base AS deps
COPY backend/package.json backend/package-lock.json* ./
RUN npm ci

FROM deps AS build
COPY backend/ .
COPY proto ../proto
RUN npx prisma generate
RUN npm run build

FROM base AS production
ENV NODE_ENV=production
COPY backend/package.json backend/package-lock.json* ./
# The Prisma CLI is a runtime dependency: the container applies pending
# database migrations itself before the API starts (see CMD).
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
# The generated client's query engine is looked up at the path it was generated to.
COPY --from=build /app/generated/prisma ./generated/prisma
COPY backend/prisma ./prisma
COPY proto /proto

EXPOSE 50051
# 1. db:prepare — records the baseline on a pre-migrations database, applies
#    pending migrations (never drops or resets anything), and creates the
#    first admin user only if the database has no users at all.
# 2. start the API.
CMD ["sh", "-c", "node dist/admin_app.js db:prepare && node dist/app.js"]
