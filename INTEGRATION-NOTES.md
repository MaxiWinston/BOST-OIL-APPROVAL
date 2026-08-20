# Integration Notes

What was missing when the frontend and backend were handed over, and what changed
to connect them. Written for the developers who own each half.

---

## 1. What was broken on arrival

### The backend could not start

Every `urls.py` imported from a `views.py` that did not exist:

| App | `urls.py` imported | Existed? |
|-----|--------------------|----------|
| `dispatch` | 6 viewsets | No `views.py`, no `serializers.py` |
| `users` | 3 auth views | No `views.py`, no `serializers.py` |
| `audit` | `AuditTrailQueryView` | No `views.py`, no `serializers.py` |
| `attachments` | `AttachmentViewSet` | No `views.py` (serializer existed) |

There was also no `manage.py`, so `docker-compose up` failed immediately with an
`ImportError` before Django finished loading.

What *did* exist and was reusable: the domain models, the workflow state machine,
settings, the Mongo audit service, RBAC permission classes, pagination, the error
envelope, correlation-ID middleware, and 12 tests.

### The frontend had no API layer

No `fetch`, no `axios`, no environment variables. `AuthContext` compared plaintext
passwords against a hardcoded array; `OrderContext` held orders in `useState`.
Refreshing the page lost everything.

### The two halves modelled different businesses

| | Frontend | Backend |
|---|----------|---------|
| Roles | `client`, `admin`, `signoff`, `loadingdock` | `MANAGER`, `CUSTOMS_OFFICER`, `DEPOT_OPERATOR`, `ADMIN` |
| Order | `oilType`, `quantity`, `pricing`, `driverInfo.carNumber` | `product_type`, `volume_requested`, `depot_id` |
| Statuses | 5 (`pending` … `completed`) | 5 (`SUBMITTED` … `LOT_CLEARED`) |

There was **no customer role on the backend at all**, even though the flowchart's
first actor is the Customer Company. Car number lived on `Tanker`, which had no
relationship to `NPARequest` — so the loading bay's "car number matches?" decision
had no data path. And the backend had no `ON_HOLD`, `LOADING` or `COMPLETED`
states, so three flowchart branches were unrepresentable.

### Two latent bugs

1. **`MongoDBService._in_memory_fallback` was a class attribute on a singleton.**
   Shared by every instance and never cleared. It leaked audit events between
   tests (one existing test asserted `== 3` and would have got `6`), and in
   production with MongoDB down it grew without bound. Now per-instance with a
   `reset_fallback()` method and an autouse test fixture.

2. **`tsconfig.app.json` set `baseUrl`,** which TypeScript 6 (pinned in
   `package.json`) rejects as a hard error. `npm run build` could not succeed.
   Removed — `paths` resolves relative to the config file anyway.

---

## 2. Decisions taken

**The flowchart is the source of truth.** The backend was extended to match it
rather than reshaping the frontend around the NPA/Lot/Waybill vocabulary. Existing
models, migrations and tests were preserved — nothing was renamed or deleted.

**Role mapping** — a `CUSTOMER` role was added; the frontend now uses the backend's
role strings directly rather than translating between two vocabularies:

| Flowchart actor | Role |
|-----------------|------|
| Customer company | `CUSTOMER` *(new)* |
| BOST depot manager | `MANAGER` |
| Customs | `CUSTOMS_OFFICER` |
| Loading bay | `DEPOT_OPERATOR` |
| — | `ADMIN` (sees everything) |

**Status model** — the original three-stage chain was kept intact and extended, so
the pre-existing tests still pass unchanged:

```
SUBMITTED → MANAGER_APPROVED → CUSTOMS_APPROVED → LOT_CLEARED → LOADING → COMPLETED
              ↓ REJECTED          ↓ ON_HOLD                       ↓ DENIED
         (customer amends)   (back to manager)              (manager alerted)
```

---

## 3. What changed

### Backend

**New files**
- `manage.py`
- `apps/{users,dispatch,audit,attachments}/views.py`
- `apps/{users,dispatch,audit}/serializers.py`
- `apps/core/management/commands/seed_demo.py`
- `tests/conftest.py`, `tests/test_flowchart_workflow.py` (19 new tests)
- `apps/{users,dispatch}/migrations/0002_*.py`

