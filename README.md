# FleetFlow-TMS (Next.js + React + gRPC rewrite)

Parallel rewrite of [`FleetFlow-TMS`](https://github.com/asadullah43/FleetFlow-TMS) (NestJS + Flutter/REST)
onto a new stack, same functionality and the same Postgres/Prisma data model:

| Layer | Legacy repo | This repo |
|---|---|---|
| Frontend | Flutter Web | Next.js + React (TypeScript) |
| Backend | NestJS (REST) | Node.js (TypeScript), native gRPC — no NestJS |
| Browser \<-\> backend | REST/JSON over HTTP | grpc-web, bridged to native gRPC by **Envoy** |
| Database | PostgreSQL + Prisma | Same — `backend/prisma/schema.prisma` is carried over as-is |
| Auth | JWT (HTTP header) | JWT (gRPC metadata) |

Browsers can't speak native gRPC directly, so the frontend calls **Envoy**
(`envoy/envoy.yaml`), which translates grpc-web into native gRPC calls to
the backend. In production, `nginx.conf` puts one public origin in front
of both Next.js and Envoy (`/grpc/*` → Envoy, everything else → Next.js),
so the browser never needs to know they're separate services.

## Status

Scaffolded and building the **Auth module end-to-end** as proof of the
stack (login, get current user, update language, get role permissions —
a direct port of the legacy `AuthController`/`AuthService`). The other 19
modules (Trucks, Drivers, Trips, Loading Orders, Rate Contracts,
Customers, Suppliers, Supplier Payments, Cargo Types, Locations,
Invoices + ZATCA e-invoicing, HR, Workshop, Company Settings, Roles,
Users, Dashboard, Uploads, Health) are ported the same way, one at a time.

## Repo layout

```
proto/              .proto files — one message/service set per module
backend/             Node.js gRPC server (TypeScript)
  src/modules/<name>/   <name>.service.ts (business logic) + <name>.grpc.ts (RPC handlers)
  src/common/errors/    Same AppError/ErrorCode pattern as the legacy backend, adapted for gRPC
  src/lib/               Prisma client, JWT helpers, gRPC auth middleware
  prisma/schema.prisma   Copied from the legacy repo, unchanged
frontend/             Next.js app (TypeScript)
  app/                   Routes (App Router) — one per legacy Flutter screen
  lib/grpc/              grpc-web client wiring, one file per module
envoy/envoy.yaml      grpc-web <-> gRPC bridge config
docker-compose.yml    database + backend + envoy + frontend + nginx
```

## Local development

Requires Node 22+, Docker, and a reachable Postgres instance (or use `docker compose up database`).

```bash
# 1. Install all workspaces
npm install
npm --prefix backend install
npm --prefix frontend install

# 2. Generate code
npm run proto:gen                 # proto -> TS message types (backend + frontend)
cd backend && npx prisma generate # Prisma client (needs real network access —
                                   # blocked in sandboxed CI/dev containers that
                                   # can't reach binaries.prisma.sh)

# 3. Configure env
cp backend/.env.example backend/.env       # set DATABASE_URL, JWT_SECRET
cp frontend/.env.example frontend/.env     # NEXT_PUBLIC_GRPC_WEB_URL

# 4. Run
npm run dev:backend     # gRPC server on :50051
npm run dev:frontend    # Next.js on :3000 (talks directly to Envoy for local dev)
docker compose up envoy # grpc-web bridge on :8080, needed even in local dev
```

## Docker

```bash
docker compose build
docker compose up -d
```

Mirrors the legacy repo's deployment shape (Postgres + backend + frontend
+ nginx), with an added `envoy` service for the grpc-web bridge.
