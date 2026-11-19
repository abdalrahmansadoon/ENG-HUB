# ENG HUB Backend

Independent REST API for ENG HUB. The frontend remains a static React/Vite application; this service owns privileged server-side operations and verifies Firebase ID tokens on every protected request.

## Structure

- `src/config`: validated environment and Firebase Admin SDK.
- `src/middleware`: Firebase token verification and role authorization.
- `src/routes`: versioned HTTP endpoints.
- `/api/v1/health`: public health check.
- `/api/v1/me`: authenticated account summary.
- `/api/v1/admin/overview`: admin-only aggregate counts.

## Local development

1. Copy `.env.example` to `.env`.
2. Create a dedicated Firebase service account for the backend and set its email/private key in the environment. Never commit the JSON key or private key.
3. `npm install`
4. `npm run dev`

## Deploy on Render

Create a new Web Service from this repository and select `backend/render.yaml`, or configure root directory `backend`, build command `npm ci && npm run build`, and start command `npm start`. Set `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` as secret environment variables in Render. Do not put service-account credentials in GitHub variables, frontend environment variables, or source files.

Set `CORS_ORIGINS` to the exact deployed frontend origin(s). The current GitHub Pages origin is `https://abdalrahmansadoon.github.io`; update it if the site's published URL differs.

## Security

- Client requests must send the Firebase ID token as `Authorization: Bearer <token>`.
- Admin authorization is checked against the existing `admins/{email}` Firestore records on the server. Hiding a UI control is not authorization.
- Service-account credentials stay only in the hosting provider's secret environment.
- This is the first migration slice. Existing frontend Firestore subscriptions and writes are not switched to the API yet; migrate each domain to API endpoints in separate, tested steps before tightening Firestore rules.
