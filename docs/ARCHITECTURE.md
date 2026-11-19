# ENG HUB Architecture

## Target architecture

```text
Browser / Mobile
  React + TypeScript + Vite (frontend on GitHub Pages)
          | Firebase ID token over HTTPS
          v
  ENG HUB REST API (Express on Vercel Serverless Functions)
          | Firebase Admin SDK
          v
  Cloud Firestore

  Cloudinary: binary media storage
  Firebase Authentication: identity provider
  Firebase Cloud Messaging: browser push delivery
```

## Responsibilities

### Frontend

Presentation, navigation, responsive layouts, form state, client-side validation for usability, Firebase sign-in, and calling the API. It must not contain service-account credentials, Cloudinary API secret, or privileged business logic.

### Backend

Token verification, role checks, server-side validation, privileged reads/writes, audit logging, Cloudinary signatures, exam grading, notification dispatch, and administrative workflows. Every privileged route must verify identity and role on the server.

### Data and media

Firestore remains the data store during migration. Cloudinary remains the media store. Firebase Authentication remains the identity provider. The backend uses Firebase Admin SDK with credentials stored only in the hosting provider's secret environment.

## Hosting

The frontend remains on GitHub Pages. The API is prepared for Vercel Hobby serverless hosting to avoid Render's card-verification flow. Vercel Hobby is free for personal, non-commercial projects and has usage limits; check current plan terms before using it for a commercial service.

## Migration sequence

1. Establish backend service, health endpoint, Firebase token verification, and server-side admin authorization.
2. Add a typed frontend API client and move account/profile endpoints.
3. Move admin-only writes (subjects, lectures, exams, academic calendar, uploads/signatures) to backend routes.
4. Move student task updates, exam attempts/grading, and notification dispatch.
5. Migrate remaining Firestore reads/subscriptions to API endpoints where real-time updates are not required; retain carefully scoped client listeners only where appropriate.
6. Update Firestore rules only after each feature is fully migrated and tested. Never lock the client out before the replacement path is live.

## Current migration status

The independent backend scaffold and initial protected endpoints are present. The existing frontend still uses direct Firestore operations in several modules; this is intentional until equivalent API routes are implemented and verified. Do not describe the whole application as fully migrated yet.
