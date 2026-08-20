# BOST Manifest Backend

Permission and authorisation REST API for oil depot loading.

**Architecture:** Django REST Framework, PostgreSQL, MongoDB, Docker

## Features

- **Four-stage approval pipeline** matching the project flowchart:
  1. Customer submits an order (product, quantity, car number, driver)
  2. Depot manager grants authorisation — issues a permit ID — or rejects
  3. Customs signs off, or raises a query that returns the order to the manager
  4. Loading bay clears the lot, verifies the car number, loads, issues the waybill
- **Hybrid data architecture**
  - PostgreSQL for transactional relational data
  - MongoDB for variable-schema attachments and the append-only audit trail
    (falls back to in-memory logging if MongoDB is unavailable)
- **Security & RBAC** — JWT authentication with roles `CUSTOMER`, `MANAGER`,
  `CUSTOMS_OFFICER`, `DEPOT_OPERATOR`, `ADMIN`. Enforced at the API layer
  (403 for the wrong role) and again in the state machine (400 for an invalid
  transition).
- **OpenAPI / Swagger** via `drf-spectacular`

## Quick start

```bash
cp .env.example .env

docker compose up --build -d
docker compose exec web python manage.py migrate
docker compose exec web python manage.py seed_demo
```

- API docs: <http://localhost:8000/api/v1/docs/>
- Django admin: <http://localhost:8000/admin/>

`seed_demo` creates one account per role (password `Password123!`) plus sample
orders at every workflow stage.

## Tests

```bash
docker compose exec web python -m pytest
```

## Workflow states

```
SUBMITTED → MANAGER_APPROVED → CUSTOMS_APPROVED → LOT_CLEARED → LOADING → COMPLETED
              ↓ REJECTED          ↓ ON_HOLD                       ↓ DENIED
```

Transitions live in `apps/dispatch/state_machine.py`. Views never mutate status
directly — they call the state machine, which validates the role and the current
state, then writes an audit entry.

## Further reading

- `../SETUP-AND-TESTING.md` — full setup and a step-by-step functionality checklist
- `../INTEGRATION-NOTES.md` — what changed during frontend/backend integration
