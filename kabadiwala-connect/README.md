# Kabadiwala Connect

**Connecting Waste to Wealth, Empowering Every Collector.**

Full-stack platform for Maatram HackForge 2026–27, problem statement **MH26-28**
("Kabadiwala Connect: Bringing Informal Scrap Collectors into the Formal Recycling Chain", Track: Software,
Theme: Clean & Green Technology).

It connects households, informal collectors (Kabadiwalas), scrap dealers and recycling units. It provides
digital identity for collectors, photo-based scrap identification (with manual fallback), competing price offers,
pickup scheduling, transaction records, and traceability from pickup to recycling.

> **Verification status.** This codebase was written in an environment without network access, so packages
> could not be installed and the app was **not run**. The backend has been syntax-checked, the plain JavaScript
> modules have been syntax-checked with Node, and the end-to-end test is written but **not executed**.
> Running the steps below is the first thing to do. Expect small fixes.

---

## Quick start (local, no Firebase needed)

Requirements: Python 3.11+, Node 20+. PostgreSQL is optional (SQLite is used by default).

```bash
# 1. Backend
cd backend
python -m venv .venv && source .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                     # defaults work for local demo
uvicorn app.main:app --reload --port 8000
# API docs: http://localhost:8000/docs

# 2. Frontend (new terminal)
cd frontend
cp .env.example .env                                     # VITE_AUTH_MODE=dev
npm install
npm run dev                                              # http://localhost:5173
```

Open http://localhost:5173 and choose **Login → demo account**. The dev-mode account switcher in the top bar
lets you move between roles.

### Run the tests
```bash
cd backend && pytest -q
```
`tests/test_workflow.py` runs the whole demonstration workflow through the API and checks role-based access.

### PostgreSQL (optional)
```bash
export POSTGRES_PASSWORD='choose-a-strong-password'
docker compose up -d
# In backend/.env:
# DATABASE_URL=postgresql+psycopg2://kabadiwala:<password>@localhost:5432/kabadiwala
```

---

## Demo accounts (seeded when `SEED_DEMO=true`)

| Role | Email | Notes |
|---|---|---|
| Household | household@demo.kc | Creates pickup requests |
| Kabadiwala | collector@demo.kc | Service radius 10 km, Chennai sample location |
| Kabadiwala | collector2@demo.kc | Second collector for competing offers |
| Scrap dealer | dealer@demo.kc | Authorised |
| Recycling unit | recycler@demo.kc | Authorised |
| Administrator | admin@demo.kc | Full admin |

All seed records are **sample data**. Reference prices are labelled "SAMPLE – demonstration only, not market data".

## Demonstration workflow

1. Household logs in, uploads a photo, confirms or corrects the category, enters quantity and address, submits.
2. Collector logs in, sees the request (area and distance only), submits a price offer.
3. Household opens **View offers**, compares them against the reference price, accepts one.
4. Collector marks *arriving*, then *collected*, then enters confirmed quantity and final price.
5. A transaction and handover reference are created. Household is notified and can rate the collector.
6. Dealer buys the lot, dispatches it to an authorised recycling unit.
7. Recycling unit confirms receipt, starts processing, and confirms recycled quantity. Only then is recycling recorded.
8. Household and collector open the transaction page to see the full timeline.

---

## Authentication (Firebase)

