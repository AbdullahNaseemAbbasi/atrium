# Roadmap

Mapped to the brief's milestones (S1–S8).

| Milestone | Scope | State |
|---|---|---|
| S1 | Product assumptions, page map, threat model, architecture decisions | Done: `docs/architecture.md`, `docs/security.md`, `docs/data-model.md`, `docs/decisions/` |
| S2 | Design system, app shell, auth screens, organization membership | Done on the demo data layer |
| S3 | Clients, projects, team assignments, tasks, milestones | Done on the demo data layer |
| S4 | Private deliverables, versions, comments, approval workflow, notifications | Done on the demo data layer (in-app notifications, placeholder downloads) |
| S5 | Plans, checkout test mode, webhook verification, usage enforcement | Done as a simulated test-mode checkout with an idempotent webhook processor; real Stripe test keys in phase 2 |
| S6 | Client portal polish, dashboards, accessibility, responsive layouts | Done; accessibility pass to repeat after phase 2 |
| S7 | Cross-tenant security tests, E2E tests, logging, performance review | Done: 82 unit tests, 30 Playwright tests (security, approval journey, mobile layout); structured logging arrives with the Supabase phase |
| S8 | CI/CD, deployment, seed/demo accounts, screenshots, diagram, walkthrough | CI workflow, demo accounts and screenshots done; deployment and a recorded walkthrough next |

## Phase 2: Supabase and Stripe

1. Create the Supabase project in the owner's organization; add migrations for
   the schema in `docs/data-model.md`, RLS policies (ADR 0002) and a seed
   script that loads the same synthetic data.
2. Replace `lib/auth/session.ts` with Supabase Auth (email + password,
   magic link for client invites). Keep `requireTeamContext` and
   `requireClientContext` signatures.
3. Replace `getDb()` reads/writes in `lib/data/queries/*` and
   `lib/actions/*` with Supabase queries; keep the access helpers as the
   application-level check.
4. Storage: private bucket, signed upload URLs from the upload-intent action,
   signed download URLs from `requestDownload`.
5. Realtime: subscribe the notifications menu, task board and approval queue
   to row changes for the active organization.
6. Stripe test mode: Checkout Sessions with server-side price mapping, the
   customer portal, and `/api/webhooks/billing` verifying Stripe signatures
   with the existing idempotent processor.
7. Transactional email (invites, review requests, digests) through a
   provider adapter with delivery status.

## Phase 3: AI assistance (after an API key is available)

Kept behind a provider adapter, with timeouts, token limits, per-workspace
quotas and usage logging; output is always a draft a person approves.

- Summarise a deliverable's feedback thread into a change list.
- Draft a reply to a client comment.
- Draft the weekly client update from the project's activity.
