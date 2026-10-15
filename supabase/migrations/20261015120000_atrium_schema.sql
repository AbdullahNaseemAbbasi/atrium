-- Atrium schema: tables, constraints, row-level security, realtime and storage buckets.
--
-- Source of truth for tables and columns: lib/data/types.ts (column = snake_case of the field)
-- and lib/data/supabase/tables.ts (collection -> table). Access rules mirror lib/data/access.ts.
--
-- Who writes: only the Next.js server, with the secret (service role) key, after its own
-- authorization checks. The browser never writes; it reads with the user's session, mainly
-- for Realtime. That is why every table has RLS enabled and only SELECT policies.

-- ---------------------------------------------------------------------------
-- Identity and tenancy
-- ---------------------------------------------------------------------------

create table public.profiles (
  id text primary key,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  name text not null,
  email text not null unique,
  title text,
  avatar_hue integer not null check (avatar_hue between 0 and 360),
  avatar_url text,
  timezone text not null,
  is_platform_admin boolean default false,
  created_at timestamptz not null default now(),
  last_active_at timestamptz
);

comment on table public.profiles is 'App users (the "users" collection). id keeps the app id (usr_...); auth_user_id links the Supabase Auth user.';

create table public.organizations (
  id text primary key,
  name text not null,
  slug text not null unique,
  timezone text not null,
  industry text not null,
  website text,
  brand_hue integer not null check (brand_hue between 0 and 360),
  created_at timestamptz not null default now()
);

create table public.memberships (
  id text primary key,
  organization_id text not null references public.organizations (id) on delete cascade,
  user_id text not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'member', 'billing')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  joined_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index memberships_user_id_idx on public.memberships (user_id);

-- ---------------------------------------------------------------------------
-- Clients
-- ---------------------------------------------------------------------------

create table public.clients (
  id text primary key,
  organization_id text not null references public.organizations (id) on delete cascade,
  company_name text not null,
  contact_name text not null,
  email text not null,
  phone text,
  website text,
  industry text not null,
  status text not null default 'active' check (status in ('active', 'onboarding', 'paused', 'archived')),
  brand_hue integer not null check (brand_hue between 0 and 360),
  notes text,
  created_at timestamptz not null default now(),
  unique (organization_id, id)
);

create index clients_organization_status_idx on public.clients (organization_id, status);

create table public.client_memberships (
  id text primary key,
  organization_id text not null,
  client_id text not null,
  user_id text not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('approver', 'viewer')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  joined_at timestamptz not null default now(),
  unique (client_id, user_id),
  foreign key (organization_id, client_id) references public.clients (organization_id, id) on delete cascade
);

create index client_memberships_user_id_idx on public.client_memberships (user_id, organization_id);
create index client_memberships_organization_idx on public.client_memberships (organization_id, client_id);