1. In the Firebase console, create a project and enable **Email/Password** sign-in.
2. Create a web app and copy its config into `frontend/.env`:
   `VITE_AUTH_MODE=firebase`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`.
3. Create a service account (Project settings → Service accounts) and save its JSON **outside the repository**.
4. In `backend/.env`: `AUTH_MODE=firebase`, `FIREBASE_PROJECT_ID=<id>`, `FIREBASE_CREDENTIALS_PATH=/secure/path/key.json`.
5. Users must verify their email before any protected page loads. Password reset uses Firebase's built-in email.

Firebase web config values identify the project and are public by design. Service-account keys are secrets and
must never go in the frontend or the repository.

## Environment variables

Backend (`backend/.env`): `APP_ENV`, `DATABASE_URL`, `AUTH_MODE`, `FIREBASE_PROJECT_ID`, `FIREBASE_CREDENTIALS_PATH`,
`CORS_ORIGINS`, `UPLOAD_DIR`, `MAX_UPLOAD_MB`, `CLASSIFIER_MODEL_PATH`, `MATCH_RADIUS_KM`, `SEED_DEMO`.

Frontend (`frontend/.env`): `VITE_AUTH_MODE`, `VITE_FIREBASE_*`, `VITE_CONTACT_EMAIL`.

## AI scrap identification

`backend/app/ai.py` is the integration point. To enable it:
1. Train or obtain a Keras image classifier whose output order matches `CLASS_NAMES` in that file.
   Use a dataset you have rights to, with representative photos of e-waste and recyclables.
2. `pip install tensorflow numpy` (uncomment the lines in `requirements.txt`).
3. Set `CLASSIFIER_MODEL_PATH` to the model file.

Without a model, `/api/scrap/images/{id}/classify` returns `status: "unavailable"` and the user picks the category.
The app never displays an invented prediction.

## Voice assistant

Uses the browser Web Speech API. Chrome or Edge is recommended.
- Languages: English (en-IN), Tamil (ta-IN), Hindi (hi-IN). Languages are set per phrase in
  `VoiceAssistant.jsx` and `CollectorDashboard.jsx`.
- **Tamil and Hindi phrases and keyword lists are starting points. They must be checked by native speakers
  before any public use.** The rest of the interface is in English.
- Unsupported browsers and missing voices are reported to the user rather than failing silently.

---

## API overview

Interactive docs at `/docs`. All routes are under `/api`.

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `GET /auth/me` |
| Photos and AI | `POST /scrap/images`, `POST /scrap/images/{id}/classify`, `GET /scrap/images/{id}` |
| Requests | `POST /requests`, `GET /requests/mine`, `GET /requests/nearby`, `GET /requests/{id}`, `GET /requests/{id}/timeline`, `POST /requests/{id}/cancel`, `POST /requests/{id}/review` |
| Offers | `POST /requests/{id}/offers`, `GET /requests/{id}/offers`, `PATCH /offers/{id}`, `POST /offers/{id}/withdraw`, `POST /offers/{id}/accept`, `POST /offers/{id}/reject` |
| Pickups | `GET /pickups/assigned`, `GET /pickups/route`, `POST /requests/{id}/status`, `POST /requests/{id}/complete` |
| Transactions | `GET /transactions/mine`, `GET /transactions/{id}` (role-checked timeline) |
| Market | `GET /market/lots`, `POST /market/lots/{id}/purchase`, `POST /market/lots/{id}/dispatch`, `GET /market/recyclers`, `GET /market/recycler/lots`, `POST /market/lots/{id}/receive`, `POST /market/lots/{id}/process` |
| Prices | `GET /prices/current`, `GET /prices/history/{category}`, `POST /admin/prices` |
| Notifications | `GET /notifications`, `POST /notifications/{id}/read`, `POST /notifications/read-all` |
| Complaints | `POST /complaints`, `GET /complaints/mine`, admin list and resolve |
| Admin | `GET /admin/stats`, `GET /admin/users`, suspend, verify collector, authorise organisation, transactions, complaints, audit |
| Analytics | `GET /analytics/me`, `GET /analytics/export.csv` |
| Public | `GET /public/stats`, `GET /public/collectors/{code}` |

---

## Status against the master specification

**Built and wired end to end (needs running to confirm):**
- Landing page with navigation, hero, how-it-works, user categories, features, price table, live statistics,
  sustainability, sample testimonials, FAQ, footer.
- Registration with all required fields, role selection, optional location, email verification and password reset
  (Firebase mode), role-based redirects, protected routes, unique user IDs and collector IDs.
- Household dashboard: stats, photo upload with preview, AI suggestion or manual category, quantity, date, time,
  address, instructions, offers with accept or decline, cancellation, transaction history, rating after completion.
- Collector dashboard: digital ID with QR code and public verification page, nearby requests (no address before
  acceptance), offer submit, modify and withdraw, pickup status steps, completion with confirmed quantity and final
  price, earnings chart, route list with map, verification request.
- Dealer dashboard: available lots with filters, purchase, inventory, dispatch to an authorised recycler.
- Recycling unit dashboard: incoming material, inspection, processing, recycled quantity confirmed by the unit,
  history, monthly chart.
- Admin dashboard: platform stats, user search and filters, suspend or reinstate, collector verification,
  organisation authorisation, reference price management with history, flagged transactions, complaints, audit log, CSV export.
- Notifications with unread count, transaction timeline visible to authorised parties, audit logging.
- Security basics: token verification, role checks on every endpoint, input validation, image type, size and content
  checks, CORS, environment-based secrets, address privacy rules.

**Partially built:**
- Analytics date filters are not implemented. Charts show all records.
- Dealers submit purchase from fixed listings only. Dealer purchase offers to collectors are not built.
- Estimated price from quantity × reference price is not shown in the household form yet.
- Admin cannot yet browse all requests in the UI. The endpoint `GET /admin/requests` exists.
- Recycling unit view does not yet show the source dealer name.
- Map views: collector route only. Household, dealer and recycling unit maps are not built.
- Voice: readouts and category selection work, but phrase and keyword coverage for Tamil and Hindi needs native-speaker review.

**Not built:**
- Trained classification model (integration point only).
- Offline-first storage and sync (the brief's expected solution asks for it).
- Alembic migrations. Tables are created with `create_all` in development.
- Rate limiting, email and push delivery of notifications, and Docker images for the app itself.
- Frontend automated tests. The backend test covers the workflow.
- Official legal text. Privacy and Terms pages are marked as drafts.
- Per-collector "monthly" and "weekly" earnings breakdowns beyond the 7-day chart and latest-month figure.

## Known limitations

- Prices in the seed data are invented for demonstration and are not market data. Replace them with sourced
  prices before any real use, and record the source in each price entry.
- Collector verification is a manual admin decision. The app does not check identity documents.
- Straight-line distances are used for matching and routing. Road distances will differ.
- Photos are stored on local disk. Use object storage with access control in production.
