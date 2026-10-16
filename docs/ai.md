# AI drafts

Atrium uses AI for three drafts. Each one appears on screen for a person to
read; nothing is posted or sent to a client automatically.

| Draft | Where | Who | What it reads |
|---|---|---|---|
| Feedback summary | Deliverable page, side column | Team members who work on the project | Versions and their notes, approval decisions, every comment including internal notes |
| Reply draft | "Draft a reply" in the deliverable's comment box | Same | Only what the client can see: client-visible comments, decisions, versions they were sent |
| Client update | Project overview | Same, on client projects | Client-visible tasks (done this week, in progress, due in two weeks), milestones, deliverables the client was sent; never budgets, internal tasks, internal notes or unsent drafts |

The summary can be copied or posted as an internal note. The reply fills
the comment box and the person edits and posts it. The update can be copied.

## Providers

`lib/ai/provider.ts` is a small adapter; features call `generateText()`.

- **Claude** when `ANTHROPIC_API_KEY` is set: `claude-opus-5-5` at low
  effort, with server-side refusal fallback enabled.
- **Gemini** otherwise, when `GEMINI_API_KEY` is set (free tier):
  `gemini-3.6-flash` with minimal thinking, then `gemini-3.5-flash`, then
  `gemini-3.5-flash-lite`. A model that is busy (503), over its quota (429),
  failing (500), cancelled or timed out upstream (499, 504) or silent past
  the timeout hands over to the next one. Free-tier quotas are per model, so
  the chain also spreads the load.
- No key: the AI buttons don't render and the actions refuse.

Keys are read only on the server and never reach the browser. One attempt
per model, 45 second timeout. People see plain messages ("The AI service is
busy"), never provider errors.

## Safety

- **Access:** the server actions (`lib/actions/ai.ts`) run the same checks
  as other actions: an active team membership and `canWorkOnProject`.
  Client users and billing managers can't use them.
- **What leaves the app:** `lib/ai/context.ts` builds the material and
  `lib/ai/prompts.ts` the prompts, both pure functions covered by
  `tests/ai.test.ts`, including tests that client-facing drafts never
  contain internal notes, internal tasks, unsent work or budgets.
- **Prompt injection:** everything people wrote is fenced in tags with `<`,
  `>` and `&` escaped, and the instructions say text inside tags is
  material, never instructions. Output is rendered as plain text.
- **Allowance:** 30 drafts per workspace and 15 per person per UTC day
  (`lib/ai/usage.ts`), so a busy demo can't use up the provider quota.
- **Audit:** every draft adds an `ai.generated` audit log entry with the
  feature, provider and model. The allowance is counted from these.
- **Gemini free tier:** Google may use prompts on the free tier to improve
  its models. The demo data is synthetic; for real client data, enable
  billing on the Google project (or use Claude).
