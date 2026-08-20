# BOST Oil Depot Approval System — Setup & Functionality Guide

Permission and Authorisation Web Application for Oil Depots.
React (Vite + TypeScript) frontend, Django REST Framework backend, PostgreSQL + MongoDB.

---

## 1. What this system does

The application implements one workflow, in four stages, matching the project flowchart:

| # | Actor | Does | Order status after |
|---|-------|------|--------------------|
| 1 | **Customer company** | Places an order: product, quantity, car number, driver | `SUBMITTED` |
| 2 | **BOST depot manager** | Reviews stock, credit, documents → grants authorisation | `MANAGER_APPROVED` (permit ID issued) |
| | | …or rejects with a reason | `REJECTED` → customer amends & resubmits |
| 3 | **Customs** | Verifies permit & documents → signs off | `CUSTOMS_APPROVED` |
| | | …or raises a query | `ON_HOLD` → back to the manager |
| 4 | **Loading bay** | Authorises the lot for filling | `LOT_CLEARED` |
| | | Checks the car number against the order → match | `LOADING` |
| | | …mismatch → denies entry, flags discrepancy | `DENIED` → manager alerted |
| | | Records quantity loaded, issues waybill | `COMPLETED` |

Every transition is written to an append-only audit trail with the actor, timestamp,
IP address and correlation ID.

---

## 2. Prerequisites

- **Docker Desktop** (running)
- **Node.js 20+** and npm
- Ports free: `8000` (API), `5173` (frontend), `5432` (Postgres), `27017` (Mongo)

---

## 3. Backend setup

```bash
cd backend

# 1. Environment file
cp .env.example .env        # Windows: copy .env.example .env

# 2. Build and start Postgres, MongoDB and Django
docker compose up --build -d

# 3. Create the database schema
docker compose exec web python manage.py migrate

# 4. Load demo users and sample orders at every workflow stage
docker compose exec web python manage.py seed_demo
```

Verify the API is up:

- <http://localhost:8000/api/v1/docs/> — interactive Swagger UI
- <http://localhost:8000/admin/> — Django admin

If you want your own superuser:

```bash
docker compose exec web python manage.py createsuperuser
```

**Watching logs / stopping:**

```bash
docker compose logs -f web     # follow API logs
docker compose down            # stop
docker compose down -v         # stop and wipe the database
```

---

## 4. Frontend setup

```bash
cd frontend

cp .env.example .env           # Windows: copy .env.example .env
npm install
npm run dev
```

Open <http://localhost:5173>.

`frontend/.env` holds one setting:

```
VITE_API_BASE_URL=http://localhost:8000
```

If you change the API port, change it here **and** in `CORS_ALLOWED_ORIGINS` in
`backend/.env`, then restart both.

---

## 5. Demo accounts

All use the password **`Password123!`**

| Username | Role | Lands on |
|----------|------|----------|
| `customer` | Customer Company | `/client/orders` |
| `manager` | BOST Depot Manager | `/admin/orders` |
| `customs` | Customs Officer | `/signoff/dashboard` |
| `dock` | Loading Bay Operator | `/loadingdock/dashboard` |
| `admin` | Administrator (sees everything) | `/admin/dashboard` |

`seed_demo` also creates seven orders — one sitting at each stage — so every screen
has something to show before you place your first order.

---

## 6. Functionality checklist

Work through these in order. Use a separate browser window (or profile) per role if
you want to avoid logging in and out repeatedly.

### 6.1 Authentication & access control

| # | Step | Expected |
|---|------|----------|
| 1 | Sign in as `customer` | Redirected to Order History |
| 2 | Manually visit `/admin/orders` | Bounced back to `/client/orders` — customers cannot reach manager screens |
| 3 | Refresh the page while signed in | Still signed in (the JWT is restored from storage) |
| 4 | Sign in with a wrong password | "Invalid username or password" |
| 5 | Click Logout | Returned to `/login`; visiting a protected page redirects to login |

### 6.2 Stage 1 — Customer places an order

