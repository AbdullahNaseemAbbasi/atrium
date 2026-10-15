# Data model

Source of truth for the shapes: `lib/data/types.ts`. This is the Postgres
schema the Supabase phase will create. Every tenant-owned table carries
`organization_id` and composite foreign keys `(organization_id, id)` so a row
can never reference a row from another workspace.

```
users ─┬─< memberships >── organizations ──< subscriptions, invoices
       │                        │
       └─< client_memberships >─┴──< clients
                                │
                                ├──< projects ──< project_members >── users
                                │       ├──< milestones
                                │       ├──< tasks (milestone_id?)
                                │       ├──< deliverables ──< deliverable_versions
                                │       │        └──< approvals (version, client user)
                                │       ├──< comments (task_id? | deliverable_id?)
                                │       └──< files
                                ├──< invitations (team | client)
                                ├──< activity_events
                                ├──< notifications
                                ├──< notification_preferences
                                ├──< audit_logs
                                └──< integrations
webhook_events (provider, provider_event_id) unique
```

## Tables

| Table | Key columns | Constraints and indexes |
|---|---|---|
| users | id, email, name, title, timezone, avatar_hue, is_platform_admin | unique(email) |
| organizations | id, name, slug, timezone, industry, website, brand_hue | unique(slug) |
| memberships | organization_id, user_id, role (owner/manager/member/billing), status | unique(organization_id, user_id) |
| invitations | organization_id, email, kind (team/client), role, client_id?, status, expires_at, token_hash | index(organization_id, status); token stored hashed |
| clients | organization_id, company_name, contact_name, email, status, brand_hue, notes | index(organization_id, status) |
| client_memberships | organization_id, client_id, user_id, role (approver/viewer), status | unique(client_id, user_id); FK (organization_id, client_id) |
| projects | organization_id, client_id?, name, status, start_at, due_at, shared_with_client, budget_cents | index(organization_id, status), FK (organization_id, client_id) |
| project_members | organization_id, project_id, user_id, project_role (lead/contributor) | unique(project_id, user_id) |
| milestones | organization_id, project_id, title, position, due_at, status, approval_required, completed_at | unique(project_id, position) |
| tasks | organization_id, project_id, milestone_id?, title, status, priority, due_at, assignee_user_id?, client_visible, completed_at | index(organization_id, assignee_user_id, status), index(project_id, status) |
| deliverables | organization_id, project_id, milestone_id?, title, status, current_version, submitted_at | index(project_id, status) |
| deliverable_versions | organization_id, deliverable_id, version, file_name, mime_type, size_bytes, storage_key, note | unique(deliverable_id, version) |
| approvals | organization_id, deliverable_id, version_id, version, client_user_id, decision, comment, decided_at | unique(deliverable_id, version, client_user_id): makes decisions idempotent |
| comments | organization_id, project_id, task_id?, deliverable_id?, author_user_id, body, visibility (internal/client) | check(task_id or deliverable_id) |
| files | organization_id, project_id, name, mime_type, size_bytes, storage_key, visibility | index(project_id) |
| activity_events | organization_id, project_id?, actor_user_id, verb, target_type, target_id, target_label, visibility | index(organization_id, created_at desc) |
| notifications | organization_id, recipient_user_id, type, title, body, href, read_at, deduplication_key | index(recipient_user_id, read_at) |
| notification_preferences | user_id, organization_id, muted (jsonb), digest | primary key(user_id, organization_id) |
| audit_logs | organization_id, actor_user_id?, action, entity_type, entity_id, summary, metadata (jsonb), ip | index(organization_id, created_at desc) |
| subscriptions | organization_id, plan_key, status, interval, current_period_end, cancel_at_period_end, provider ids | unique(organization_id) |
| invoices | organization_id, number, amount_cents, currency, status, period | unique(number) |
| webhook_events | provider, provider_event_id, event_type, organization_id?, status, received_at, processed_at | unique(provider, provider_event_id) |
| integrations | organization_id, key, account, connected_by_user_id | unique(organization_id, key) |

## Gaps in the original brief that this model fills

- `deliverable_versions` is separate from `deliverables`, so a deliverable
  keeps its identity across versions and approvals pin a version.
- `visibility` on comments, files and activity, and `client_visible` on
  tasks, so agencies can keep internal notes private.
- `shared_with_client` on projects: client access is explicit, not implied
  by `client_id`.
- `approvals` unique per (deliverable, version, client user) for idempotency.
- `notification_preferences` and `integrations` were referenced by the
  brief's pages but missing from its model.
