# Security model and threat model

## Roles

| Role | Scope |
|---|---|
| Platform admin | `/admin` only: health, metrics, workspace metadata. No project content. Support views are audited. |
| Owner | Everything in the workspace. |
| Manager | All projects and clients, invites team members (as members only), audit log, reports. No billing. |
| Team member | Projects they are assigned to: tasks, uploads, internal comments. |
| Billing manager | Plan, payment method, invoices. No project data. |
| Client approver | Shared projects of their own client; comments; approves or requests changes. |
| Client viewer | Same as approver without the decision. |

The matrix lives in `lib/auth/permissions.ts`; resource rules in
`lib/data/access.ts`. Both are unit tested (`tests/access.test.ts`,
`tests/rules.test.ts`).

## Threats and mitigations

| Threat | Mitigation |
|---|---|
| **Cross-tenant access by guessing ids (IDOR/BOLA)** | The organization comes from a verified membership. Every query and action loads the row and checks `organizationId` plus the resource rule. Invisible rows return 404, never 403. Tests cover project, deliverable, task and activity ids across tenants. |
| Client user escalating to team permissions by sharing a URL | Team routes call `requireTeamContext`; a client membership never resolves as a team membership. Client users are redirected to their portal. |
| Client seeing internal work | Clients see only shared projects of their own client, `clientVisible` tasks, submitted deliverables and `client` comments/files/activity. Budget is never part of a portal view model. |
| Forged session | Session cookie is `httpOnly`, `SameSite=Lax`, `Secure` in production and HMAC-signed; signature compared in constant time. (Replaced by Supabase Auth in phase 2.) |
| CSRF on mutations | Server actions are POST-only and Next.js checks the `Origin` header against the host. Cookies are `SameSite=Lax`. |
| Private file leakage | Files are referenced by private storage keys, never public URLs. Downloads go through `requestDownload`, which re-checks access, audits the download and issues a 60-second HMAC-signed link bound to the user; the download route checks access again. Responses use `Content-Disposition: attachment` and `nosniff`. |
| Malicious uploads | Extension and MIME allowlist, 5 GB cap, plan storage limit, server-side validation. Bytes go directly to private storage via signed upload URLs (phase 2); malware scanning is listed as future work. |
| Duplicate approvals / race conditions | Decisions are idempotent per user + version; the posted version must equal the current version. |
| Billing webhook spoofing and replays | HMAC signature over the raw body; event ids stored and deduplicated; out-of-order events ignored; subscription state only changes from verified events, never from redirect parameters. |
| Plan limit bypass | Limits enforced in server actions, not only in the UI. |
| CSV formula injection in exports | Cells starting with `= + - @` are prefixed with `'`. Exports require permission and are audited. |
| Account enumeration | Password reset returns the same message whether or not the account exists. |
| Open redirects after sign-in | `next` must be a same-site relative path. |

## Audit trail

`recordAudit` writes actor, organization, action, entity, summary, metadata
and timestamp for: sign-ins, invitations, role changes, removals, client
access changes, project sharing, approvals and change requests, downloads,
exports, plan changes, payment failures and workspace changes.

## Data retention (planned for the Supabase phase)

Deleted workspaces are soft-deleted for 30 days, then purged with their
storage objects. Audit logs are kept for 12 months. Uploaded files of
archived projects are kept until the workspace is deleted.

## Known limits of the demo build

- Data is in memory and resets on server restart (or from `/admin`).
- One shared demo password; real authentication arrives with Supabase Auth.
- Downloads return a placeholder text file describing the object.
- No email is sent; notifications are in-app.
