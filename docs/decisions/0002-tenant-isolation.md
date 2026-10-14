# ADR 0002: Tenant isolation in two layers

Date: 2026-10-15 · Status: accepted

## Decision

1. **Application layer (now):** the active organization is resolved from a
   verified membership (`requireTeamContext` / `requireClientContext`).
   Every query uses helpers in `lib/data/access.ts`; every action re-checks
   the context and that each referenced id belongs to the tenant. Rows the
   viewer can't see return 404.
2. **Database layer (Supabase phase):** RLS policies on every tenant table
   mirror the same rules, for example:

```sql
create policy "members read projects" on projects for select using (
  exists (
    select 1 from memberships m
    where m.organization_id = projects.organization_id
      and m.user_id = auth.uid() and m.status = 'active'
      and (m.role in ('owner','manager')
           or (m.role = 'member' and exists (
                 select 1 from project_members pm
                 where pm.project_id = projects.id and pm.user_id = auth.uid())))
  )
  or exists (
    select 1 from client_memberships cm
    where cm.organization_id = projects.organization_id
      and cm.client_id = projects.client_id
      and cm.user_id = auth.uid() and cm.status = 'active'
      and projects.shared_with_client
  )
);
```

Composite foreign keys `(organization_id, id)` prevent cross-tenant
references even from server code using the service role.

## Why both

RLS alone can't produce good UX (404 vs friendly messages, redirects for
client users) and is easy to bypass by accident with the service role.
Application checks alone have no backstop. Tests in `tests/access.test.ts`
pin the rules so both layers can be checked against the same cases.
