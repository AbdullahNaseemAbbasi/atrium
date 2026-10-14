# Business rules and KPI formulas

Every number in the product comes from one function. Change the function and
every screen follows.

## Projects

- **Active project** (`activeProjectsAt`): started on or before the moment
  measured (`startAt`, else `createdAt`) and in `planning`, `in_progress` or
  `in_review`. A project now `on_hold`, `completed` or `cancelled` counted as
  active until its last status change (`updatedAt`).
- **Progress** (`projectProgress`): completed tasks ÷ all tasks, rounded to a
  whole percent. `completed` projects are always 100%; no tasks = 0%.
- **Milestone progress** (`milestoneProgress`): same formula over the
  milestone's tasks.

## Tasks

- **Overdue** (`isTaskOverdue`): not `done` and the due date is on an earlier
  calendar day than today.
- **Due soon** (`isTaskDueSoon`): not `done` and due today or within the next
  7 calendar days.
- Completed tasks show "Done <date>" instead of a due label.

## Deliverables and approvals

State machine (`nextDeliverableStatus`):

| From | Event | To |
|---|---|---|
| draft | upload_version | draft |
| draft | submit | in_review |
| in_review | approve | approved |
| in_review | request_changes | changes_requested |
| in_review / changes_requested / approved | upload_version | draft |

- Only the project lead, a manager or an owner can submit to the client, and
  only when the project has a client and is shared with them.
- Only client users with the **approver** role decide; viewers comment.
- A decision is pinned to the version it was made on. A repeated request for
  the same user + version returns the existing decision
  (`findExistingDecision`), so double clicks and retries can't create two.
- Clients never see drafts; a deliverable reaches the portal when submitted.

## Milestones

A milestone can be completed when (`milestoneBlockers` is empty):
1. every task in it is `done`, and
2. if `approvalRequired`, it has at least one deliverable and all of them are
   `approved`.

When the last required approval arrives, the milestone completes
automatically.

## Dashboard KPIs (`lib/domain/metrics.ts`)

| Tile | Formula | Delta |
|---|---|---|
| Active projects | `activeProjectsAt(now)` | value now − value N days ago |
| Tasks due soon | open tasks due within 7 days | same, up is bad |
| Pending approvals | deliverables with a version waiting for a decision | same, up is bad |
| Overdue tasks | open tasks past their due day | same, up is bad |

N is the selected range (7, 30 or 90 days). Past values are reconstructed from
history: a task is open at time *t* if it was created before *t* and not
completed by *t*; a version is waiting for review from its submission until a
decision on that version or a newer upload. Trend lines evaluate the same
function at the end of each of the last 12 weeks.

The seeded dataset (relative to 15 Oct 2026) produces: 5 active projects,
15 tasks due soon, 4 pending approvals, 3 overdue tasks. `tests/rules.test.ts`
asserts these values.

## Plans and limits (`lib/billing/plans.ts`)

| Plan | Active projects | Client portals | Seats | Storage |
|---|---|---|---|---|
| Starter (free) | 3 | 2 | 2 | 2 GB |
| Professional ($49/mo) | 25 | 15 | 10 | 100 GB |
| Agency ($129/mo) | unlimited | unlimited | 40 | 1 TB |

Limits are checked in server actions before creating projects, clients,
invitations and uploads. For limits, a project counts as active by status
(planning, in progress or in review) even before its start date, while the
dashboard tile counts only projects that have started. Pending invitations
hold a seat. Downgrades are blocked while usage exceeds the
target plan.
