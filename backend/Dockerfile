# Build context is the REPO ROOT (see docker-compose.yml: context: .,
# dockerfile: backend/Dockerfile) because this service needs the sibling
# /proto directory, not just backend/.
FROM node:22-alpine AS base
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
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/generated/prisma ./src/generated/prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY backend/prisma ./prisma
COPY proto /proto

EXPOSE 50051
CMD ["node", "dist/server.js"]
