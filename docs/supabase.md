# Supabase setup

Phase 2 runs Atrium on Supabase: Postgres with row-level security, Auth,
Storage and Realtime. Everything the database needs is in
`supabase/migrations/20261015120000_atrium_schema.sql`; the demo data comes
from `lib/data/seed.ts` through `pnpm seed`.

## 1. Create and link the project

1. Create a project in the owner's Supabase organization (Postgres 17, the
   version in `supabase/config.toml`).
2. Install the CLI and sign in: `supabase login`.
3. Link this repo: `supabase link --project-ref <project-ref>` (the ref is
   in the project URL, `https://<project-ref>.supabase.co`).
4. Apply the schema: `supabase db push`. It creates the tables, RLS
   policies, Realtime publication entries and the `avatars` and
   `project-files` buckets.
5. In Authentication > URL configuration, set the site URL and redirect
   URLs for each environment. `supabase/config.toml` holds the local values
   (`http://localhost:3000`) and turns email confirmation off so demo
   sign-ups can sign in at once.

## 2. Environment variables

Put these in `.env.local` (never commit it):

| Variable | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser and server | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser and server | `sb_publishable_...` (the legacy anon key also works) |
| `SUPABASE_SECRET_KEY` | server only | `sb_secret_...` or the legacy `service_role` key |
| `CRON_SECRET` | server only | Bearer token for `GET /api/cron/reset-demo` |
| `ATRIUM_BACKEND` | server only | `memory` forces the in-memory store (tests) |

The app uses Supabase when the URL and both keys are set and
`ATRIUM_BACKEND` isn't `memory`; otherwise it runs the in-memory demo.

The secret key bypasses RLS. It must only be read in server code and
scripts, never in a file that can reach the browser.

## 3. Load the demo

```bash
pnpm seed
```

This creates or refreshes the 18 demo Auth users (confirmed, password
`atrium-demo`), upserts their profiles with the seed ids (`usr_alex`...) and
a portrait in the public `avatars` bucket, then resets the Kinetic Studio and
Lumen Labs workspaces: their rows are deleted and the seed is inserted again,
and every demo file gets a small text placeholder in `project-files`.

Run it again whenever you want a clean demo. It only touches the two demo
workspaces (`org_kinetic`, `org_lumen`), their webhook events and the demo
profiles; workspaces people created themselves stay. Server code can do the
same reset with `resetDemoData(admin)` from `lib/data/supabase/demo-seed.ts`.

Local stack instead of a hosted project (needs Docker): `supabase start`,
`supabase db reset`, then point `.env.local` at the URL and secret key from
`supabase status` and run `pnpm seed`.

## How the app reads and writes

The pages, actions and access rules were written against one `Database`
object (`lib/data/types.ts`), and they still are:

- `getDb()` (`lib/data/store.ts`) returns a request-scoped snapshot: the
  rows of every workspace the signed-in person belongs to, loaded with the
  secret key in about 20 parallel queries (`lib/data/supabase/snapshot.ts`).
  Platform operators load everything.
- `saveDb()` diffs the snapshot against what was loaded and writes only the
  changed rows: tables other tables point at go in foreign-key order, the
  rest (comments, activity, notifications, audit log...) in parallel.
  Server actions call it before `refresh()`, `redirect()` or returning; an
  `after()` callback saves anything left over.
- The request scope is keyed by the request's `headers()` object
  (`lib/data/supabase/request.ts`). React `cache` gives server actions a new
  scope on every call and route handlers none, so it can't be used here. One
  key per request also means the render that follows an action reuses the
  saved snapshot and shows the change at once.
- Lookups that cross workspaces on purpose load the extra workspace first:
  invitation links (`getDbForInvitation`), invitations to your email during
  onboarding (`getDbForInvitesTo`), webhooks (by the event's organization id,
  after the signature check) and workspace address checks (`isSlugTaken`).

## How security is split

- **The server does all writes** with the secret key, after the checks in
  `lib/data/access.ts`, `lib/auth/permissions.ts` and the server actions.
  Those checks produce the 404s and friendly errors.
- **RLS is the backstop for everything the browser reads** with the user's
  session (Realtime and any direct query). Every table has RLS on and only
  SELECT policies for `authenticated`; there are no insert, update or delete
  policies, and `anon` has no table access at all. The policies mirror
  `access.ts`: team roles by membership, members only on assigned projects,
  billing managers no project data, client users only shared projects of
  their own client, client-visible tasks, submitted deliverables and versions
  that were sent, and `client` comments, files and activity.
