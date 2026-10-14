import type { AuditAction, IntegrationKey, NotificationChannel, NotificationGroup } from "@/lib/data/types";

/**
 * Static option lists shared by settings pages, their client forms and the
 * server actions that validate them. Plain data only (safe on the client).
 */

export const TIMEZONES: { value: string; label: string }[] = [
  { value: "Pacific/Honolulu", label: "Honolulu" },
  { value: "America/Anchorage", label: "Anchorage" },
  { value: "America/Los_Angeles", label: "Los Angeles, Vancouver (Pacific)" },
  { value: "America/Denver", label: "Denver (Mountain)" },
  { value: "America/Phoenix", label: "Phoenix" },
  { value: "America/Chicago", label: "Chicago (Central)" },
  { value: "America/Mexico_City", label: "Mexico City" },
  { value: "America/New_York", label: "New York (Eastern)" },
  { value: "America/Toronto", label: "Toronto" },
  { value: "America/Bogota", label: "Bogotá" },
  { value: "America/Sao_Paulo", label: "São Paulo" },
  { value: "UTC", label: "UTC" },
  { value: "Europe/London", label: "London" },
  { value: "Europe/Dublin", label: "Dublin" },
  { value: "Europe/Lisbon", label: "Lisbon" },
  { value: "Europe/Madrid", label: "Madrid" },
  { value: "Europe/Paris", label: "Paris" },
  { value: "Europe/Amsterdam", label: "Amsterdam" },
  { value: "Europe/Berlin", label: "Berlin" },
  { value: "Europe/Stockholm", label: "Stockholm" },
  { value: "Europe/Warsaw", label: "Warsaw" },
  { value: "Europe/Athens", label: "Athens" },
  { value: "Europe/Istanbul", label: "Istanbul" },
  { value: "Africa/Lagos", label: "Lagos" },
  { value: "Africa/Cairo", label: "Cairo" },
  { value: "Africa/Johannesburg", label: "Johannesburg" },
  { value: "Africa/Nairobi", label: "Nairobi" },
  { value: "Asia/Dubai", label: "Dubai" },
  { value: "Asia/Karachi", label: "Karachi" },
  { value: "Asia/Kolkata", label: "Mumbai, New Delhi" },
  { value: "Asia/Dhaka", label: "Dhaka" },
  { value: "Asia/Bangkok", label: "Bangkok" },
  { value: "Asia/Singapore", label: "Singapore" },
  { value: "Asia/Hong_Kong", label: "Hong Kong" },
  { value: "Asia/Shanghai", label: "Shanghai" },
  { value: "Asia/Tokyo", label: "Tokyo" },
  { value: "Asia/Seoul", label: "Seoul" },
  { value: "Australia/Perth", label: "Perth" },
  { value: "Australia/Sydney", label: "Sydney" },
  { value: "Pacific/Auckland", label: "Auckland" },
];

export const TIMEZONE_VALUES = new Set(TIMEZONES.map((zone) => zone.value));

export function timezoneLabel(value: string) {
  const zone = TIMEZONES.find((item) => item.value === value);
  return zone ? `${zone.label} · ${zone.value}` : value;
}

export const HUE_PRESETS = [192, 220, 265, 300, 330, 355, 20, 48, 100, 150];

export const INDUSTRIES = [
  "Design & development agency",
  "Product design studio",
  "Marketing agency",
  "Branding studio",
  "Video & motion studio",
  "Consultancy",
  "Freelancer",
  "Other",
];

/* ---------- Notifications ---------- */

export const NOTIFICATION_GROUPS: { key: NotificationGroup; label: string; description: string }[] = [
  { key: "approvals", label: "Approvals", description: "Work sent for review, approvals and change requests." },
  { key: "comments", label: "Comments", description: "Mentions and replies on tasks and deliverables." },
  { key: "tasks", label: "Tasks", description: "New assignments and due-date reminders." },
  { key: "milestones", label: "Milestones", description: "Milestones completed or waiting on approval." },
  { key: "billing", label: "Billing", description: "Invoices, failed payments and plan changes." },
  { key: "team", label: "Team", description: "Accepted invitations and role changes." },
];

