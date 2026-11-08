# Architecture

## Components
- **Frontend**: React 18 + Vite + Tailwind CSS. React Router for routes, Recharts for charts,
  Leaflet/OpenStreetMap for maps, `qrcode.react` for the collector ID, browser Web Speech API for voice.
- **Backend**: FastAPI with Pydantic v2 schemas and SQLAlchemy 2.0 ORM. PostgreSQL in production,
  SQLite for quick local runs.
- **Auth**: Firebase Authentication (ID tokens verified by `firebase-admin`). A development mode
  (`AUTH_MODE=dev`) uses demo accounts via an `X-Dev-Email` header and is refused when `APP_ENV=production`.
- **AI**: `app/ai.py` is the integration point for a trained Keras model. Without a model it returns
  `status: "unavailable"`. Predictions are never fabricated.

## Workflow states
- Request: `open → scheduled → arriving → collected → completed`, or `open → cancelled`.
- Offer: `active → accepted | rejected | withdrawn`. Accepting one offer rejects the others.
- Material lot: `available → purchased → dispatched → received → processing → recycled`,
  or `dispatched → rejected` when inspection fails. `recycled` is set only by the recycling unit.

## Privacy rules (enforced in serializers and routes)
- Pickup address and precise coordinates are returned only to the household that owns the request and
  to the collector it is assigned to.
- Collectors before acceptance see the area (city and PIN), distance and category only.
- Public endpoints expose a collector's display first name, ID, city, verification status and counts. No contact details.
- Collector verification changes only through an administrator action, and every change is logged.

## Price checks
Offers and final prices are compared with the latest reference price. A value above 2.5× or below 0.3× the
reference is flagged for administrator review. Flagging does not block a transaction.

## Route planning
`GET /api/pickups/route` orders a collector's scheduled stops with a nearest-neighbour heuristic over
straight-line distance. It is labelled as basic routing, not AI optimisation.

## Data model (deviation from the brief)
The brief lists 19 tables. This build merges several: household, collector, dealer and recycler profiles
into `users` plus `collector_profiles` and `organizations`; pickup schedules and recycling records into
`scrap_requests` and `material_lots`; categories into code constants. `material_transfers` records each
purchase and dispatch.

## Migrations
Tables are created with `create_all` at startup for development. Adding Alembic revisions is a pending task
before any real deployment.