- The policy helpers live in the `private` schema (not exposed by the API)
  as `security definer` functions: `app_user_id`, `org_role`,
  `client_id_for`, `is_client_of`, `can_view_project` (plus team and client
  variants), `can_view_task`, `can_view_deliverable`,
  `can_view_deliverable_version`, `can_see_profile`.
- `projects.budget_cents` and `clients.notes` are not granted to
  `authenticated` at all, so they never reach a browser (Realtime payloads
  drop them too). Browser queries on those two tables must list columns
  instead of `select('*')`.
- `webhook_events` has no policy: only the service role reads it.
- Composite foreign keys `(organization_id, ...)` stop a row from pointing
  at another workspace's project, client, milestone, task, deliverable or
  version, even for writes made with the secret key.

## Storage

- `avatars`: public bucket (5 MB, images). Seeded portraits are
  `{userId}.jpg`; photos people upload in Settings > Profile go to
  `users/{userId}/{uuid}.{ext}` (a new path each time, so no cache goes
  stale) and the previous one is deleted. The server checks the first bytes
  (JPEG, PNG or WebP only) and caps photos at 1.5 MB.
- `project-files`: private bucket. No storage policies: the server creates
  signed upload URLs and short-lived signed download URLs after its own
  access check. Keys are `org/{orgId}/projects/{projectId}/files/{uuid}` and
  `org/{orgId}/projects/{projectId}/deliverables/{uuid}`.
- Uploads (`lib/storage/uploads.ts`): choosing a file calls
  `prepareUpload`, which runs the same checks as saving (access, type, size,
  plan storage) and returns a signed ticket plus a signed upload URL. The
  browser PUTs the bytes straight to Storage with a progress bar. The form
  then posts the metadata and the ticket; `claimUpload` checks the ticket
  matches the workspace, project, person and file, and that the object exists
  with that size. Images whose stored type matches get `has_preview`, and the
  review screens show them through a 10 minute signed URL.
- Deleting a project file removes its object. Deliverable versions are never
  deleted (they carry the approval history).
- The project-wide upload limit caps every bucket (50 MB on the Free plan
  and in the local `config.toml`). Raise it in Storage settings on a paid
  plan before relying on large uploads, and use resumable uploads for big
  files.

## Realtime

Published tables (with `replica identity full`, so updates and deletes carry
the old row): notifications, tasks, deliverables, deliverable_versions,
approvals, comments, activity_events, projects, milestones, project_files,
memberships, client_memberships, invitations. Subscribers only receive rows
their RLS policies allow.

`components/realtime/realtime-sync.tsx` runs in the workspace and portal
layouts. It joins one channel per person and workspace, listens for inserts
and updates on those tables filtered by `organization_id`, and refreshes the
server components on screen (debounced; hidden tabs refresh once when they
come back). New notifications for the person also show a toast with a link.
Deletes aren't streamed (Postgres changes can't filter them by workspace);
every delete in the app also updates a parent row, which triggers the
refresh. The memory backend has no Realtime.

## Demo reset

`GET /api/cron/reset-demo` with `Authorization: Bearer $CRON_SECRET` runs
`resetDemoData`: the two demo workspaces go back to the seed, objects
uploaded during the demo are deleted, and demo profiles get their names and
portraits back (photos people uploaded are removed). Any other request gets
a 404. Point a scheduler (Netlify scheduled function, Vercel cron, GitHub
Actions) at it, for example nightly. Platform operators can also reset from
the admin console.

## Schema notes for app code

- Columns are the snake_case field names from `lib/data/types.ts`; use
  `toRow` / `fromRow` in `lib/data/supabase/tables.ts`. Optional fields are
  nullable columns, required ones are `not null`.
- Timestamps come back as `2026-10-15T17:00:00+00:00`, not the `...Z`
  strings the in-memory store used. `bigint` columns (`size_bytes`,
  `amount_cents`, `budget_cents`) must be whole numbers.
- `invoices` numbers are unique per workspace, not globally.
- `webhook_events`: only one `processed` row per provider event; duplicates
  (`skipped_duplicate`) and failed attempts can repeat.
- `milestones (project_id, position)` is unique and deferred: write a reorder
  as one upsert or inside one transaction, not as separate requests.
- `comments` need a `task_id` or a `deliverable_id`. Invitations of kind
  `team` have a team role and no `client_id`; kind `client` has `approver`
  or `viewer` and a `client_id`.
