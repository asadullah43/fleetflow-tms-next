# FleetFlow API reference

How to call the FleetFlow backend — for the web frontend and for external
integrations. The message and service definitions themselves live in
[`/proto`](../../proto); this document covers everything that is the same
for every call.

- [Transport](#transport)
- [The response envelope](#the-response-envelope)
- [Authentication](#authentication) — user sessions (JWT) and API keys
- [Authorization](#authorization)
- [Companies (tenants)](#companies-tenants)
- [Lists: pagination, search, sort, filters](#lists-pagination-search-sort-filters)
- [Idempotency](#idempotency)
- [Rate limits](#rate-limits)
- [Errors](#errors)
- [Services](#services)

## Transport

The API is gRPC (unary calls only).

| Caller | Reaches the backend through |
| --- | --- |
| Browser | grpc-web → nginx `/grpc/*` → Envoy → backend `:50051` |
| Server-side integration | grpc-web via the same public URL, or native gRPC to `:50051` if it is on the same network |

Request metadata (HTTP headers under grpc-web):

| Header | Purpose |
| --- | --- |
| `authorization: Bearer <token>` | User session (see below) |
| `x-api-key: <key>` | API key (see below) |
| `idempotency-key: <unique value>` | Optional, on create operations |
| `x-request-id: <id>` | Optional. Echoed into the server log line for the request; generated if absent |

## The response envelope

Every rpc returns `fleetflow.common.ApiResponse` ([`proto/common.proto`](../../proto/common.proto)),
whether it succeeded or failed. The gRPC status is `OK` in both cases; a
non-OK gRPC status means the transport itself failed (backend unreachable,
malformed frame), never an application error.

Success:

```
STATUS            "SUCCESSFUL"
ERROR_CODE        ""
ERROR_FILTER      ""
ERROR_DESCRIPTION ""
DB_DATA           <bytes: the rpc's result message, protobuf-encoded>
DB_DATA_TYPE      "fleetflow.trucks.TruckList"     // which message DB_DATA holds
```

Failure:

```
STATUS            "ERROR"
ERROR_CODE        "FLEET-TRK001"
ERROR_FILTER      "INVALID_REQUEST"
ERROR_DESCRIPTION "Truck not found."               // safe to show to the user
DB_DATA           <empty>
RATE_LIMIT        { type, retry_after_seconds, remaining_points }   // only when rate limited
```

Each rpc's result type is written next to it in the proto file
(`// DB_DATA: Truck`). Decode `DB_DATA` as that message.

`ERROR_DESCRIPTION` never contains stack traces, SQL, file paths or
internal identifiers. The cause of a server-side fault is written to the
server log only, alongside the request id.

## Authentication

One API, two kinds of credentials. Send exactly one of them.

### User session (JWT) — for people

```
AuthService.Login { username, password }  →  LoginResponse { access_token, expires_at, user }
```

Send the token on every later call: `authorization: Bearer <access_token>`.

- A session lasts **12 hours** from sign-in (`SESSION_DURATION`). It is not
  extended by activity and cannot be refreshed; after `expires_at` every
  call returns `FLEET-AUTH004` / `USER_NOT_AUTHENTICATED` and the user must
  sign in again. The backend enforces this regardless of what the client does.
- The user is re-checked on every call. Deactivating an account, changing
  its role, or suspending its company takes effect on the next request.
- Ten failed sign-ins for one username within 15 minutes block that
  username for 30 minutes (`FLEET-AUTH006`, with a `RATE_LIMIT` block).

### API key — for integrations

```
x-api-key: ffk_…
```

- Created by a signed-in user in **Settings → API keys**
  (`ApiKeysService.Create`), or by an operator on the server
  (`admin_app apikey:create`). The full key is returned **once**, at
  creation; only a SHA-256 hash and a short prefix are stored.
- A key belongs to **one company** and sees only that company's data.
- A key holds an explicit list of permissions (module + view/add/edit/delete)
  and nothing else. It is never an administrator and never acts as a user:
  it cannot read a user profile, manage users, roles or other API keys.
  The creator cannot grant a permission they do not hold themselves.
- `ApiKeysService.Revoke` disables a key permanently, effective on its next
  request (`FLEET-AUTH007`). Revoked keys stay listed for the audit trail.
- Every request is logged with `authMethod` (`JWT` or `API_KEY`), the
  `apiKeyId` or `userId`, and the company — never the key itself.
- Keys have their own rate limit (see below).

Treat a key like a password: keep it in a secret store, send it only over
HTTPS, and revoke it if it may have leaked.

## Authorization

Permissions are a matrix of *module* × *view / add / edit / delete*, held
by a role (for users) or directly by an API key. The built-in `ADMIN` role
may do everything. The check happens on the server for every call; a
denied call returns `FLEET-AUTH005` / `USER_NOT_AUTHORIZED`.

| Operation | Needs |
| --- | --- |
| `List`, `Get` | *view* on the module |
| `Create` | *add* |
| `Update`, and actions such as `MarkPaid`, `SubmitToZatca` | *edit* |
| `Delete`, `DeleteBatch`, `ApiKeys.Revoke` | *delete* |

Reference lists that forms pick from — trucks, drivers, customers,
suppliers, locations, cargo types, assignments, and company settings — can
be *read* by any signed-in user. An API key still needs the module's
*view* permission for them.

`AuthService.GetMyPermissions` returns the caller's effective matrix.

## Companies (tenants)

Every record belongs to a company. The company is taken from the
credential (the user's company, or the API key's company) — never from the
request. A `company_id` sent by a client is ignored. Records of another
company behave exactly as if they did not exist: they are not listed, not
found by id, and cannot be referenced.

Running numbers (invoice, work order, employee, loading order) and unique
business identifiers (truck number, trip transaction number, role name, …)
are per company. Usernames and email addresses are unique across all
companies, because they identify a sign-in.

Companies are created by an operator on the server:
`admin_app company:create --name … --admin-username … --admin-email …`.

## Lists: pagination, search, sort, filters

Every `List` rpc takes the same request and never returns an unbounded result.

| Field | Meaning | Default |
| --- | --- | --- |
| `page` | 1-based page number | 1 |
| `page_size` | rows per page, at most 100 | 20 |
| `search` | case-insensitive partial match across the list's searchable columns (including joined names, e.g. a trip's customer) | — |
| `sort_by` | one of the list's sortable fields | newest first |
| `sort_order` | `asc` or `desc` | `desc` |
| `filters` | map of filter name → value | — |

The response is `{ items: […], pagination: { page, page_size, total_items, total_pages } }`.

Searching, sorting, filtering and paging all happen in the database.
An unknown `sort_by` or filter name is rejected (`FLEET-SYS002`) rather than ignored.
Filter names and sortable fields are declared in each service's `list:` block
in `backend/services/*.service.ts`; common ones:

| Filter | On | Value |
| --- | --- | --- |
| `status` | most lists | exact status, e.g. `ACTIVE` |
| `customerId`, `truckId`, `driverId`, `supplierId`, `employeeId`, … | lists that have that reference | numeric id |
| `fromDate`, `toDate` | dated lists (trips, invoices, attendance, expenses, …) | `YYYY-MM-DD`, inclusive |
| `activeOn` | assignments | `YYYY-MM-DD` |

## Idempotency

Every `Create` rpc accepts `idempotency-key: <unique value>` (a UUID is ideal).

- The first request with a key runs normally.
- A repeat of the **same** request with the same key — a double click, a
  network retry, a replayed job — returns the first request's result and
  creates nothing.
- The same key with a **different** request body is rejected (`FLEET-SYS009`).
- A repeat that arrives while the first is still running is rejected
  (`FLEET-SYS010`); retry it a moment later.
- If the first attempt failed, the key is released and may be used again.

A key is scoped to the company and the rpc, and is remembered for 24 hours.
Without the header a create runs every time it is called. `MarkPaid` and
`SubmitToZatca` are safe to retry without a key: they only act on an
invoice that is still unpaid / unsigned.

## Rate limits

| Limit | Default | `RATE_LIMIT.type` |
| --- | --- | --- |
| Per IP address | 1200 requests / minute | `IP` |
| Per signed-in user | 600 requests / minute | `USER` |
| Per API key | 300 requests / minute | `API_KEY` |
| Failed sign-ins per username | 10 / 15 minutes, then blocked 30 minutes | `USER` (code `FLEET-AUTH006`) |

Over the limit, calls return:

```
STATUS            "ERROR"
ERROR_CODE        "RATE-429001"
ERROR_FILTER      "RATE_LIMIT_EXCEEDED"
ERROR_DESCRIPTION "Too many requests. Please try again in 45 seconds."
RATE_LIMIT        { type: "API_KEY", retry_after_seconds: 45, remaining_points: 0 }
```

Wait `retry_after_seconds` before retrying. The limits are configurable
(`RATE_LIMIT_*` in `backend/.env.example`). Counters are kept in the
backend's memory, so they reset when it restarts and assume a single
backend instance.

## Errors

`ERROR_FILTER` is one of six values and tells a client what to do;
`ERROR_CODE` identifies the exact condition. The full list of codes, with
the module, file and function that raises each one, is in
[`error_codes_data.md`](./error_codes_data.md) /
[`error_codes_data.json`](./error_codes_data.json).

| ERROR_FILTER | Meaning | Client action |
| --- | --- | --- |
| `USER_NOT_AUTHENTICATED` | No valid session or API key | Sign in again / check the key |
| `USER_NOT_AUTHORIZED` | Not allowed to do this | Do not retry |
| `INVALID_REQUEST` | The request is wrong: validation, duplicate, unknown record | Fix the input |
| `USER_END_VIOLATION` | A business rule forbids it | Show the message |
| `RATE_LIMIT_EXCEEDED` | Too many requests | Retry after `retry_after_seconds` |
| `TECHNICAL_ISSUE` | Server-side fault | Retry later; details are in the server log |

## Services

Each service's rpcs, request messages and result types are in its proto file.

| Service(s) | Proto | Permission module |
| --- | --- | --- |
| `auth.AuthService` | `auth.proto` | — (sign-in is public; the rest need a session) |
| `trucks.TrucksService` | `trucks.proto` | `trucks` |
| `drivers.DriversService` | `drivers.proto` | `drivers` |
| `assignments.AssignmentsService` | `assignments.proto` | `assignments` |
| `trips.TripsService` | `trips.proto` | `trips` |
| `locations.LocationsService` | `locations.proto` | `locations` |
| `cargotypes.CargoTypesService` | `cargo_types.proto` | `cargoTypes` |
| `ratecontracts.RateContractsService` | `rate_contracts.proto` | `rateContracts` |
| `loadingorders.LoadingOrdersService` | `loading_orders.proto` | `loadingOrders` |
| `customers.CustomersService` | `customers.proto` | `customers` |
| `suppliers.SuppliersService` | `suppliers.proto` | `suppliers` |
| `supplierpayments.SupplierPaymentsService` | `supplier_payments.proto` | `supplierPayments` |
| `invoices.InvoicesService` | `invoices.proto` | `invoices` |
| `workshop.*` (work orders, maintenance, inspections, spare parts, expenses, line items, stock movements) | `workshop.proto` | `workshop` |
| `hr.*` (departments, designations, employees, attendance, leave, documents, contracts) | `hr.proto` | `hr` |
| `dashboard.DashboardService` | `dashboard.proto` | `dashboard` (+ `hr` / `workshop` for those summaries) |
| `users.UsersService` | `users.proto` | `users` |
| `roles.RolesService` | `roles.proto` | `roles` |
| `companysettings.CompanySettingsService` | `company_settings.proto` | `settings` (`GetBranding` is public) |
| `apikeys.ApiKeysService` | `api_keys.proto` | `apiKeys` (signed-in users only) |

### Example: list trips with an API key (Node.js, native gRPC)

```js
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import protobuf from 'protobufjs';

const files = ['common.proto', 'trips.proto'];
const pkg = grpc.loadPackageDefinition(protoLoader.loadSync(files, { includeDirs: ['proto'], keepCase: true }));
const types = new protobuf.Root().loadSync(files.map((f) => `proto/${f}`), { keepCase: true });

const trips = new pkg.fleetflow.trips.TripsService('fleetflow.example.com:50051', grpc.credentials.createSsl());
const metadata = new grpc.Metadata();
metadata.set('x-api-key', process.env.FLEETFLOW_API_KEY);

trips.List({ page: 1, page_size: 50, search: 'riyadh', filters: { fromDate: '2026-10-01' } }, metadata, (transportError, response) => {
  if (transportError) throw transportError;                       // network / backend down
  if (response.STATUS !== 'SUCCESSFUL') {
    if (response.ERROR_FILTER === 'RATE_LIMIT_EXCEEDED') return retryAfter(response.RATE_LIMIT.retry_after_seconds);
    throw new Error(`${response.ERROR_CODE}: ${response.ERROR_DESCRIPTION}`);
  }
  const page = types.lookupType(response.DB_DATA_TYPE).decode(response.DB_DATA);
  console.log(page.pagination.total_items, page.items);
});
```