create table public.invitations (
  id text primary key,
  organization_id text not null references public.organizations (id) on delete cascade,
  email text not null,
  kind text not null check (kind in ('team', 'client')),
  role text not null check (role in ('owner', 'manager', 'member', 'billing', 'approver', 'viewer')),
  client_id text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired', 'revoked')),
  invited_by_user_id text not null references public.profiles (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  foreign key (organization_id, client_id) references public.clients (organization_id, id) on delete cascade,
  -- Team invitations carry a team role and no client; client invitations a portal role and a client.
  constraint invitations_kind_matches_role check (
    (kind = 'team' and role in ('owner', 'manager', 'member', 'billing') and client_id is null)
    or (kind = 'client' and role in ('approver', 'viewer') and client_id is not null)
  )
);

create index invitations_organization_status_idx on public.invitations (organization_id, status);
create index invitations_email_idx on public.invitations (lower(email));
create index invitations_client_id_idx on public.invitations (client_id) where client_id is not null;

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------

create table public.projects (
  id text primary key,
  organization_id text not null references public.organizations (id) on delete cascade,
  client_id text,
  name text not null,
  description text not null default '',
  status text not null default 'planning'
    check (status in ('planning', 'in_progress', 'in_review', 'on_hold', 'completed', 'cancelled')),
  icon text not null default 'layers'
    check (icon in ('globe', 'smartphone', 'palette', 'cart', 'megaphone', 'heart', 'search', 'layers')),
  start_at timestamptz,
  due_at timestamptz,
  shared_with_client boolean not null default false,
  budget_cents bigint check (budget_cents >= 0),
  created_by_user_id text not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  -- Deleting a client keeps its projects as internal ones (needs Postgres 15+).
  foreign key (organization_id, client_id) references public.clients (organization_id, id) on delete set null (client_id)
);

create index projects_organization_status_idx on public.projects (organization_id, status);
create index projects_client_id_idx on public.projects (client_id) where client_id is not null;

create table public.project_members (
  id text primary key,
  organization_id text not null,
  project_id text not null,
  user_id text not null references public.profiles (id) on delete cascade,
  project_role text not null check (project_role in ('lead', 'contributor')),
  unique (project_id, user_id),
  foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete cascade
);

create index project_members_user_id_idx on public.project_members (user_id);

create table public.milestones (
  id text primary key,
  organization_id text not null,
  project_id text not null,
  title text not null,
  description text,
  "position" integer not null,
  due_at timestamptz,
  status text not null default 'upcoming' check (status in ('upcoming', 'in_progress', 'awaiting_approval', 'completed')),
  approval_required boolean not null default false,
  completed_at timestamptz,
  unique (organization_id, id),
  -- Deferred so a reorder that rewrites several positions in one statement/transaction passes.
  constraint milestones_project_position_key unique (project_id, "position") deferrable initially deferred,
  foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete cascade
);

create table public.tasks (
  id text primary key,
  organization_id text not null,
  project_id text not null,
  milestone_id text,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'in_review', 'blocked', 'done')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  due_at timestamptz,
  assignee_user_id text references public.profiles (id) on delete set null,
  created_by_user_id text not null references public.profiles (id),
  client_visible boolean not null default false,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (organization_id, id),
  foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete cascade,
  foreign key (organization_id, milestone_id) references public.milestones (organization_id, id) on delete set null (milestone_id)
);

create index tasks_organization_assignee_status_idx on public.tasks (organization_id, assignee_user_id, status);
create index tasks_project_status_idx on public.tasks (project_id, status);
create index tasks_milestone_id_idx on public.tasks (milestone_id) where milestone_id is not null;

-- ---------------------------------------------------------------------------
-- Deliverables and approvals
-- ---------------------------------------------------------------------------

create table public.deliverables (
  id text primary key,
  organization_id text not null,
  project_id text not null,
  milestone_id text,
  title text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'in_review', 'changes_requested', 'approved')),
  current_version integer not null default 1 check (current_version >= 0),
  created_by_user_id text not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  unique (organization_id, id),
  foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete cascade,
  foreign key (organization_id, milestone_id) references public.milestones (organization_id, id) on delete set null (milestone_id)
);

create index deliverables_project_status_idx on public.deliverables (project_id, status);
create index deliverables_organization_status_idx on public.deliverables (organization_id, status);
create index deliverables_milestone_id_idx on public.deliverables (milestone_id) where milestone_id is not null;

create table public.deliverable_versions (
  id text primary key,
  organization_id text not null,
  deliverable_id text not null,
  version integer not null check (version >= 1),
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  storage_key text not null,
  note text,
  has_preview boolean default false,
  uploaded_by_user_id text not null references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (deliverable_id, version),
  foreign key (organization_id, deliverable_id) references public.deliverables (organization_id, id) on delete cascade
);

create table public.approvals (
  id text primary key,
  organization_id text not null,
  deliverable_id text not null,
  version_id text not null,
  version integer not null check (version >= 1),
  client_user_id text not null references public.profiles (id),
  decision text not null check (decision in ('approved', 'changes_requested')),
  comment text,
  decided_at timestamptz not null default now(),
  -- One decision per person per version: makes approvals idempotent.
  unique (deliverable_id, version, client_user_id),
  foreign key (organization_id, deliverable_id) references public.deliverables (organization_id, id) on delete cascade,
  foreign key (organization_id, version_id) references public.deliverable_versions (organization_id, id) on delete cascade
);

