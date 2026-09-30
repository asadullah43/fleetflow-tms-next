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

All 20 legacy modules are ported, backend and frontend, with a shared
design system (sidebar app shell, dense-data theme):

Auth, Locations, Cargo Types, Customers, Suppliers, Trucks, Drivers,
Truck-Driver Assignments, Trips, Rate Contracts, Loading Orders, Supplier
Payments, Company Settings, Roles (permission matrix), Users, Invoices
(with line items and totals), HR (Departments/Designations/Employees/
Attendance/Leave Requests/Documents/Contracts), Workshop (Work Orders/
Maintenance Schedules/Inspections/Spare Parts/Expenses/nested line
items), and Dashboard (real summary stats).

Known gaps/simplifications, called out so they're not mistaken for bugs:

- **ZATCA e-invoicing** — Phase-1 QR codes are a real implementation
  (`backend/src/modules/invoices/zatca-qr.ts`, TLV-encoded seller/VAT/
  timestamp/total/VAT amount). Phase-2 (cryptographic invoice stamping,
  live clearance/reporting against ZATCA's API) needs a government-issued
  CSR and CSID certificate for a real CR number, which this environment
  has no way to request or test against — `CompanySettings`' `zatca_*`
  onboarding columns are already in the schema for when real certificates
  are available.
- A few loading-order and work-order-part error codes reuse a
  neighboring `ErrorCode` entry where the legacy table didn't have an
  exact match (e.g. no `LDO_UPDATE_FAILED` code existed) — cosmetic only,
  doesn't affect behavior.
- `backend/src/generated/prisma/` (the Prisma Client) isn't checked in —
  run `npx prisma generate` after `npm install` (needs network access to
  `binaries.prisma.sh`, which some sandboxes block; works fine on a normal
  machine or in the Docker build).

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

`npm run proto:gen` must be run **before** `docker compose build` — the
frontend image's `COPY . .` picks up whatever is on disk, including the
generated proto client code, and it isn't regenerated inside the Docker
build itself. Skipping this after pulling new/changed `.proto` files
gives a frontend build error about a missing `generated/proto/messages`
module or missing exports on `fleetflow.<module>`.

```bash
npm install                 # once, if you haven't
npm run proto:gen           # regenerate proto client code (do this after every pull)
docker compose down         # stop anything already running (old containers, old ports)
docker compose up -d --build
```

Mirrors the legacy repo's deployment shape (Postgres + backend + frontend
+ nginx), with an added `envoy` service for the grpc-web bridge.
