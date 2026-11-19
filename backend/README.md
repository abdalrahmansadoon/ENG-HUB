# ENG HUB Backend

Independent REST API for ENG HUB. The frontend remains a static React/Vite application; this service owns privileged server-side operations and verifies Firebase ID tokens on every protected request.

## Structure

- `src/config`: validated environment and Firebase Admin SDK.
- `src/middleware`: Firebase token verification and role authorization.
- `src/routes`: versioned HTTP endpoints.
- `src/app.ts`: reusable Express application (local server and serverless hosting).
- `src/server.ts`: local/standalone Node server entry point.
- `api/[...all].ts`: Vercel serverless function entry point.
- `/api/v1/health`: public health check.
- `/api/v1/me`: authenticated account summary.
- `/api/v1/admin/overview`: admin-only aggregate counts.

## Deploy without a payment card (Vercel Hobby)

1. Create a Vercel account and choose the Hobby plan. The Hobby plan is free; it is intended for personal, non-commercial use and is subject to usage limits.
2. Import this GitHub repository as a new Vercel project.
3. Set the project Root Directory to `backend`.
4. Framework Preset: Other. Build Command: `npm install && npm run build`. Output Directory: leave unset. Install Command: `npm install` (or leave the default).
5. Add the environment variables listed in `.env.example` in Vercel Project Settings → Environment Variables. Add the Firebase service account private key only as a sensitive environment variable; never commit it.
6. Deploy. The API health endpoint will be `https://YOUR-VERCEL-DOMAIN/api/v1/health`.

Set `CORS_ORIGINS` to the exact deployed frontend origin(s). The current GitHub Pages origin is `https://abdalrahmansadoon.github.io`; update it if the site's published URL differs.

## Local development

1. Copy `.env.example` to `.env`.
2. Create a dedicated Firebase service account for the backend and set its email/private key in the environment. Never commit the JSON key or private key.
3. `npm install`
4. `npm run dev`

## Security

- Client requests must send the Firebase ID token as `Authorization: Bearer <token>`.
- Admin authorization is checked against the existing `admins/{email}` Firestore records on the server. Hiding a UI control is not authorization.
- Service-account credentials stay only in the hosting provider's secret environment.
- This is the first migration slice. Existing frontend Firestore subscriptions and writes are not switched to the API yet; migrate each domain to API endpoints in separate, tested steps before tightening Firestore rules.
