/**
 * Domain model for Atrium.
 *
 * Mirrors the planned Postgres schema (see docs/data-model.md). Every
 * tenant-owned record carries `organizationId`; dates are ISO strings so rows
 * can cross the server/client boundary without conversion.
 */

export type ID = string;
export type ISODate = string;

/* ---------- Identity & tenancy ---------- */

export type OrgRole = "owner" | "manager" | "member" | "billing";
export type ClientRole = "approver" | "viewer";
export type MembershipStatus = "active" | "suspended";

export interface User {
  id: ID;
  name: string;
  email: string;
  title?: string;
  /** Hue (0-360) used for the generated avatar. */
  avatarHue: number;
  timezone: string;
  isPlatformAdmin?: boolean;
  createdAt: ISODate;
  lastActiveAt?: ISODate;
}

export interface Organization {
  id: ID;
  name: string;
  slug: string;
  timezone: string;
  industry: string;
  website?: string;
  brandHue: number;
  createdAt: ISODate;
}

export interface Membership {
  id: ID;
  organizationId: ID;
  userId: ID;
  role: OrgRole;
  status: MembershipStatus;
  joinedAt: ISODate;
}

export type InvitationKind = "team" | "client";
export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";

export interface Invitation {
  id: ID;
  organizationId: ID;
  email: string;
  kind: InvitationKind;
  role: OrgRole | ClientRole;
  /** Set when kind === "client". */
  clientId?: ID;
  status: InvitationStatus;
  invitedByUserId: ID;
  createdAt: ISODate;
  expiresAt: ISODate;
  acceptedAt?: ISODate;
}

/* ---------- Clients ---------- */

export type ClientStatus = "active" | "onboarding" | "paused" | "archived";

export interface Client {
  id: ID;
  organizationId: ID;
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  website?: string;
  industry: string;
  status: ClientStatus;
  brandHue: number;
  notes?: string;
  createdAt: ISODate;
}

/** Links a portal user to one client of one organization. */
export interface ClientMembership {
  id: ID;
  organizationId: ID;
  clientId: ID;
  userId: ID;
  role: ClientRole;
  status: MembershipStatus;
  joinedAt: ISODate;
}

/* ---------- Projects ---------- */

export type ProjectStatus = "planning" | "in_progress" | "in_review" | "on_hold" | "completed" | "cancelled";
export type ProjectIcon = "globe" | "smartphone" | "palette" | "cart" | "megaphone" | "heart" | "search" | "layers";

