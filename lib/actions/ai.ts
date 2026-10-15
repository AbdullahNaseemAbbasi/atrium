"use server";

import { requireTeamContext } from "@/lib/auth/context";
import { canWorkOnProject, getVisibleDeliverable, getVisibleProject, type TeamContext } from "@/lib/data/access";
import { recordAudit } from "@/lib/data/events";
import { getDb, saveDb } from "@/lib/data/store";
import type { Database } from "@/lib/data/types";
import { aiProvider } from "@/lib/ai/config";
import { AiUnavailableError, generateText, type AiRequest } from "@/lib/ai/provider";
import { clientSideOf, clientUpdateContext, deliverableContext } from "@/lib/ai/context";
import { clientUpdatePrompt, feedbackSummaryPrompt, replyDraftPrompt } from "@/lib/ai/prompts";
import { aiAllowance } from "@/lib/ai/usage";

/**
 * AI drafts. Each one is a suggestion a person reads before using it: nothing
 * is posted or sent automatically. Access is checked like any other action
 * (team members who work on the project), the daily allowance is enforced,
 * and every draft leaves an audit log entry naming the provider and model.
 */
export type AiDraftResult = { ok: true; text: string } | { ok: false; message: string };

type Feature = "feedback_summary" | "reply_draft" | "client_update";

const FEATURE_TEXT: Record<Feature, string> = {
  feedback_summary: "feedback summary",
  reply_draft: "reply draft",
  client_update: "client update",
};

async function draft(
  ctx: TeamContext,
  db: Database,
  feature: Feature,
  target: { type: string; id: string; label: string },
  request: AiRequest,
): Promise<AiDraftResult> {
  if (!aiProvider()) return { ok: false, message: "AI drafting isn't set up for this workspace." };
  const allowance = aiAllowance(db, ctx.org.id, ctx.user.id, new Date());
  if (!allowance.ok) return allowance;
  try {
    const result = await generateText(request);
    recordAudit(db, ctx, {
      action: "ai.generated",
      entityType: target.type,
      entityId: target.id,
      summary: `AI wrote a ${FEATURE_TEXT[feature]} for ${target.label}`,
      metadata: { feature, provider: result.provider, model: result.model },
    });
    await saveDb();
    return { ok: true, text: result.text };
  } catch (error) {
    if (error instanceof AiUnavailableError) return { ok: false, message: error.message };
    throw error;
  }
}

/** The deliverable and its project, if this person works on it. */
async function loadDeliverable(orgSlug: string, deliverableId: string) {
  const ctx = await requireTeamContext(orgSlug);
  const db = await getDb();
  const deliverable = getVisibleDeliverable(db, ctx, deliverableId);
  const project = deliverable ? getVisibleProject(db, ctx, deliverable.projectId) : null;
  if (!deliverable || !project || deliverable.organizationId !== ctx.org.id || !canWorkOnProject(db, ctx, project)) return null;
  return { ctx, db, deliverable, project };
}

/** For the team: the client's change requests on a deliverable, as a checklist. */
export async function summarizeFeedback(orgSlug: string, deliverableId: string): Promise<AiDraftResult> {
  const loaded = await loadDeliverable(orgSlug, deliverableId);
  if (!loaded) return { ok: false, message: "You can't use AI on this deliverable." };
  const { ctx, db, deliverable, project } = loaded;
  const context = deliverableContext(db, ctx, deliverable, project);
  if (context.comments.length === 0 && context.decisions.length === 0) {
    return { ok: false, message: "There's no feedback to summarize yet." };
  }
  return draft(ctx, db, "feedback_summary", { type: "deliverable", id: deliverable.id, label: deliverable.title }, feedbackSummaryPrompt(context));
}

/** A reply to the client's latest comment. Built only from what the client can already see. */
export async function draftReply(orgSlug: string, deliverableId: string): Promise<AiDraftResult> {
  const loaded = await loadDeliverable(orgSlug, deliverableId);
  if (!loaded) return { ok: false, message: "You can't use AI on this deliverable." };
  const { ctx, db, deliverable, project } = loaded;
  const context = deliverableContext(db, ctx, deliverable, project);
  if (!context.comments.some((comment) => comment.fromClient && !comment.internal)) {
    return { ok: false, message: "There's no client comment to reply to yet." };
  }
  return draft(ctx, db, "reply_draft", { type: "deliverable", id: deliverable.id, label: deliverable.title }, replyDraftPrompt(clientSideOf(context, deliverable), ctx.user.name));
}

/** A weekly update for the client, from client-visible tasks, milestones and deliverables only. */
export async function draftClientUpdate(orgSlug: string, projectId: string): Promise<AiDraftResult> {
  const ctx = await requireTeamContext(orgSlug);
  const db = await getDb();
  const project = getVisibleProject(db, ctx, projectId);
  if (!project || project.organizationId !== ctx.org.id || !canWorkOnProject(db, ctx, project)) {
    return { ok: false, message: "You can't use AI on this project." };
  }
  const client = project.clientId ? db.clients.find((item) => item.id === project.clientId) : undefined;
  if (!client) return { ok: false, message: "Internal projects have no client to update." };

  const context = clientUpdateContext(db, ctx, project, client, new Date());
  return draft(ctx, db, "client_update", { type: "project", id: project.id, label: project.name }, clientUpdatePrompt(context));
}