export const NOTIFICATION_CHANNELS: { key: NotificationChannel; label: string }[] = [
  { key: "inApp", label: "In-app" },
  { key: "email", label: "Email" },
];

export const DIGEST_OPTIONS = [
  { value: "off", label: "Off", description: "Only the notifications switched on above." },
  { value: "daily", label: "Daily", description: "One summary at 8:00 in your timezone." },
  { value: "weekly", label: "Weekly", description: "One summary on Monday at 8:00." },
] as const;

export type DigestValue = (typeof DIGEST_OPTIONS)[number]["value"];

/* ---------- Integrations ---------- */

export interface IntegrationMeta {
  key: Exclude<IntegrationKey, "stripe">;
  name: string;
  hue: number;
  description: string;
  accountLabel: string;
  accountPlaceholder: string;
  accountHint: string;
}

export const INTEGRATIONS: IntegrationMeta[] = [
  {
    key: "slack",
    name: "Slack",
    hue: 330,
    description: "Post approvals, change requests and overdue tasks to a channel.",
    accountLabel: "Channel",
    accountPlaceholder: "#client-updates",
    accountHint: "Atrium posts here. Private channels need the app invited first.",
  },
  {
    key: "google_drive",
    name: "Google Drive",
    hue: 140,
    description: "Attach Drive files to deliverables without downloading them.",
    accountLabel: "Shared drive",
    accountPlaceholder: "Studio Shared Drive",
    accountHint: "Files stay in Drive. Atrium stores links and names only.",
  },
  {
    key: "figma",
    name: "Figma",
    hue: 18,
    description: "Embed Figma frames as deliverable previews for client review.",
    accountLabel: "Figma team",
    accountPlaceholder: "Studio Design Team",
    accountHint: "Clients see the frame preview, not your Figma files.",
  },
  {
    key: "github",
    name: "GitHub",
    hue: 220,
    description: "Link pull requests to tasks and close tasks when they merge.",
    accountLabel: "Organization",
    accountPlaceholder: "studio-dev",
    accountHint: "Read-only access to pull request titles and status.",
  },
  {
    key: "zapier",
    name: "Zapier",
    hue: 28,
    description: "Trigger Zaps when a client approves work or a milestone completes.",
    accountLabel: "Zapier account",
    accountPlaceholder: "ops@studio.example",
    accountHint: "Each Zap gets its own revocable token.",
  },
];

/* ---------- Audit log ---------- */

/** Action recorded when a platform operator opens the support view. */
export const SUPPORT_ACCESS_ACTION = "support.accessed" satisfies AuditAction;

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  "member.invited": "Member invited",
  "member.role_changed": "Role changed",
  "member.removed": "Member removed",
  "invitation.revoked": "Invitation revoked",
  "client.created": "Client created",
  "client.access_granted": "Client access granted",
  "client.access_revoked": "Client access revoked",
  "project.created": "Project created",
  "project.shared": "Project shared",
  "project.unshared": "Project unshared",
  "deliverable.approved": "Deliverable approved",
  "deliverable.changes_requested": "Changes requested",
  "file.downloaded": "File downloaded",
  "file.deleted": "File deleted",
  "data.exported": "Data exported",
  "billing.plan_changed": "Plan changed",
  "billing.payment_failed": "Payment failed",
  "workspace.created": "Workspace created",
  "workspace.updated": "Workspace updated",
  "invitation.accepted": "Invitation accepted",
  "integration.connected": "Integration connected",
  "integration.disconnected": "Integration disconnected",
  "auth.sign_in": "Signed in",
  [SUPPORT_ACCESS_ACTION]: "Support access",
};

export function auditActionLabel(action: string) {
  return (AUDIT_ACTION_LABELS as Record<string, string>)[action] ?? action;
}
