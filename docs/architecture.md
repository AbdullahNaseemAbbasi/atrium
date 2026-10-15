# Architecture

Atrium is a single Next.js 16 application (App Router, React 19, TypeScript
strict, Tailwind 4) on Supabase (Postgres, Auth, Storage, Realtime). The
first phase built the product UI on an in-memory data layer with real
authorization rules; the second phase put Supabase behind the same data
layer without changing pages (ADR 0004). The in-memory store remains for
tests.

```
Browser
  │  HTML streamed per request (Cache Components + Suspense skeletons)
  ▼
Next.js app (Node runtime)
  ├─ proxy.ts ............. refreshes the Supabase session, fast redirect
  │                         when signed out
  ├─ app/ ................. routes: marketing, auth, /w/[org] team app,
  │                         /portal/[org] client portal, /admin, /api/*
  ├─ lib/auth ............. Supabase Auth (verified JWT claims), DAL:
  │                         requireTeamContext, requireClientContext,
  │                         requirePlatformAdmin
  ├─ lib/data/queries ..... read models per area (server-only)
  ├─ lib/actions .......... server actions (zod validation, permission check,
  │                         tenant ownership check, audit/activity/notify)
  ├─ lib/data/access.ts ... pure tenant + resource rules (unit tested)
  ├─ lib/domain ........... business rules and KPI formulas (unit tested)
  ├─ lib/data/store.ts .... getDb()/saveDb(): request snapshot from
  │                         Postgres (secret key), diff-saved; or the
  │                         in-memory store in tests
  ├─ lib/storage .......... signed upload tickets, Storage URLs, photos
  └─ components/realtime .. Realtime subscription → refresh + toasts
                            (browser reads under RLS)
```

## Request flow

1. `proxy.ts` refreshes the Supabase session cookies and redirects to
   `/login` when there is no valid session. It is an optimisation, not the
   security boundary.
2. A page renders its static frame immediately and streams the data part
   inside `<Suspense>`.
3. The data part calls a query, e.g. `listProjects(orgSlug, filters)`.
   The query first calls `requireTeamContext(orgSlug)`: verify the JWT
   claims, load the profile, resolve the organization **from an active
   membership** (never from request input alone). A client user hitting a
   team URL is redirected to their portal; anyone else gets a 404.
4. The query reads only through `lib/data/access.ts` helpers
   (`visibleProjects`, `getVisibleProject`, `canViewDeliverable` …) and
   returns plain serialisable view models from `lib/data/views.ts`.
5. Mutations are server actions. Each one re-runs the context check,
   validates input with zod, verifies every referenced id belongs to the
   tenant, applies plan limits, writes the change, then records audit,
   activity and notifications (`lib/data/events.ts`), saves the changed rows
   (`saveDb()`) and refreshes the route.
6. Other open tabs of the same workspace receive the row changes through
   Supabase Realtime (filtered by RLS) and refresh their server components.

## Areas

| Area | Routes |
|---|---|
| Public | `/`, `/features`, `/pricing`, `/security`, `/help`, `/contact`, `/status`, `/terms`, `/privacy` |
| Auth | `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/invite/[token]`, `/onboarding` |
| Team app | `/w/[org]` dashboard, `projects` (+ overview, tasks, milestones, deliverables, files, activity, settings), `tasks`, `clients`, `team`, `approvals`, `activity`, `notifications`, `reports`, `billing`, `settings/*` |
| Client portal | `/portal/[org]` overview, `projects`, `deliverables/[id]` review, `approvals`, `files`, `notifications` |
| Platform | `/admin`, `/admin/workspaces`, `/admin/webhooks` |
| API | `/api/files/download` (signed links, memory mode), CSV/JSON exports, `/api/webhooks/billing`, `/api/cron/reset-demo`, `/auth/callback` (email links) |

## Why these choices

See `docs/decisions/`. In short: one Next.js app instead of Next.js + NestJS
because Supabase provides auth, Postgres with row-level security, storage and
realtime, which removes the need for a second server and keeps one auth
system. The application-level checks in `lib/data/access.ts` stay even after
RLS is added (defence in depth, and they produce the 404s and friendly
errors the UI needs).