| # | Step | Expected |
|---|------|----------|
| 6 | As `customer`, go to **Create New Order** | Form loads with your contact details prefilled |
| 7 | Pick Diesel, 20000, Liters | "Estimated value" shows GHS 0.92/litre = GHS 18,400.00 |
| 8 | Leave the car number blank and submit | Blocked: "Car number is required" |
| 9 | Enter car number `GR-1234-25`, driver, date, location; submit | Toast confirms the reference; you land on Order History |
| 10 | Find the new order | Status **Submitted**, progress bar on step 1, no permit yet |

### 6.3 Stage 2 — Depot manager decision

| # | Step | Expected |
|---|------|----------|
| 11 | Sign in as `manager`, go to **Order Review** | Your new order appears with **Authorise** / **Reject** buttons |
| 12 | Confirm orders further along the pipeline show no buttons | Only orders awaiting *your* decision are actionable |
| 13 | Click **Reject** on any submitted order, leave the reason empty | Reject button stays disabled — a reason is mandatory |
| 14 | Enter a reason and reject | Status → **Rejected**; toast confirms the customer was notified |
| 15 | Sign back in as `customer`, open the rejected order | Rejection reason shown in red; an **Amend & resubmit** button appears |
| 16 | Back as `manager`, click **Authorise** on your other order | Status → **Permit issued**; toast shows a permit ID like `PERMIT-20260727-8-4DB6A8` |

### 6.4 Stage 3 — Customs sign-off and query

| # | Step | Expected |
|---|------|----------|
| 17 | Sign in as `customs` | "Awaiting Sign-off" card counts manager-approved orders |
| 18 | Click **Review** on an order | Permit ID, approving manager, vehicle and quantity all shown |
| 19 | Enter a query reason and click **Raise Query** | Status → **On hold**; it moves to "Queries you raised" |
| 20 | Sign in as `manager` | The on-hold order is actionable again — this is the "back to manager" loop |
| 21 | Click **Authorise** again | Status returns to **Permit issued**; the hold is cleared |
| 22 | As `customs`, click **Sign Off** | Status → **Customs cleared** |
| 23 | Try to sign off an order that has *not* been manager-approved | Not offered — and blocked by the API if forced |

### 6.5 Stage 4 — Loading bay

| # | Step | Expected |
|---|------|----------|
| 24 | Sign in as `dock` | Customs-cleared orders appear under "awaiting lot clearance" |
| 25 | Click **Authorise for filling** | Status → **Ready for loading**; order moves to "Vehicles at the gate" |
| 26 | Click **Check in vehicle** | Dialog shows the car number the order declares |
| 27 | Type a **wrong** plate | Red "Mismatch" warning; "Allow vehicle to load" stays disabled |
| 28 | Type the **correct** plate with different spacing/case (e.g. `gr 1234 25`) | Green "Match" — the check ignores case, spaces and hyphens |
| 29 | Click **Allow vehicle to load** | Status → **Loading** |
| 30 | On a different cleared order, enter a wrong plate + reason, click **Deny entry** | Status → **Entry denied**, discrepancy recorded for the manager |
| 31 | On the loading order, enter a quantity **larger** than approved | Rejected: cannot exceed the approved volume |
| 32 | Enter a valid quantity and complete | Status → **Completed**; toast confirms the waybill was issued |

### 6.6 Closing the loop

| # | Step | Expected |
|---|------|----------|
| 33 | Sign in as `customer`, open the completed order | **View Waybill** button appears |
| 34 | Open it | Waybill shows permit ID, waybill number, quantity actually loaded, vehicle and driver |
| 35 | As `manager`, open the Dashboard | Pipeline counts and exception counts reflect everything you just did |
| 36 | As `admin`, go to **User Management** | All users listed; you can create a new one with any role |

### 6.7 Audit trail

Every transition is recorded. Check it via Swagger or curl:

```bash
# Get a token
curl -s -X POST http://localhost:8000/api/v1/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"manager","password":"Password123!"}'

# Read the trail for order 8 (use the access token from above)
curl -s http://localhost:8000/api/v1/npa-requests/8/audit-trail/ \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

A fully completed order shows 8 entries: submitted → manager approved → (hold →
re-approved) → customs approved → lot cleared → loading → completed.

---

## 7. Automated tests

```bash
docker compose exec web python -m pytest
```

31 tests covering the state machine, role permissions, API endpoints and every
branch of the flowchart (car-number matching, customs hold, entry denial,
overfill protection, customer data isolation).

Frontend type check and production build:

```bash
cd frontend
npm run build
```

---

## 8. API reference

Base URL: `http://localhost:8000/api/v1`
All endpoints except `login` require `Authorization: Bearer <access_token>`.

