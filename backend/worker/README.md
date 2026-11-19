# ENG HUB API — Cloudflare Workers

This is the Cloudflare Workers runtime for the ENG HUB API. The frontend remains on GitHub Pages. The Worker verifies Firebase Authentication ID tokens, checks administrator records in Firestore, and uses Firebase service-account credentials stored as Worker secrets.

## Deploy through the Cloudflare Git integration

1. Create a Cloudflare account and open Workers & Pages.
2. Choose Create application → Worker → Connect to Git.
3. Connect GitHub and select abdalrahmansadoon/ENG-HUB.
4. Set the project root directory to backend/worker.
5. Build command: npm install && npm run typecheck.
6. Deploy command: npx wrangler deploy.
7. Add these runtime variables/secrets in the Worker settings:
   - Variable FIREBASE_PROJECT_ID: eng-hub-5c30a.
   - Variable CORS_ORIGINS: exact frontend origin, currently https://abdalrahmansadoon.github.io.
   - Secret FIREBASE_CLIENT_EMAIL: service-account client_email.
   - Secret FIREBASE_PRIVATE_KEY: full service-account private_key, including BEGIN/END lines.
8. Deploy. The endpoint will be https://eng-hub-api.<your-subdomain>.workers.dev/api/v1/health.

Never commit the service-account JSON or private key. Do not put these values in frontend environment variables.

## API routes

- GET /api/v1/health — public health check.
- GET /api/v1/me — requires Authorization: Bearer <Firebase ID token>.
- GET /api/v1/admin/overview — requires a verified Firebase user whose admins/{email} record is active and has role admin or super-admin.

## Local development

Run npm install, set the two Firebase secrets using Wrangler secrets or a local .dev.vars file, then run npm run dev.

## Important migration status

This Worker is the new backend runtime and currently exposes the initial health, identity, and admin overview endpoints. The existing frontend still performs several Firestore operations directly. Those flows must be migrated feature by feature and tested before Firestore client rules are tightened.
