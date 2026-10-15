-- Live updates for the rest of the data people see on screen.
--
-- The browser keeps visited pages for 30 seconds (staleTimes in next.config.ts). A change in
-- any of these tables now reaches open tabs through Realtime, which refreshes the screen and
-- empties that cache, so a page someone else changed is never served from it. Row-level
-- security still decides which rows each person receives.
--
-- Left out on purpose: audit_logs (high volume; the audit log page is never cached),
-- notification_preferences (only ever changed by their owner) and webhook_events (no
-- browser access at all).

alter publication supabase_realtime add table
  public.profiles, public.organizations, public.clients, public.project_members,
  public.subscriptions, public.invoices, public.integrations;

-- Same as the tables published in the first migration: updates carry the old row too.
alter table public.profiles replica identity full;
alter table public.organizations replica identity full;
alter table public.clients replica identity full;
alter table public.project_members replica identity full;
alter table public.subscriptions replica identity full;
alter table public.invoices replica identity full;
alter table public.integrations replica identity full;