### Auth

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/auth/login/` | Returns `{access, refresh, user}` |
| POST | `/auth/refresh/` | New access token from a refresh token |
| GET/PATCH | `/auth/me/` | Current user's profile |
| GET/POST | `/auth/users/` | List/create users (admin only) |
| GET | `/auth/roles/` | Assignable roles |

### Orders

| Method | Path | Who | Purpose |
|--------|------|-----|---------|
| GET | `/npa-requests/` | all | List (scoped by role) |
| POST | `/npa-requests/` | customer | Submit an order |
| GET | `/npa-requests/{id}/` | all | Order detail |
| GET | `/npa-requests/summary/` | all | Status counts |
| POST | `/npa-requests/{id}/approve_manager/` | manager | Grant authorisation, issue permit |
| POST | `/npa-requests/{id}/reject/` | manager | `{reason}` |
| POST | `/npa-requests/{id}/approve_customs/` | customs | Sign off |
| POST | `/npa-requests/{id}/hold/` | customs | `{reason}` — raise a query |
| POST | `/npa-requests/{id}/clear_lot/` | operator | Authorise filling |
| POST | `/npa-requests/{id}/start_loading/` | operator | `{observed_truck_number}` — gate check |
| POST | `/npa-requests/{id}/deny_entry/` | operator | `{reason, observed_truck_number}` |
| POST | `/npa-requests/{id}/complete_loading/` | operator | `{quantity_loaded}` — issues waybill |
| GET | `/npa-requests/{id}/audit-trail/` | all | Transition history |

Supporting resources: `/tankers/`, `/lots/`, `/delivery-notes/`, `/waybills/`,
`/dispatch-requests/`, `/attachments/`, `/audit/logs/`.

Each order response includes `available_actions` — the list of transitions the
**current user** may perform right now. The UI uses this to decide which buttons
to render, so the workflow rules live in exactly one place.

---

## 9. Troubleshooting

**"Cannot reach the API. Is the Django server running?"**
The backend is down or on a different port. Check `docker compose ps` and confirm
`VITE_API_BASE_URL` in `frontend/.env` matches.

**CORS errors in the browser console**
The frontend origin is not in `CORS_ALLOWED_ORIGINS`. Add it to `backend/.env`
and restart: `docker compose restart web`.

**Login works but every other request returns 401**
The access token expires after 60 minutes; the client refreshes automatically.
If it persists, clear site data and sign in again.

**"429 Too Many Requests" while testing**
Rate limiting. Raise `THROTTLE_ANON_BURST` / `THROTTLE_USER_BURST` in
`backend/.env` and restart the web container.

**Port already in use**
Change the host-side port in `backend/docker-compose.yml` (e.g. `"8001:8000"`)
and update `VITE_API_BASE_URL` to match.

**Audit trail is empty**
MongoDB is unreachable. The app falls back to in-memory logging (so nothing
breaks) but entries are lost on restart. Check `docker compose logs mongodb`.

**Migrations conflict after pulling changes**
```bash
docker compose down -v
docker compose up -d
docker compose exec web python manage.py migrate
docker compose exec web python manage.py seed_demo
```

---

## 10. Project structure

```
backend/
  apps/
    users/         User model with 5 roles, JWT auth, RBAC permissions
    dispatch/      Orders, tankers, lots, waybills + the workflow state machine
    attachments/   Variable-schema documents in MongoDB
    audit/         Append-only transition history
    core/          Mongo service, pagination, error envelope, correlation IDs
  tests/           31 tests
  manage.py
  docker-compose.yml

frontend/src/
  lib/api.ts            Typed API client: JWT, auto-refresh, error unwrapping
  lib/orderDisplay.ts   Shared status labels, colours and formatters
  context/              AuthContext (session) and OrderContext (orders + actions)
  types/index.ts        Types mirroring the API contract
  pages/
    Client/             Stage 1 — create order, history, account
    Admin/              Stage 2 — review queue, dashboard, user management
    SignOff/            Stage 3 — customs verification
    LoadingDock/        Stage 4 — gate check, loading, waybill
```