create index approvals_version_id_idx on public.approvals (version_id);

-- ---------------------------------------------------------------------------
-- Comments and files
-- ---------------------------------------------------------------------------

create table public.comments (
  id text primary key,
  organization_id text not null,
  project_id text not null,
  task_id text,
  deliverable_id text,
  author_user_id text not null references public.profiles (id),
  body text not null,
  visibility text not null default 'internal' check (visibility in ('internal', 'client')),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  constraint comments_target_check check (task_id is not null or deliverable_id is not null),
  foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete cascade,
  foreign key (organization_id, task_id) references public.tasks (organization_id, id) on delete cascade,
  foreign key (organization_id, deliverable_id) references public.deliverables (organization_id, id) on delete cascade
);

create index comments_project_created_idx on public.comments (project_id, created_at);
create index comments_task_id_idx on public.comments (task_id) where task_id is not null;
create index comments_deliverable_id_idx on public.comments (deliverable_id) where deliverable_id is not null;

create table public.project_files (
  id text primary key,
  organization_id text not null,
  project_id text not null,
  name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  storage_key text not null,
  visibility text not null default 'internal' check (visibility in ('internal', 'client')),
  uploaded_by_user_id text not null references public.profiles (id),
  created_at timestamptz not null default now(),
  foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete cascade
);

