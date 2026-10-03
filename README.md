# FleetFlow TMS

A bilingual (English / Arabic) transport management system: trips, loading
orders, invoices with ZATCA Phase-1 QR, fleet and driver master data,
workshop, inventory, HR, and role-based administration. Built to serve
several companies from one installation, each seeing only its own data.

| Layer | Technology |
|---|---|
| Frontend | Next.js + React (TypeScript), Mantine, TanStack Query, Day.js |
| Backend | Node.js (TypeScript), native gRPC |
| Browser ↔ backend | grpc-web, bridged to gRPC by Envoy; nginx puts both behind one origin |
| Database | PostgreSQL + Prisma (with migration history) |
| Read cache | Redis (optional): lists, dropdown options and dashboard figures, per company; every write invalidates at once, and the API reads PostgreSQL whenever Redis is unset or down. See `backend/_core_app_connectivities/cache.ts` |
| Auth | 12-hour JWT sessions for people, API keys for integrations |

## Modules

Auth · Dashboard · Trips · Loading Orders (printable PDF) · Invoices (line
items, exact totals, ZATCA QR) · Supplier Payments · Trucks · Drivers ·
Truck-Driver Assignments · Customers · Suppliers · Locations · Cargo Types ·
Rate Contracts · Workshop (work orders, maintenance, inspections, expenses) ·
Inventory · HR (departments, designations, employees, attendance, leave,
documents, contracts) · Users · Roles · Company Settings · API Keys.

**ZATCA:** Phase 1 (the TLV QR code on each invoice) is implemented.
Phase 2 (cryptographic stamping and live clearance against ZATCA's API)
is not — it needs government-issued certificates.

## Repository layout

```
proto/                    The API contract: one .proto per module
backend/
  app.ts                  API server entry point (wiring only)
  admin_app.ts            Operator CLI: database preparation, companies, API keys
  routes/                 Every rpc and its middleware chain
  middlewares/            Rate limit, authentication, authorization, validation, idempotency, errors
  controllers/            Thin: validated input → service call
  services/               Business rules
  data_repositories/      Shared data access (paged lists, CRUD)
  validations/            One zod schema per request
  global_config/          The only place environment variables are read; error-code table
  _core_app_connectivities/  Database client (tenant-scoped), proto loader, tenant context
  _bg_services/           Background jobs
  classes/ models/ utils/ Shared types and helpers
  event_driven_services/ plugins/   Reserved (see their READMEs)
  technical_dev_docs/     API reference and the error-code registry
  prisma/                 Schema and migrations
  test/                   Unit tests; test/integration/ runs against a live backend
frontend/
  app/                    Routes only — each page re-exports a screen
  features/<domain>/      Screen (View) + view model + queries/mutations
  features/crud/          The shared list/create/edit/delete screen
  components/             Shared presentational components
  lib/api/                API client, one module per domain, query keys
  theme/ providers/       Mantine theme; app-wide providers
envoy/ nginx.conf docker-compose.yml
```

Request flow in the backend:

```
route → rate limit → authenticate → authorize → validate → idempotency → controller → service → repository → Prisma
```

Data flow in the frontend:

```
View → ViewModel hook → TanStack query / mutation → lib/api client → backend
```

## How the API behaves

Full details: [`backend/technical_dev_docs/api_reference.md`](backend/technical_dev_docs/api_reference.md).

- **One response shape.** Every rpc returns `{ STATUS, ERROR_CODE, ERROR_FILTER, ERROR_DESCRIPTION, DB_DATA }`.
  Error codes are listed in [`error_codes_data.md`](backend/technical_dev_docs/error_codes_data.md).
- **Lists are paged on the server** (20 per page by default, 100 at most), with server-side search, sort and filters.
- **Companies are isolated.** The company comes from the signed-in user or API key, never from the request.
- **Sessions last 12 hours** (`SESSION_DURATION`), enforced by the backend.
- **API keys** (Settings → API Keys) let other systems call the same API with only the permissions granted to the key.
- **Creates are idempotent** when the client sends an `Idempotency-Key` (the web app always does).
- **Rate limits** apply per IP, per user and per API key.

## Running with Docker

```bash
cp .env.example .env        # once: set JWT_SECRET (required) and POSTGRES_PASSWORD
npm install                 # once
npm run proto:gen           # after every pull that changes proto/ — the frontend image needs the generated client
docker compose up -d --build
```

The app is served at `http://localhost:8889`.

On start, the backend container prepares the database by itself: it
applies any pending migrations and, if the database has no users at all,
creates a first `admin` user. Its password is `SEED_ADMIN_PASSWORD` from
`.env` if you set one; otherwise a random password is printed once in the
backend log (`docker compose logs backend`). Change it after signing in.

`JWT_SECRET` has no default: `docker compose` refuses to start without
it. It signs every session token — generate one with
`openssl rand -base64 48` and keep it out of version control.

### Upgrading an existing installation

Back up first, then rebuild. Migrations only add to the database; nothing
is dropped or reset.

```bash
docker compose exec -T database pg_dump -U postgres fleetflow > backup.sql
git pull
npm install
npm run proto:gen
docker compose up -d --build
docker compose logs backend      # should end with "FleetFlow gRPC server listening"
```

A database created before migrations existed (with `prisma db push`) is
recognised automatically: the first migration is recorded as already
applied and only the newer ones run. Existing data becomes company #1.
Everyone signs in again after an upgrade that changes sessions.

## Operator commands

Run inside the backend container (`docker compose exec backend node dist/admin_app.js <command>`)
or locally (`npm --prefix backend run admin -- <command>`):

| Command | Does |
|---|---|
| `db:prepare` | Apply pending migrations; create the first admin if there are no users |
| `company:list` | List companies |
| `company:create --name "Acme" --admin-username acme --admin-email admin@acme.sa` | Create a company with its own ADMIN role and first admin (password from `ADMIN_PASSWORD`, or generated and printed once) |
| `company:suspend --id 2` / `company:activate --id 2` | Block / restore every sign-in and API key of a company |
| `apikey:create --company 1 --name "ERP sync" --grant trips:view,add --grant trucks:view` | Issue an API key from the server |

## Roles and permissions

Every rpc is checked on the server against the caller's role (Roles page →
permission matrix: View / Add / Edit / Delete per module).

