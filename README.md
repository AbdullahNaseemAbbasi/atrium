# Atrium

A multi-tenant client portal for agencies and studios. The team runs
projects, milestones and tasks in a private workspace; each client gets a
portal where they review versioned deliverables, comment, and approve or
request changes. Every decision is recorded against the exact version, with
who made it and when.

![Atrium dashboard](docs/screenshots/dashboard.png)

> **Status:** runs on Supabase (Postgres with row-level security, Auth,
> Storage and Realtime): uploads go straight to private storage, changes show
> up live in other open tabs, and people have profile photos. Without
> Supabase keys it falls back to an in-memory store with the same rules.
> Stripe test mode and AI assistance are next; see
> [docs/roadmap.md](docs/roadmap.md). All data is synthetic.

## Try the demo

Run it locally (below), open `/login` and pick a demo account. Each one
shows a different side of the permission model.

| Account | What you'll see |
|---|---|
| Agency owner (`alex@kinetic.example`) | Everything, plus a second workspace in the switcher |
| Project manager (`emma@kinetic.example`) | All projects and clients, invites, audit log, reports; no billing |
| Team member (`liam@kinetic.example`) | Only the projects he's assigned to |
| Billing manager (`olivia@kinetic.example`) | Plan, usage and invoices; no project data |
| Client approver (`daniel@acme.example`) | Acme Co.'s portal; can approve or request changes |
| Client viewer (`chris@acme.example`) | Same portal, comments only |
| Platform operator (`sam@atrium.example`) | `/admin`: health, workspaces, webhook log |

Password for every account: `atrium-demo`.

## What it does

**Team workspace**
- Dashboard with KPIs (active projects, tasks due soon, pending approvals,
  overdue tasks), each with a 12-week trend and a delta against a chosen
  period, all calculated from the data ([formulas](docs/business-rules.md)).
- Projects with milestones, client sharing, budget (internal) and team.
- Tasks as a board (drag and drop), list or calendar, across one project or
  all of them, with a task drawer and internal comments.
- Deliverables with full version history, private downloads through
  60-second signed links, a submit-for-review step and an approval trail.
- Comments that are either visible to the client or internal notes.
- Clients with portal users (approver or viewer), invitations and access
  revocation.
- Team management with role changes, seat limits and invitations.
- Approval queue, activity log, notifications, reports with documented
  formulas, settings (profile, workspace, notification preferences,
  integrations, audit log with CSV export, data export).
- Billing: plan comparison, usage meters, a test-mode checkout, cancel and
  resume, invoices. Plan changes go through a signed, idempotent webhook
  processor.

**Client portal**
- Overview of what needs their review, project progress and recent updates.
- Review screen with version history, the agency's notes, approve or request
  changes, and the discussion.
- Approvals history, shared files and notifications.

**Platform operations**
- Health checks, platform metrics, workspace list with an audited
  metadata-only support view, webhook event log and replay.

| Client review | Task board | Reports |
|---|---|---|
| ![Client review](docs/screenshots/portal-review.png) | ![Board](docs/screenshots/board.png) | ![Reports](docs/screenshots/reports.png) |
| **Billing** | **Client detail** | **Calendar** |
| ![Billing](docs/screenshots/billing.png) | ![Client](docs/screenshots/client.png) | ![Calendar](docs/screenshots/calendar.png) |

## Security model

- The active workspace comes from a verified membership, never from request
  input alone. Every query and server action re-checks access and the
  tenant of every referenced id.
- Anything the viewer can't see renders as not found, so ids can't be probed.
- Client users only ever receive shared projects of their own client,
  client-visible tasks, submitted deliverables and client-visible comments,
  files and activity.
- Downloads are re-authorized, audited and issued as short-lived signed links.
- Uploads go straight to a private bucket through signed URLs; the saved row
  must match a signed ticket and an object of the reported size.
- Row-level security mirrors the access rules for everything the browser
  reads (Realtime); only the server writes.
- Approvals are idempotent per user and version; stale tabs can't approve an
  older version.
- Billing webhooks are HMAC-verified, deduplicated by event id and ordered.
- Plan limits are enforced on the server.

Details and the threat model: [docs/security.md](docs/security.md).

## Stack

Next.js 16 (App Router, Cache Components, server actions) · React 19 ·
TypeScript (strict) · Tailwind CSS 4 · Radix UI primitives · Supabase
(Postgres, Auth, Storage, Realtime) · zod · date-fns · Vitest · Playwright. One app, no separate API server
([why](docs/decisions/0001-single-nextjs-app-with-supabase.md)).

## Run it locally

Requirements: Node 24 and pnpm 10.

```bash
pnpm install
cp .env.example .env.local   # optional: without Supabase keys it runs in memory
pnpm dev                     # http://localhost:3000
```

With a Supabase project: fill in the Supabase variables, run
`supabase db push` and `pnpm seed` (details in
[docs/supabase.md](docs/supabase.md)).

| Command | What it does |
|---|---|
| `pnpm dev` | Development server |
| `pnpm build && pnpm start` | Production build and server (set `SESSION_SECRET`, or `ATRIUM_DEMO=true` for a demo deploy) |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Route type generation + `tsc --noEmit` |
| `pnpm test` | Unit tests (92): tenant isolation, roles, client boundaries, review state machine, KPI formulas, billing webhooks, CSV escaping, reports, upload tickets, photo checks |
| `pnpm test:e2e` | Playwright against a production build in memory mode (30): sign-in, project and task creation, the client approval journey, cross-tenant and role checks, mobile layout |
| `pnpm seed` | Loads the demo users, photos and workspaces into Supabase |

On Supabase the demo resets with `pnpm seed`, from `/admin` → Reset demo
data, or on a schedule through `/api/cron/reset-demo`. In memory mode it
resets when the server restarts.

## Project structure

```
app/                 routes: (marketing), (auth), onboarding, w/[org], portal/[org], admin, api
components/ui        design system (cards, buttons, badges, forms, dialogs, tables, stat tiles)
components/*         feature components (shell, tasks, deliverables, portal, billing…)
lib/auth             session, permissions matrix, data-access entry points
lib/data             types, seed, store, access rules, read models, queries
lib/data/supabase    table map, request snapshot (load + diff save), demo seed
lib/storage          signed tickets, uploads, profile photos
supabase/            schema migration (RLS, Realtime, buckets) and CLI config
lib/actions          server actions (validated, authorized, audited)
lib/domain           business rules and KPI formulas
lib/billing          plans, prices, usage, webhook processor
tests/  e2e/         Vitest and Playwright suites
docs/                architecture, data model, security, business rules, decisions, roadmap
```

## Documentation

- [Architecture](docs/architecture.md)
- [Data model](docs/data-model.md)
- [Business rules and KPI formulas](docs/business-rules.md)
- [Security and threat model](docs/security.md)
- [Supabase setup and data layer](docs/supabase.md)
- [Decision records](docs/decisions/)
- [Roadmap](docs/roadmap.md)
- [Engineering conventions](docs/CONVENTIONS.md)
