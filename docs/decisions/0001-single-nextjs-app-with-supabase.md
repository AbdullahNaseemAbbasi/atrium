# ADR 0001: One Next.js app on Supabase instead of Next.js + NestJS

Date: 2026-10-15 · Status: accepted

## Context

The brief suggested Next.js + NestJS + Postgres/Prisma + Redis/BullMQ, and
listed Supabase as an alternative. The product owner chose Supabase for the
database and backend services, and wants the frontend built first.

## Decision

Build Atrium as a single Next.js 16 application:

- Supabase Auth for identity (phase 2). Until then a signed demo session
  cookie behind the same Data Access Layer functions.
- Supabase Postgres with row-level security as the second line of tenant
  isolation; application checks in `lib/data/access.ts` stay as the first.
- Supabase Storage (private bucket) for files with signed upload and
  download URLs.
- Supabase Realtime for live notifications and board updates.
- Stripe in test mode for billing, with verified, idempotent webhooks
  handled by a Next.js route handler.
- No separate NestJS service and no Redis for now. Background work the
  portal needs (notification emails, digests) runs from database triggers,
  Supabase cron or route handlers.

## Consequences

- One deploy (Vercel + Supabase), one auth system, no CORS between two
  servers.
- Pages talk only to `lib/data/queries/*` and `lib/actions/*`, so swapping
  the in-memory store for Supabase touches the data layer, not the UI.
- If heavy background processing is needed later (Project 1's automation
  engine), a worker can be added without changing this app's structure.