**Models** — added `CUSTOMER` role, `company_name`/`location` on users. On
`NPARequest`: order details (customer, delivery, contact), `truck_number` /
`driver_name` / `tanker` FK, `permit_id`, pricing, hold fields, gate-check fields
(`verified_truck_number`, `quantity_loaded`, `completed_at`), denial fields, and a
`car_number_matches` property that normalises plates before comparing.

**State machine** — added `hold_request`, `start_loading` (gate check),
`deny_entry`, `complete_loading` (issues delivery note + waybill). `approve_manager`
now issues the permit ID and accepts `ON_HOLD` as an input state so the customs
query can loop back. `reject_request` gained role and terminal-state guards.

**Settings** — added `CORS_ALLOWED_ORIGINS` (there was none; the browser would
have blocked every request) and `rest_framework_simplejwt.token_blacklist` to
`INSTALLED_APPS`, which `BLACKLIST_AFTER_ROTATION = True` requires.

### Frontend

**New files** — `lib/api.ts` (typed client with JWT storage, single-flight token
refresh, error-envelope unwrapping), `lib/orderDisplay.ts` (shared labels, colours,
formatters), `.env` / `.env.example`.

**Deleted** — `utils/mockData.ts`.

**Rewritten** — `types/index.ts` (mirrors the API contract), `AuthContext` (real
JWT login, session restore on refresh), `OrderContext` (API-backed with loading and
error state), all seven pages, `ProtectedRoute`, `App.tsx`, `login-form`,
`Invoice`, `OutlineTable`, `SalesChart`.

---

## 4. Design notes worth knowing

**`available_actions` is computed server-side.** Every order response includes the
list of transitions the *current user* may perform right now. The UI renders
buttons from it rather than reimplementing the workflow rules in TypeScript — so
the rules live in exactly one place and cannot drift.

**Permission checks are enforced twice, deliberately.** DRF permission classes
return `403` for the wrong role; the state machine independently raises on invalid
transitions, returning `400`. The API is safe even if called directly.

**Plate comparison is normalised.** `GR-4521-24`, `gr 4521 24` and `GR452124` all
match. Plates get typed inconsistently at a gate, and a false mismatch stops a
legitimate truck.

**Data is scoped by role in the queryset**, not filtered in the UI. Customers can
only ever retrieve their own orders; other roles are scoped to their depot.

---

## 5. Verification performed

- **31 backend tests pass** (12 pre-existing, unmodified, + 19 new)
- **Frontend type check and production build pass**
- **Live end-to-end run** against a running server exercising every branch:
  login for all roles → order submission and pricing → 403 for wrong role →
  manager approval and permit issuance → customs query → return to manager →
  re-approval → sign-off → lot clearance → wrong plate refused (and order does not
  advance) → correct plate with messy formatting accepted → overfill refused →
  completion and waybill → 8 audit entries → customer data isolation → CORS
  preflight from `localhost:5173`

One bug was found by the live run that the unit tests missed: `depot_id` was
required by the create serializer, but the order form does not send it. Fixed, with
a regression test added.

---

## 6. Known gaps

These were out of scope but are worth queueing:

- **Notifications are status-only.** The flowchart says "notify customer" and
  "alert manager"; the status change and reason are recorded, but no email or SMS
  is sent. Add a notification service hooked to `_log_transition`.
- **Attachments store metadata, not files.** `/attachments/` records filenames and
  metadata in MongoDB. Actual file upload needs GridFS or object storage.
- **Stock and credit are not checked automatically.** The manager reviews them by
  eye; there is no inventory or credit-limit integration.
- **Pricing rates are hardcoded** in `apps/dispatch/serializers.py` and mirrored in
  `CreateOrder.tsx` for the live preview. Move to a database table if rates change
  often. The backend value is authoritative — the frontend figure is preview only.
- **`SECRET_KEY` is the committed dev key** and `backend/.env` is in the repo.
  Rotate the key and remove `.env` from version control before production.
- **The frontend bundle is ~920 KB.** Route-level code splitting would help.