- The built-in **ADMIN** role has full access, and can't be renamed or deleted. Users can't deactivate or delete themselves.
- List/Get needs **View**; Create needs **Add**; Update (and Mark Paid / Submit to ZATCA) needs **Edit**; Delete needs **Delete**.
- Shared lookup lists — trucks, drivers, customers, suppliers, locations, cargo types, assignments — are readable by any signed-in user, because other modules' forms pick from them. An API key needs the module's View permission even for these.
- `users`, `roles` and `apiKeys` are administrator rights — give them out accordingly. They can never be granted to an API key.
- Deactivating a user, changing their role, revoking a key or suspending a company takes effect on the next request.

The UI mirrors this: the sidebar lists only pages the role can view, and
Add / Edit / Delete appear only with the matching permission.

## Local development

Requires Node 22+ and a Postgres instance (`docker compose up -d database` gives one on port 5433).

```bash
npm install && npm --prefix backend install && npm --prefix frontend install
npm run proto:gen                              # frontend proto client
cp backend/.env.example backend/.env           # set DATABASE_URL, JWT_SECRET
cp frontend/.env.example frontend/.env
cd backend && npx prisma generate && npm run admin -- db:prepare && cd ..

npm run dev:backend        # gRPC server on :50051
docker compose up envoy    # grpc-web bridge on :8080
npm run dev:frontend       # Next.js on :3000
```

Changing the database: edit `backend/prisma/schema.prisma`, then
`npm --prefix backend run prisma:migrate` to create a migration. Do not
use `prisma db push` — it bypasses the migration history.

## Checks and tests

```bash
cd backend
npm run typecheck
npm test                    # unit tests: route table vs proto, tenancy map vs schema, error registry, pagination, …
npm run docs:errors         # regenerate the error-code registry after adding or changing a code
# integration tests against a running backend and a development database (they create records):
INTEGRATION_GRPC_ADDR=127.0.0.1:50051 npm run test:integration

cd ../frontend
npm run typecheck
npm run lint
npm test                    # incl. "every UI string has an Arabic entry" and the architecture guards
npm run build
```

The integration suite signs in as `admin` / `Admin123!` by default
(`INTEGRATION_ADMIN_USER` / `INTEGRATION_ADMIN_PASSWORD`). The
tenant-isolation and session-expiry tests also need the backend's own
`DATABASE_URL` and `JWT_SECRET` in the environment.

## Known limits

- Rate-limit counters live in the backend's memory: they reset on restart and assume one backend instance.
- The company logo is stored as a small image on the company record; there is no general file-upload storage.
- Before sign-in, the login screen shows company #1's name and logo (`DEFAULT_COMPANY_ID`).
- Live GPS tracking (the dashboard's Map tab) is a placeholder.