export interface Project {
  id: ID;
  organizationId: ID;
  clientId: ID | null;
  name: string;
  description: string;
  status: ProjectStatus;
  icon: ProjectIcon;
  startAt?: ISODate;
  dueAt?: ISODate;
  /** Client users only see a project when this is true AND it belongs to their client. */
  sharedWithClient: boolean;
  budgetCents?: number;
  createdByUserId: ID;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export type ProjectRole = "lead" | "contributor";

export interface ProjectMember {
  id: ID;
  organizationId: ID;
  projectId: ID;
  userId: ID;
  projectRole: ProjectRole;
}

export type MilestoneStatus = "upcoming" | "in_progress" | "awaiting_approval" | "completed";

export interface Milestone {
  id: ID;
  organizationId: ID;
  projectId: ID;
  title: string;
  description?: string;
  position: number;
  dueAt?: ISODate;
  status: MilestoneStatus;
  /** When true, the milestone completes only after every deliverable in it is approved. */
  approvalRequired: boolean;
  completedAt?: ISODate;
}

export type TaskStatus = "todo" | "in_progress" | "in_review" | "blocked" | "done";
export type Priority = "low" | "medium" | "high" | "urgent";

export interface Task {
  id: ID;
  organizationId: ID;
  projectId: ID;
  milestoneId?: ID;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  dueAt?: ISODate;
  assigneeUserId?: ID;
  createdByUserId: ID;
  /** Internal tasks stay hidden from the client portal. */
  clientVisible: boolean;
  createdAt: ISODate;
  completedAt?: ISODate;
}

/* ---------- Deliverables & approvals ---------- */

export type DeliverableStatus = "draft" | "in_review" | "changes_requested" | "approved";

export interface Deliverable {
  id: ID;
  organizationId: ID;
  projectId: ID;
  milestoneId?: ID;
  title: string;
  description?: string;
  status: DeliverableStatus;
  currentVersion: number;
  createdByUserId: ID;
  createdAt: ISODate;
  updatedAt: ISODate;
  submittedAt?: ISODate;
}

/** One uploaded file. Deliverables keep every version; approvals pin a version. */
export interface DeliverableVersion {
  id: ID;
  organizationId: ID;
  deliverableId: ID;
  version: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /** Private object-storage key. Never a public URL. */
  storageKey: string;
  note?: string;
  uploadedByUserId: ID;
  createdAt: ISODate;
}

export type ApprovalDecision = "approved" | "changes_requested";

export interface Approval {
  id: ID;
  organizationId: ID;
  deliverableId: ID;
  versionId: ID;
  version: number;
  clientUserId: ID;
  decision: ApprovalDecision;
  comment?: string;
  decidedAt: ISODate;
}

export type Visibility = "internal" | "client";

export interface Comment {
  id: ID;
  organizationId: ID;
  projectId: ID;
  taskId?: ID;
  deliverableId?: ID;
  authorUserId: ID;
  body: string;
  /** Internal comments are never sent to client users. */
  visibility: Visibility;
  createdAt: ISODate;
  editedAt?: ISODate;
}

export interface ProjectFile {
  id: ID;
  organizationId: ID;
  projectId: ID;
  name: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  visibility: Visibility;
  uploadedByUserId: ID;
  createdAt: ISODate;
}

/* ---------- Activity, notifications, audit ---------- */

export type ActivityVerb =
  | "project.created"
  | "project.status_changed"
  | "task.created"
  | "task.completed"
  | "deliverable.uploaded"
  | "deliverable.submitted"
  | "deliverable.approved"
  | "deliverable.changes_requested"
  | "milestone.completed"
  | "comment.posted"
  | "file.uploaded"
  | "member.invited"
  | "client.added";

export interface ActivityEvent {
  id: ID;
  organizationId: ID;
  projectId?: ID;
  actorUserId?: ID;
  verb: ActivityVerb;
  targetType: "project" | "task" | "deliverable" | "milestone" | "comment" | "file" | "member" | "client";
  targetId: ID;
  targetLabel: string;
  visibility: Visibility;
  createdAt: ISODate;
}

export type NotificationType =
  | "deliverable.submitted"
  | "deliverable.approved"
  | "deliverable.changes_requested"
  | "comment.mention"
  | "comment.posted"
  | "task.assigned"
  | "task.due_soon"
  | "milestone.completed"
  | "invitation.accepted"
  | "billing.payment_failed"
  | "billing.invoice_paid";

export interface Notification {
  id: ID;
  organizationId: ID;
  recipientUserId: ID;
  type: NotificationType;
  title: string;
  body: string;
  href: string;
  readAt?: ISODate;
  /** Same key within a short window collapses into one notification. */
  deduplicationKey?: string;
  createdAt: ISODate;
}

export type NotificationChannel = "inApp" | "email";

export interface NotificationPreference {
  userId: ID;
  organizationId: ID;
  /** Notification groups the user muted, per channel. */
  muted: Record<NotificationChannel, NotificationGroup[]>;
  digest: "off" | "daily" | "weekly";
}

export type NotificationGroup = "approvals" | "comments" | "tasks" | "milestones" | "billing" | "team";

export type AuditAction =
  | "member.invited"
  | "member.role_changed"
  | "member.removed"
  | "invitation.revoked"
  | "client.created"
  | "client.access_granted"
  | "client.access_revoked"
  | "project.created"
  | "project.shared"
  | "project.unshared"
  | "deliverable.approved"
  | "deliverable.changes_requested"
  | "file.downloaded"
  | "file.deleted"
  | "data.exported"
  | "billing.plan_changed"
  | "billing.payment_failed"
  | "workspace.created"
  | "workspace.updated"
  | "invitation.accepted"
  | "integration.connected"
  | "integration.disconnected"
  | "support.accessed"
  | "auth.sign_in";

export interface AuditLog {
  id: ID;
  organizationId: ID;
  actorUserId?: ID;
  action: AuditAction;
  entityType: string;
  entityId: ID;
  summary: string;
  metadata: Record<string, string | number | boolean>;
  ip?: string;
  createdAt: ISODate;
}

/* ---------- Billing ---------- */

export type PlanKey = "starter" | "professional" | "agency";
export type BillingInterval = "month" | "year";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled" | "incomplete";

export interface Subscription {
  id: ID;
  organizationId: ID;
  planKey: PlanKey;
  status: SubscriptionStatus;
  interval: BillingInterval;
  currentPeriodEnd: ISODate;
  cancelAtPeriodEnd: boolean;
  trialEndsAt?: ISODate;
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  paymentMethod?: { brand: string; last4: string; expMonth: number; expYear: number };
}

export type InvoiceStatus = "paid" | "open" | "void" | "uncollectible";

export interface Invoice {
  id: ID;
  organizationId: ID;
  number: string;
  amountCents: number;
  currency: string;
  status: InvoiceStatus;
  periodStart: ISODate;
  periodEnd: ISODate;
  issuedAt: ISODate;
}

export type WebhookStatus = "processed" | "skipped_duplicate" | "failed";

export interface WebhookEvent {
  id: ID;
  provider: "stripe";
  providerEventId: string;
  eventType: string;
  organizationId?: ID;
  status: WebhookStatus;
  receivedAt: ISODate;
  processedAt?: ISODate;
}

/* ---------- Integrations ---------- */

export type IntegrationKey = "slack" | "google_drive" | "figma" | "github" | "zapier" | "stripe";

export interface IntegrationConnection {
  organizationId: ID;
  key: IntegrationKey;
  connectedAt: ISODate;
  connectedByUserId: ID;
  account: string;
}

/* ---------- The whole in-memory database ---------- */

export interface Database {
  users: User[];
  organizations: Organization[];
  memberships: Membership[];
  invitations: Invitation[];
  clients: Client[];
  clientMemberships: ClientMembership[];
  projects: Project[];
  projectMembers: ProjectMember[];
  milestones: Milestone[];
  tasks: Task[];
  deliverables: Deliverable[];
  deliverableVersions: DeliverableVersion[];
  approvals: Approval[];
  comments: Comment[];
  files: ProjectFile[];
  activity: ActivityEvent[];
  notifications: Notification[];
  notificationPreferences: NotificationPreference[];
  auditLogs: AuditLog[];
  subscriptions: Subscription[];
  invoices: Invoice[];
  webhookEvents: WebhookEvent[];
  integrations: IntegrationConnection[];
}
