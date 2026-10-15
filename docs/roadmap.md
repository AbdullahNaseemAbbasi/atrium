# Roadmap

Mapped to the brief's milestones (S1 to S8).

| Milestone | Scope | State |
|---|---|---|
| S1 | Product assumptions, page map, threat model, architecture decisions | Done: `docs/architecture.md`, `docs/security.md`, `docs/data-model.md`, `docs/decisions/` |
| S2 | Design system, app shell, auth screens, organization membership | Done on the demo data layer |
| S3 | Clients, projects, team assignments, tasks, milestones | Done on the demo data layer |
| S4 | Private deliverables, versions, comments, approval workflow, notifications | Done on Supabase (real uploads, live notifications) |
| S5 | Plans, checkout test mode, webhook verification, usage enforcement | Done as a simulated test-mode checkout with an idempotent webhook processor; real Stripe test keys in phase 2 |
| S6 | Client portal polish, dashboards, accessibility, responsive layouts | Done; accessibility pass to repeat after phase 2 |
| S7 | Cross-tenant security tests, E2E tests, logging, performance review | Done: 94 unit tests, 30 Playwright tests (run on both backends) (security, approval journey, mobile layout); structured logging arrives with the Supabase phase |
| S8 | CI/CD, deployment, seed/demo accounts, screenshots, diagram, walkthrough | CI workflow, demo accounts and screenshots done; deployment and a recorded walkthrough next |

## Phase 2: Supabase and Stripe

| Step | State |
|---|---|
| Supabase project, schema migration, RLS, demo seed (`pnpm seed`) | Done |
| Supabase Auth (password, reset links, sign-up), proxy session refresh | Done |
| Data layer on Postgres behind `getDb()`/`saveDb()` (ADR 0004) | Done |
| Storage: signed uploads with progress, signed downloads, image previews, profile photos | Done |
| Realtime: live refresh of workspace and portal screens, notification toasts | Done |
| Scheduled demo reset (`/api/cron/reset-demo`) | Done (needs a scheduler on the host) |
| E2E suite on Supabase (`pnpm test:e2e:supabase`), sign-up and onboarding checked on the hosted project | Done |
| Stripe test mode: Checkout, plan switches, cancel and resume, customer portal, Stripe signatures on the existing processor | Done |
| Transactional email (invites, review requests, digests) through a provider adapter | Next |
| Deployment with the Supabase keys | Next |

## Phase 3: AI assistance

| Step | State |
|---|---|
| Provider adapter (Gemini free tier now, Claude when a key is added), timeouts, model fallback | Done |
| Feedback summary, reply draft, weekly client update; drafts only, a person decides | Done |
| Per-workspace and per-person daily allowance, audit entry per draft | Done |
| Usage dashboard for owners | Later |
