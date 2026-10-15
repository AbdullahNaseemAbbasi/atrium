import type { Database } from "@/lib/data/types";

/**
 * Daily allowance of AI drafts, so a busy demo (or one person) can't use up
 * the provider's quota for everyone. Counted from the audit log entries each
 * draft leaves, per UTC day.
 */
export const AI_DAILY_LIMITS = { workspace: 30, person: 15 } as const;

export function aiAllowance(db: Database, orgId: string, userId: string, now: Date): { ok: true } | { ok: false; message: string } {
  const since = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const today = db.auditLogs.filter((log) => log.organizationId === orgId && log.action === "ai.generated" && Date.parse(log.createdAt) >= since);
  if (today.length >= AI_DAILY_LIMITS.workspace) {
    return { ok: false, message: `This workspace has used today's ${AI_DAILY_LIMITS.workspace} AI drafts. More are available tomorrow.` };
  }
  if (today.filter((log) => log.actorUserId === userId).length >= AI_DAILY_LIMITS.person) {
    return { ok: false, message: `You've used your ${AI_DAILY_LIMITS.person} AI drafts for today. More are available tomorrow.` };
  }
  return { ok: true };
}
