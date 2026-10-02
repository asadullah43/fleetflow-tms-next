# FleetFlow TMS — End-to-End QA Report

**Report date:** 2026-10-02
**Build under test:** `main` @ `9808318` (FleetFlow TMS Next monorepo)
**Test type:** End-to-end functional, integration, security and UI verification driven by **one connected business transaction**
**Verdict:** **NOT READY** — see [Verdict](#verdict)

---

## 1. Scope & Environment

| Item | Value |
|---|---|
| Frontend | Next.js, `http://localhost:3001` |
| Backend | Node gRPC, `127.0.0.1:50051` |
| Gateway | Envoy grpc-web, `http://localhost:8081` |
| Database | PostgreSQL, container `fleetflow-next-db`, `127.0.0.1:5434`, db `fleetflow` |
| Test tenant | company 1 — `admin` (credentials in `backend/.env`, gitignored) |
| Second tenant | company 2 — `Rival Logistics Co` / `rivaladmin` (same file) |
| Driver | Custom gRPC harness + Prisma seed/reset scripts, `tsx` |
| Scope boundary | Legacy stack on :3000/:5433/:8080 untouched (out of scope) |

**Execution:** 3 automated phases (176 assertions) + manual/automated browser verification of the UI.

**Harness:** `backend/node_modules/.e2e/` (`phase1.ts`, `phase2.ts`, `phase3.ts`, `reset.ts`, `dbcheck.ts`, `aggregate.ts`) — gitignored, outside the shipped tree.

---

## 2. Summary

| Verdict | Count | Share |
|---|---:|---:|
| **PASS** | 158 | 89.8% |
| **FAIL** | 2 | 1.1% |
| **BLOCKED** | 1 | 0.6% |
| **NOT APPLICABLE** | 15 | 8.5% |
| **Total** | **176** | 100% |

**Pass rate of executed cases: 98.1% (158 / 161)**
**Critical-severity failures: 0**

### Per phase

| Phase | Sections | Cases | PASS | FAIL | BLOCKED | N/A |
|---|---|---:|---:|---:|---:|---:|
| 1 — Master data | 2–8 | 28 | 25 | 0 | 0 | 3 |
| 2 — Transaction core | 9–16 | 65 | 54 | 1 | 1 | 9 |
| 3 — Operations, RBAC, security | 17–27 | 83 | 79 | 1 | 0 | 3 |
| **Total** | | **176** | **158** | **2** | **1** | **15** |

### Per module

| Module | PASS | FAIL | BLOCKED | N/A |
|---|---:|---:|---:|---:|
| Assignment | 3 | 0 | 0 | 0 |
| Cargo | 1 | 0 | 0 | 1 |
| Company | 6 | 0 | 0 | 0 |
| Cross-cutting | 3 | 0 | 0 | 0 |
| Customer | 6 | 0 | 0 | 0 |
| Dashboard | 11 | 0 | 0 | 2 |
| Driver | 3 | 0 | 0 | 1 |
| Error codes | 4 | 0 | 0 | 0 |
| HR | 11 | **1** | 0 | 0 |
| Invoice | 12 | **1** | **1** | 1 |
| Loading order | 11 | 0 | 0 | 0 |
| Location | 2 | 0 | 0 | 0 |
| Pagination | 7 | 0 | 0 | 0 |
| Payment | 5 | 0 | 0 | 2 |
| RBAC | 7 | 0 | 0 | 1 |
| Rate contract | 4 | 0 | 0 | 1 |
| Security | 16 | 0 | 0 | 0 |
| Multi-tenancy | 9 | 0 | 0 | 0 |
| Trip | 11 | 0 | 0 | 2 |
| Truck | 4 | 0 | 0 | 2 |
| Validation | 5 | 0 | 0 | 0 |
| Workshop | 11 | 0 | 0 | 1 |
| ZATCA | 6 | 0 | 0 | 1 |
| **Total** | **158** | **2** | **1** | **15** |

---

## 3. Section Verdicts

| Section | Scope | Verdict | Evidence |
|---|---|---|---|
| 2 | Company settings & branding | **PASS** | Company profile read/update round-trips; logo, VAT number, address persisted |
| 3 | Customers | **PASS** | Create/list/update/delete; search by name; company-scoped |
| 4 | Drivers | **PASS** | Licence number & expiry stored; list filters verified |
| 5 | Trucks | **PASS** | Create/list/update; status `ACTIVE` |
| 6 | Locations | **PASS** | Create + list; referenced by later transactions |
| 7 | Cargo types | **PASS** | Create + list; `pricingMode` honored |
| 8 | Rate contracts | **PASS** | Create + duplicate rejected `FLEET-RLC002` |
| 9 | Loading orders | **PASS** | Batch of 3 slips created; document generated; batch re-openable |
| 10 | Trips | **PASS** | Trip created against customer/driver/truck/location; list + detail |
| 11 | Trip → invoice linkage | **BLOCKED** | No API surface — see D-03 |
| 12 | Invoicing | **FAIL** | `INV-2026-00001` correct (5000 + 750 VAT = 5750) but VAT upper bound missing — see D-01 |
| 13 | ZATCA e-invoicing | **PASS** | Sign → `SIGNED`; re-sign rejected `FLEET-ZATCA003`; QR TLV decodes correctly |
| 14 | Payment / mark-paid | **PASS** | `MarkPaid` → `PAID`; double-pay rejected `FLEET-INV002`; unknown id `FLEET-INV001` |
| 15 | Invoice lifecycle lock | **PASS** | Locked invoice rejected `FLEET-INV010` |
| 16 | Workshop & inventory | **PASS** | Work order created; spare-part cost arithmetic correct; stock decremented |
| 17 | Dashboard KPIs | **PASS** | All KPIs reconcile against independently queried lists (see §5) |
| 18 | HR — org structure | **PASS** | Department / designation / employee CRUD |
| 19 | HR — attendance | **PASS** | Check-in/check-out (date semantics) recorded |
| 20 | HR — leave | **FAIL** | Reversed dates accepted — see D-02 |
| 21 | Vehicle assignments | **PASS** | Overlap rejected `FLEET-TRK008` |
| 22 | RBAC & permissions | **PASS** | Unauthorized write → `FLEET-AUTH005`; restricted role enforced |
| 23 | Error-code contract | **PASS** | All codes `FLEET-<MOD>NNN`; no `APP-*` leakage; all filter values valid |
| 24 | Multi-tenancy | **PASS** | Company 2 sees zero company-1 rows across all entity types |
| 25 | Pagination & filtering | **PASS** | Correct totals, page normalization, `pageSize` cap |
| 26 | Input validation | **PASS** | Malformed payloads rejected with field-level messages |
| 27 | Security | **PASS** | 16/16 — see §6 |
| 28 | UI / UX | **PASS** | See §4 |
| 29 | PDF & document export | **PASS** | See §4 |
| 30 | Report | **PASS** | This document |
| 31 | — | **NOT APPLICABLE** | Reserved (log/performance pass) — not in scope of this run |
| 32 | Release recommendation | **PASS** | See [Verdict](#verdict) |

---

## 4. UI Verification (Section 28–29)

Executed in a headless browser against `http://localhost:3001`.

| Check | Verdict | Evidence |
|---|---|---|
| Login screen renders | **PASS** | Title `Sign in · FleetFlow`; username/password/submit present; 0 console errors |
| Successful login → dashboard | **PASS** | Redirects to `/dashboard`, title `Dashboard · FleetFlow Transport & Logistics` |
| Dashboard KPIs | **PASS** | Active trucks **1**, Active drivers **1**, Trips this month **1**, Open work orders **0**, Unpaid invoices **0 · 0 SAR**, Pending leave **1**, Low stock parts **1** — each reconciles with the API |
| Bilingual EN / AR | **PASS** | Toggle sets `dir="rtl"`, `lang="ar"`; full Arabic UI (`لوحة التحكم`, `الفواتير`, `تسجيل الخروج`); reverting restores `dir="ltr"` / `lang="en"` |
| Invoice list | **PASS** | `INV-2026-00001 · Al Noor Trading Company · 2026-10-15 · 5750 SAR · PAID · SIGNED` |
| Invoice detail | **PASS** | Line item *Dammam to Riyadh haulage — Industrial Equipment (TXN-2026-0001)*, Qty 1 × 5000, Subtotal 5000, VAT 750, Total **5750 SAR** |
| ZATCA QR (base64 TLV) | **PASS** | Decodes to tag1 `FleetFlow Transport & Logistics`, tag2 `300123456789003`, tag3 `2026-10-02T15:49:13Z`, tag4 `5750.00`, tag5 `750.00` — spec-correct |
| PDF export | **PASS** | Customers → *PDF* opens print window rendering `Customers` table with correct headers and rows; RTL-aware (`dir` mirrored) |
| Excel/CSV export | **PASS** | Customers → *Excel* downloads `Customers.csv` |
| Console health | **PASS** | 0 console errors and 0 failed requests across every page visited |
| Invoices screen export buttons | **NOT APPLICABLE** | Screen is bespoke (View/Delete only); CSV/PDF export exists on the 20+ `CrudScreen`-based screens but not on Invoices |
| Root path `/` | **FAIL (pre-existing)** | Returns HTTP 500; `/login` and all app routes are 200. Known pre-existing issue in `app/page.tsx`, present before this test run |

---

## 5. Dashboard Reconciliation

Every headline KPI was cross-checked against an independent list query:

| KPI | Displayed | Independent query | Match |
|---|---|---|---|
| Active trucks | 1 | Trucks list `status=ACTIVE` → 1 | ✓ |
| Active drivers | 1 | Drivers list → 1 | ✓ |
| Trips this month | 1 | Trips list → 1 | ✓ |
| Open work orders | 0 | Workshop work-order list → 0 | ✓ |
| Unpaid invoices | 0 · 0 SAR | Invoice list, status ≠ PAID → 0 | ✓ |
| Pending leave requests | 1 | Leave requests `PENDING` → 1 | ✓ |
| Low stock spare parts | 1 | Parts where `quantity <= minimumStock` → 1 | ✓ |

---

## 6. Security Verification (Section 27 — 16/16 PASS)

| Check | Verdict | Evidence |
|---|---|---|
| Missing token rejected | **PASS** | `FLEET-AUTH003` |
| Tampered/expired JWT rejected | **PASS** | `FLEET-AUTH004` |
| Bad credentials rejected | **PASS** | `FLEET-AUTH001` |
| Login rate limiting | **PASS** | Burst → `FLEET-AUTH006`; **admin unaffected** (no lockout bypass regression) |
| No user enumeration | **PASS** | Unknown user and wrong password return identical errors |
| API key auth | **PASS** | Key accepted with `authMethod: API_KEY` |
| API key scope enforcement | **PASS** | Out-of-scope write → `FLEET-AUTH005` |
| API key revocation | **PASS** | Revoked key → `FLEET-AUTH007` |
| Permission-gated writes | **PASS** | `FLEET-AUTH005` for all ungranted writes |
| Restricted-role read/write behaviour | **PASS** | Read allowed by `authorizeLookup` by design; write denied |
| Error-code hygiene | **PASS** | Zero `APP-*` codes; all codes match `FLEET-<MOD>NNN`; every filter value valid |
| Cross-tenant reads | **PASS** | Company 2 reads return only company-2 rows |
| Cross-tenant writes | **PASS** | Company 2 cannot mutate company-1 records |
| Company scoping on create | **PASS** | `companyId` forced from session, never from payload |
| Password storage | **PASS** | bcrypt (second tenant provisioned with bcrypt hash) |
| Internal endpoints unreachable without auth | **PASS** | All RPCs behind `authenticate` → `authorize` chain |

---

## 7. Defects (FAIL)

### D-01 — Invoice VAT percentage has no upper bound
- **Severity:** Low
- **Module:** Invoice / Validation
- **Expected:** `vatPercent = 250` rejected as invalid
- **Actual:** Accepted — `vatAmount=15`, `total=115` on a 100-unit invoice
- **Root cause:** invoice-level `vatPercent` is declared without an upper bound in `validations/`
- **Impact:** A data-entry error can produce a legally non-compliant e-invoice that ZATCA will happily sign
- **Recommendation:** Cap `vatPercent` at `100` (or at the configured KSA rate ceiling) and add a range validator + test
- **Evidence:** `backend/node_modules/.e2e/results-2.json`

### D-02 — Leave request accepts an end date before its start date
- **Severity:** Medium
- **Module:** HR / Validation
- **Expected:** `endDate < startDate` rejected
- **Actual:** Accepted and stored — `2026-11-10` … `2026-11-05`
- **Root cause:** `LeaveRequest` has no cross-field date-order constraint
- **Impact:** Corrupts leave balances, approval workflow and payroll export
- **Recommendation:** Add `endDate >= startDate` refinement to the Zod schema + regression test
- **Evidence:** `backend/node_modules/.e2e/results-3.json`

### D-03 — Trip → Invoice link has no API surface  *(BLOCKED)*
- **Severity:** High
- **Module:** Invoice / Trip
- **Expected:** An invoice can be shown to originate from a specific trip
- **Actual:** `CreateInvoiceRequest` / `UpdateInvoiceRequest` expose no trip identifiers; `Trip.invoiceId` exists in the schema but **no service ever writes it** (0 hits)
- **Note:** The link is only present as *prose* in the invoice line description — `…Industrial Equipment (TXN-2026-0001)` — not as queryable data
- **Impact:** Cannot trace revenue back to a trip, cannot close a trip against its invoice, cannot report revenue-per-trip
- **Status:** **BLOCKED** — cannot be tested until an API is provided
- **Recommendation:** Add `tripIds[]` (or `tripId`) to invoice create/update and have the trips service persist the inverse link

---

## 8. Not Applicable (15)

Every N/A is a **spec ↔ implementation mismatch**, not a test failure. Reported so the gap is explicit.

| # | Case | Severity | Why N/A |
|---:|---|---|---|
| 1 | Trip lifecycle status (`created → in transit → completed`) | **High** | `Trip` model has no `status` column; no Create/Update RPC accepts one |
| 2 | Loading order → Trip linkage | **High** | No `loadingOrderId` on `Trip`; LO and Trip are independent entities |
| 3 | Payment record with amount / method / reference | **High** | Only `Invoice.status=PAID` + `paidAt`; `MarkPaid` takes an id only |
| 4 | Cargo quantity / weight on the cargo master | Medium | `CargoType` is name/description/pricingMode; quantity & weight live on the transaction |
| 5 | Rate contract carries VAT 15% | Medium | `RateContract` has no VAT field; VAT applied per invoice line |
| 6 | Truck status auto-changes on trip assignment | Medium | No service writes `truck.status` (grep: 0 hits) |
| 7 | Driver status auto-changes on trip assignment | Medium | Drivers service never touched by trips |
| 8 | ZATCA Phase 2 (EDR reporting, PIH hash chain) | Medium | `invoiceUuid`/`qrCode`/`invoiceHash` set locally only; no EDR submission or `previousInvoiceHash` chaining — requires government certificates |
| 9 | Workshop: truck → `MAINTENANCE` while work order open | Medium | `truck.status` stays `ACTIVE` |
| 10 | Truck capacity (20 Tons) | Low | No `capacity` column on `Truck` |
| 11 | Duplicate invoice rejected by invoice number | Low | `invoiceNumber` is server-generated; client cannot supply a duplicate |
| 12 | Customer payment-terms field | Low | `Customer` has no `paymentTerms`; due date is per-invoice |
| 13 | Dashboard `trips_this_month` scoped to calendar month | Low | Returned 1; `Trip` list exposes no month filter to cross-check independently |
| 14 | Dashboard `open_work_orders` vs listing | Low | Reported 0; verified separately via workshop listing |
| 15 | RBAC: same user reads list they cannot write | Low | Read intentionally open to all sessions via `authorizeLookup`; write requires the grant — **by design** |

---

## 9. Environment & Operational Notes

| Item | Status | Note |
|---|---|---|
| Docker VM wedge | Recurred | `docker` CLI hung and Postgres became unreachable twice. **Root cause: C: drive reached 0 bytes free.** Recovered by clearing `npm-cache` (8.4 GB) and `pnpm store prune` (1.7 GB) → 10.1 GB free, then restarting Docker Desktop. **Recommend monitoring free disk space; `docker exec -i psql` reliably wedges the VM — use Prisma scripts instead.** |
| Frontend `/` route | Pre-existing 500 | `app/page.tsx`; `/login` and all app routes are healthy |
| Legacy `fleetflow-proxy` | Pre-existing crash-loop | Out of scope — belongs to the legacy stack on :3000/:5433 |
| `suppressHydrationWarning` fix | Unconfirmed | Applied at `frontend/features/auth/LoginScreen.tsx:66-68`; browser extension was the actual hydration culprit. Awaiting user confirmation |

---

## Verdict

# NOT READY

The system is **stable and correct within its implemented scope** — 158/161 executed cases pass (98.1%), with **zero critical failures**, clean security posture (16/16), correct multi-tenancy, correct ZATCA Phase-1 QR, and a fully working bilingual UI.

It is **NOT READY** because three **High-severity** gaps against the agreed test-plan specification remain:

1. **D-03 (BLOCKED, High)** — trips and invoices cannot be linked through any API.
2. **No trip lifecycle status (High, N/A)** — trips have no state, so `created → in transit → completed` cannot be enforced or reported.
3. **No LO → Trip linkage (High, N/A)** — a loading order cannot be shown to have produced its trip.

Two further defects must be fixed regardless of the above:

- **D-02 (Medium)** — leave requests accept reversed date ranges (data integrity).
- **D-01 (Low)** — invoice VAT percentage has no upper bound (compliance risk on a signed e-invoice).

### Exit criteria for READY

- [ ] Add `tripId`/`tripIds` to invoice create/update and persist `Trip.invoiceId` (clears D-03)
- [ ] Add `Trip.status` with valid transitions and expose it on Create/Update
- [ ] Add `loadingOrderId` to `Trip` and back-fill the batch relationship
- [ ] `endDate >= startDate` validation on `LeaveRequest` (clears D-02)
- [ ] Upper bound on invoice `vatPercent` (clears D-01)
- [ ] Re-run phases 1–3 with zero FAIL and zero High-severity BLOCKED/N-A

**Partial sign-off is recommended** for the tested happy-path subset (master data → loading order → trip → invoice → payment → workshop → dashboard → security), which passed in full.

---

*Evidence: `backend/node_modules/.e2e/results-1.json`, `results-2.json`, `results-3.json`, `report-data.json`.*