create index project_files_project_id_idx on public.project_files (project_id);
create index project_files_organization_created_idx on public.project_files (organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Activity, notifications, audit
-- ---------------------------------------------------------------------------

create table public.activity_events (
  id text primary key,
  organization_id text not null references public.organizations (id) on delete cascade,
  project_id text,
  actor_user_id text references public.profiles (id) on delete set null,
  verb text not null check (verb in (
    'project.created', 'project.status_changed', 'task.created', 'task.completed',
    'deliverable.uploaded', 'deliverable.submitted', 'deliverable.approved',
    'deliverable.changes_requested', 'milestone.completed', 'comment.posted',
    'file.uploaded', 'member.invited', 'client.added'
  )),
  target_type text not null check (target_type in (
    'project', 'task', 'deliverable', 'milestone', 'comment', 'file', 'member', 'client'
  )),
  target_id text not null,
  target_label text not null,
  visibility text not null default 'internal' check (visibility in ('internal', 'client')),
  created_at timestamptz not null default now(),
  foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete cascade
);

create index activity_events_organization_created_idx on public.activity_events (organization_id, created_at desc);
create index activity_events_project_created_idx on public.activity_events (project_id, created_at desc) where project_id is not null;

create table public.notifications (
  id text primary key,
  organization_id text not null references public.organizations (id) on delete cascade,
  recipient_user_id text not null references public.profiles (id) on delete cascade,
  type text not null check (type in (
    'deliverable.submitted', 'deliverable.approved', 'deliverable.changes_requested',
    'comment.mention', 'comment.posted', 'task.assigned', 'task.due_soon',
    'milestone.completed', 'invitation.accepted', 'billing.payment_failed', 'billing.invoice_paid'
  )),
  title text not null,
  body text not null,
  href text not null,
  read_at timestamptz,
  deduplication_key text,
  created_at timestamptz not null default now()
);

create index notifications_recipient_read_idx on public.notifications (recipient_user_id, read_at);
create index notifications_recipient_created_idx on public.notifications (recipient_user_id, created_at desc);
create index notifications_organization_created_idx on public.notifications (organization_id, created_at desc);

create table public.notification_preferences (
  user_id text not null references public.profiles (id) on delete cascade,
  organization_id text not null references public.organizations (id) on delete cascade,
  -- { "inApp": NotificationGroup[], "email": NotificationGroup[] } (camelCase keys, as in the app)
  muted jsonb not null default '{"inApp": [], "email": []}'::jsonb check (jsonb_typeof(muted) = 'object'),
  digest text not null default 'off' check (digest in ('off', 'daily', 'weekly')),
  primary key (user_id, organization_id)
);

create index notification_preferences_organization_idx on public.notification_preferences (organization_id);

create table public.audit_logs (
  id text primary key,
  organization_id text not null references public.organizations (id) on delete cascade,
  actor_user_id text references public.profiles (id) on delete set null,
  action text not null check (action in (
    'member.invited', 'member.role_changed', 'member.removed', 'invitation.revoked',
    'client.created', 'client.access_granted', 'client.access_revoked',
    'project.created', 'project.shared', 'project.unshared',
    'deliverable.approved', 'deliverable.changes_requested',
    'file.downloaded', 'file.deleted', 'data.exported',
    'billing.plan_changed', 'billing.payment_failed',
    'workspace.created', 'workspace.updated', 'invitation.accepted',
    'integration.connected', 'integration.disconnected', 'support.accessed', 'auth.sign_in'
  )),
  entity_type text not null,
  entity_id text not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  ip text,
  created_at timestamptz not null default now()
);

create index audit_logs_organization_created_idx on public.audit_logs (organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Billing
-- ---------------------------------------------------------------------------

create table public.subscriptions (
  id text primary key,
  organization_id text not null unique references public.organizations (id) on delete cascade,
  plan_key text not null check (plan_key in ('starter', 'professional', 'agency')),
  status text not null check (status in ('trialing', 'active', 'past_due', 'canceled', 'incomplete')),
  "interval" text not null default 'month' check ("interval" in ('month', 'year')),
  current_period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  trial_ends_at timestamptz,
  provider_customer_id text,
  provider_subscription_id text,
  -- { brand, last4, expMonth, expYear } (camelCase keys, as in the app)
  payment_method jsonb check (payment_method is null or jsonb_typeof(payment_method) = 'object')
);

create table public.invoices (
  id text primary key,
  organization_id text not null references public.organizations (id) on delete cascade,
  number text not null,
  amount_cents bigint not null check (amount_cents >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null check (status in ('paid', 'open', 'void', 'uncollectible')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  issued_at timestamptz not null default now(),
  -- Numbers are generated per workspace (INV-2026-001 in every workspace), so unique per organization.
  unique (organization_id, number)
);

create index invoices_organization_issued_idx on public.invoices (organization_id, issued_at desc);

create table public.webhook_events (
  id text primary key,
  provider text not null check (provider in ('stripe')),
  provider_event_id text not null,
  event_type text not null,
  organization_id text references public.organizations (id) on delete set null,
  status text not null check (status in ('processed', 'skipped_duplicate', 'failed')),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  event_created_at timestamptz,
  outcome text,
  stale boolean default false,
  payload text
);

-- An event is applied at most once. Duplicates are still stored (status skipped_duplicate), and a
-- failed delivery can be retried, so only the processed row has to be unique.
create unique index webhook_events_processed_once_idx
  on public.webhook_events (provider, provider_event_id)
  where status = 'processed';
create index webhook_events_provider_event_idx on public.webhook_events (provider, provider_event_id);
create index webhook_events_received_idx on public.webhook_events (received_at desc);
create index webhook_events_organization_idx on public.webhook_events (organization_id) where organization_id is not null;

-- ---------------------------------------------------------------------------
-- Integrations
-- ---------------------------------------------------------------------------

create table public.integrations (
  organization_id text not null references public.organizations (id) on delete cascade,
  key text not null check (key in ('slack', 'google_drive', 'figma', 'github', 'zapier', 'stripe')),
  connected_at timestamptz not null default now(),
  connected_by_user_id text not null references public.profiles (id),
  account text not null,
  primary key (organization_id, key)
);

-- ---------------------------------------------------------------------------
-- RLS helpers (private schema: not exposed through the Data API)
--
-- security definer so policies can look at memberships/projects without recursing into
-- those tables' own policies; search_path = '' so every reference is schema-qualified.
-- ---------------------------------------------------------------------------

create schema if not exists private;
revoke all on schema private from public;

-- The profile id (usr_...) of the signed-in Supabase Auth user, or null.
create function private.app_user_id()
returns text
language sql stable security definer
set search_path = ''
as $$
  select p.id from public.profiles p where p.auth_user_id = auth.uid()
$$;

-- Role of the signed-in user's active team membership in the organization, or null.
create function private.org_role(org text)
returns text
language sql stable security definer
set search_path = ''
as $$
  select m.role
  from public.memberships m
  where m.organization_id = org
    and m.user_id = private.app_user_id()
    and m.status = 'active'
$$;

-- The client the signed-in user represents in the organization (resolveClientContext): the first
-- active client membership, and only while that client is not archived.
create function private.client_id_for(org text)
returns text
language sql stable security definer
set search_path = ''
as $$
  select case when c.status <> 'archived' then c.id end
  from public.client_memberships cm
  join public.clients c on c.organization_id = cm.organization_id and c.id = cm.client_id
  where cm.organization_id = org
    and cm.user_id = private.app_user_id()
    and cm.status = 'active'
  order by cm.joined_at, cm.id
  limit 1
$$;

create function private.is_client_of(org text, client text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select client is not null and client = private.client_id_for(org)
$$;

-- Team side of canViewProject: owners and managers see every project, members their assigned ones,
-- billing managers none.
create function private.can_view_project_as_team(project text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.projects p
    join public.memberships m
      on m.organization_id = p.organization_id
     and m.user_id = private.app_user_id()
     and m.status = 'active'
    where p.id = project
      and (
        m.role in ('owner', 'manager')
        or (
          m.role = 'member'
          and exists (
            select 1 from public.project_members pm
            where pm.project_id = p.id and pm.user_id = m.user_id
          )
        )
      )
  )
$$;

-- Client side of canViewProject: shared projects of the user's own client.
create function private.can_view_project_as_client(project text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = project
      and p.shared_with_client
      and p.client_id is not null
      and p.client_id = private.client_id_for(p.organization_id)
  )
$$;

create function private.can_view_project(project text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select private.can_view_project_as_team(project) or private.can_view_project_as_client(project)
$$;

-- visibleTasks: team members who can see the project, or client users for client_visible tasks.
create function private.can_view_task(task text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tasks t
    where t.id = task
      and (
        private.can_view_project_as_team(t.project_id)
        or (t.client_visible and private.can_view_project_as_client(t.project_id))
      )
  )
$$;

-- canViewDeliverable: clients never see a deliverable that was never submitted.
create function private.can_view_deliverable(deliverable text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.deliverables d
    where d.id = deliverable
      and (
        private.can_view_project_as_team(d.project_id)
        or (
          (d.status <> 'draft' or d.submitted_at is not null)
          and private.can_view_project_as_client(d.project_id)
        )
      )
  )
$$;

-- isVersionSentToClient: while a new draft is prepared, its (current) version stays private.
create function private.can_view_deliverable_version(deliverable text, version_number integer)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.deliverables d
    where d.id = deliverable
      and (
        private.can_view_project_as_team(d.project_id)
        or (
          (d.status <> 'draft' or (d.submitted_at is not null and version_number < d.current_version))
          and private.can_view_project_as_client(d.project_id)
        )
      )
  )
$$;

-- Profiles: yourself; for team members everyone in the workspace (team and client users); for
-- client users the agency team plus the people of their own client (not other clients' contacts).
create function private.can_see_profile(profile text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  with me as (select private.app_user_id() as id)
  select exists (select 1 from me where me.id = profile)
    or exists (
      select 1
      from public.memberships mine
      where mine.user_id = (select me.id from me)
        and mine.status = 'active'
        and (
          exists (select 1 from public.memberships t where t.organization_id = mine.organization_id and t.user_id = profile)
          or exists (select 1 from public.client_memberships t where t.organization_id = mine.organization_id and t.user_id = profile)
        )
    )
    or exists (
      select 1
      from public.client_memberships mine
      where mine.user_id = (select me.id from me)
        and mine.status = 'active'
        and (
          exists (select 1 from public.memberships t where t.organization_id = mine.organization_id and t.user_id = profile)
          or exists (select 1 from public.client_memberships t where t.client_id = mine.client_id and t.user_id = profile)
        )
    )
$$;

revoke all on all functions in schema private from public, anon;
grant usage on schema private to authenticated, service_role;
grant execute on all functions in schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Row-level security: SELECT policies only. No insert/update/delete policies on purpose.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.clients enable row level security;
alter table public.client_memberships enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.milestones enable row level security;
alter table public.tasks enable row level security;
alter table public.deliverables enable row level security;
alter table public.deliverable_versions enable row level security;
alter table public.approvals enable row level security;
alter table public.comments enable row level security;
alter table public.project_files enable row level security;
alter table public.activity_events enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.audit_logs enable row level security;
alter table public.subscriptions enable row level security;
alter table public.invoices enable row level security;
alter table public.webhook_events enable row level security;
alter table public.integrations enable row level security;

create policy "profiles: self and people you work with" on public.profiles
  for select to authenticated
  using (auth_user_id = (select auth.uid()) or private.can_see_profile(id));

create policy "organizations: team members and client users" on public.organizations
  for select to authenticated
  using (private.org_role(id) is not null or private.client_id_for(id) is not null);

create policy "memberships: own rows and the workspace team" on public.memberships
  for select to authenticated
  using (user_id = (select private.app_user_id()) or private.org_role(organization_id) is not null);

create policy "invitations: owners and managers" on public.invitations
  for select to authenticated
  using (private.org_role(organization_id) in ('owner', 'manager'));

create policy "clients: team (not billing) and the client's own users" on public.clients
  for select to authenticated
  using (
    private.org_role(organization_id) in ('owner', 'manager', 'member')
    or private.is_client_of(organization_id, id)
  );

create policy "client_memberships: team (not billing) and own rows" on public.client_memberships
  for select to authenticated
  using (
    user_id = (select private.app_user_id())
    or private.org_role(organization_id) in ('owner', 'manager', 'member')
  );

create policy "projects: visible projects" on public.projects
  for select to authenticated
  using (private.can_view_project(id));

create policy "project_members: visible projects" on public.project_members
  for select to authenticated
  using (private.can_view_project(project_id));

create policy "milestones: visible projects" on public.milestones
  for select to authenticated
  using (private.can_view_project(project_id));

create policy "tasks: team, or client-visible tasks for clients" on public.tasks
  for select to authenticated
  using (
    private.can_view_project_as_team(project_id)
    or (client_visible and private.can_view_project_as_client(project_id))
  );

create policy "deliverables: team, or submitted ones for clients" on public.deliverables
  for select to authenticated
  using (
    private.can_view_project_as_team(project_id)
    or ((status <> 'draft' or submitted_at is not null) and private.can_view_project_as_client(project_id))
  );

create policy "deliverable_versions: via the deliverable" on public.deliverable_versions
  for select to authenticated
  using (private.can_view_deliverable_version(deliverable_id, version));

create policy "approvals: via the deliverable" on public.approvals
  for select to authenticated
  using (private.can_view_deliverable(deliverable_id));

create policy "comments: team, or client comments on what the client can see" on public.comments
  for select to authenticated
  using (
    private.can_view_project_as_team(project_id)
    or (
      visibility = 'client'
      and private.can_view_project_as_client(project_id)
      and (task_id is null or private.can_view_task(task_id))
      and (deliverable_id is null or private.can_view_deliverable(deliverable_id))
    )
  );

create policy "project_files: team, or client files for clients" on public.project_files
  for select to authenticated
  using (
    private.can_view_project_as_team(project_id)
    or (visibility = 'client' and private.can_view_project_as_client(project_id))
  );

create policy "activity_events: visibleActivity" on public.activity_events
  for select to authenticated
  using (
    (project_id is null and private.org_role(organization_id) in ('owner', 'manager', 'member'))
    or (project_id is not null and private.can_view_project_as_team(project_id))
    or (project_id is not null and visibility = 'client' and private.can_view_project_as_client(project_id))
  );

create policy "notifications: own" on public.notifications
  for select to authenticated
  using (recipient_user_id = (select private.app_user_id()));

create policy "notification_preferences: own" on public.notification_preferences
  for select to authenticated
  using (user_id = (select private.app_user_id()));

create policy "audit_logs: owners and managers" on public.audit_logs
  for select to authenticated
  using (private.org_role(organization_id) in ('owner', 'manager'));

create policy "subscriptions: owners and billing managers" on public.subscriptions
  for select to authenticated
  using (private.org_role(organization_id) in ('owner', 'billing'));

create policy "invoices: owners and billing managers" on public.invoices
  for select to authenticated
  using (private.org_role(organization_id) in ('owner', 'billing'));

create policy "integrations: team (not billing)" on public.integrations
  for select to authenticated
  using (private.org_role(organization_id) in ('owner', 'manager', 'member'));

-- webhook_events: RLS on and no policy, so only the service role can read it.

-- ---------------------------------------------------------------------------
-- Grants: anon gets nothing, signed-in users may only SELECT (filtered by RLS),
-- the service role (secret key) keeps full access and bypasses RLS.
-- ---------------------------------------------------------------------------

revoke all on table
  public.profiles, public.organizations, public.memberships, public.invitations, public.clients,
  public.client_memberships, public.projects, public.project_members, public.milestones, public.tasks,
  public.deliverables, public.deliverable_versions, public.approvals, public.comments, public.project_files,
  public.activity_events, public.notifications, public.notification_preferences, public.audit_logs,
  public.subscriptions, public.invoices, public.webhook_events, public.integrations
from anon, authenticated;

grant select on table
  public.profiles, public.organizations, public.memberships, public.invitations,
  public.client_memberships, public.project_members, public.milestones, public.tasks,
  public.deliverables, public.deliverable_versions, public.approvals, public.comments, public.project_files,
  public.activity_events, public.notifications, public.notification_preferences, public.audit_logs,
  public.subscriptions, public.invoices, public.webhook_events, public.integrations
to authenticated;

-- RLS is per row, so internal columns get column grants: client users can read their own client
-- and their shared projects, but never clients.notes or projects.budget_cents (CONVENTIONS rule 3).
-- Browser queries on these two tables must list columns instead of select('*').
grant select (
  id, organization_id, company_name, contact_name, email, phone, website, industry, status, brand_hue, created_at
) on table public.clients to authenticated;

grant select (
  id, organization_id, client_id, name, description, status, icon, start_at, due_at, shared_with_client,
  created_by_user_id, created_at, updated_at
) on table public.projects to authenticated;

grant all on table
  public.profiles, public.organizations, public.memberships, public.invitations, public.clients,
  public.client_memberships, public.projects, public.project_members, public.milestones, public.tasks,
  public.deliverables, public.deliverable_versions, public.approvals, public.comments, public.project_files,
  public.activity_events, public.notifications, public.notification_preferences, public.audit_logs,
  public.subscriptions, public.invoices, public.webhook_events, public.integrations
to service_role;

-- ---------------------------------------------------------------------------
-- Realtime: full old rows on update/delete, and the tables the browser subscribes to.
-- ---------------------------------------------------------------------------

alter table public.notifications replica identity full;
alter table public.tasks replica identity full;
alter table public.deliverables replica identity full;
alter table public.deliverable_versions replica identity full;
alter table public.approvals replica identity full;
alter table public.comments replica identity full;
alter table public.activity_events replica identity full;
alter table public.projects replica identity full;
alter table public.milestones replica identity full;
alter table public.project_files replica identity full;
alter table public.memberships replica identity full;
alter table public.client_memberships replica identity full;
alter table public.invitations replica identity full;

do $$
begin
  if not exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end
$$;

alter publication supabase_realtime add table
  public.notifications, public.tasks, public.deliverables, public.deliverable_versions, public.approvals,
  public.comments, public.activity_events, public.projects, public.milestones, public.project_files,
  public.memberships, public.client_memberships, public.invitations;

-- ---------------------------------------------------------------------------
-- Storage buckets. No storage.objects policies: the server issues signed upload and download
-- URLs with the secret key. Avatars are public (served by public URL), project files are private.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']),
  ('project-files', 'project-files', false, 5368709120, null)
on conflict (id) do nothing;
