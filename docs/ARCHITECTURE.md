# ENG HUB Architecture

## Target architecture

Browser / Mobile
  React + TypeScript + Vite (frontend on GitHub Pages)
          | Firebase ID token over HTTPS
          v
  ENG HUB API (Cloudflare Worker, deployed from this GitHub repository)
          | Firebase Auth token verification + Firestore REST API
          v
  Cloud Firestore

  Cloudinary: binary media storage
  Firebase Authentication: identity provider
  Firebase Cloud Messaging: browser push delivery

## Responsibilities

- Frontend: presentation, navigation, responsive UI, Firebase sign-in, and API calls. No service-account private key or privileged server logic.
- Backend Worker: token verification, server-side role checks, validation, privileged reads/writes, and future admin workflows.
- Firebase: authentication and Firestore data store.
- Cloudinary: media storage.

## Hosting and deployment

- Frontend remains on GitHub Pages.
- Backend runs on Cloudflare Workers using the backend/worker directory.
- Cloudflare Workers Builds connects to the same GitHub repository and deploys on pushes to the configured production branch.
- The Cloudflare Workers Free plan has usage limits. The Hobby Vercel and Render deployment scaffolds are not the selected deployment path.

## Backend endpoints currently implemented

- GET /api/v1/health
- GET /api/v1/me (Firebase ID token required)
- GET /api/v1/admin/overview (active admin record required)

## Migration sequence

1. Deploy the Worker and verify health/auth endpoints.
2. Add a typed frontend API client and move account/profile endpoints.
3. Move admin-only writes (subjects, lectures, exams, academic calendar, uploads/signatures) to Worker routes.
4. Move student task updates, exam attempts/grading, and notification dispatch.
5. Migrate remaining Firestore reads/subscriptions where appropriate; keep carefully scoped real-time listeners if needed.
6. Update Firestore rules only after each feature is fully migrated and tested. Never lock the client out before the replacement path is live.

## Current migration status

The Worker runtime and initial endpoints are in the repository. The frontend still uses direct Firestore operations in several areas. The site is not yet fully migrated to a backend-only data flow.
