# Frontend

React + Vite + Tailwind. See the root README for setup. Key folders:
- `src/pages`: public pages (landing, login, register, reset, public collector ID, transaction and request tracking, analytics)
- `src/dashboards`: one dashboard per role
- `src/components`: layouts, route guard, photo upload, voice assistant, map, timeline, shared UI
- `src/lib`: API client (`api.js`), Firebase wrapper, constants
- `src/context`: authentication state (Firebase or dev mode)

Build check: `npm run build`. Lint and unit tests are not configured yet.
