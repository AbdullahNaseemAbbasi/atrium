# ADR 0003: Frontend first on an in-memory data layer

Date: 2026-10-15 · Status: accepted

## Context

The product owner asked for the complete frontend (all pages, inner pages
and content) before wiring Supabase. A UI built on hard-coded arrays would
need rewriting later and couldn't show real behaviour (permissions, state
changes, validation).

## Decision

- Pages are React Server Components that call `lib/data/queries/*` and
  mutate through `lib/actions/*` (server actions), exactly as they will with
  Supabase.
- The queries read a typed in-memory database (`lib/data/store.ts`) seeded
  with deterministic synthetic data whose dates are relative to today.
- Access rules, business rules and KPI formulas are pure functions with unit
  tests, so they carry over unchanged.

## Consequences

- The demo behaves like the real product: roles, 404s across tenants, plan
  limits, approval flow, audit log.
- Data resets on server restart; serverless instances each hold their own
  copy. Acceptable for a demo, removed in phase 2.
- Phase 2 replaces the bodies of query/action functions with Supabase calls
  and adds RLS; components don't change.
