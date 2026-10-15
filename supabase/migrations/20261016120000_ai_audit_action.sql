-- AI drafts are logged in the audit log: each one sends workspace text to the AI provider,
-- and the daily AI allowance per workspace is counted from these entries.

alter table public.audit_logs drop constraint audit_logs_action_check;

alter table public.audit_logs add constraint audit_logs_action_check check (action in (
  'member.invited', 'member.role_changed', 'member.removed', 'invitation.revoked',
  'client.created', 'client.access_granted', 'client.access_revoked',
  'project.created', 'project.shared', 'project.unshared',
  'deliverable.approved', 'deliverable.changes_requested',
  'file.downloaded', 'file.deleted', 'data.exported',
  'billing.plan_changed', 'billing.payment_failed',
  'workspace.created', 'workspace.updated', 'invitation.accepted',
  'integration.connected', 'integration.disconnected', 'support.accessed', 'auth.sign_in',
  'ai.generated'
));
