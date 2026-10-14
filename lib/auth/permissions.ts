import type { ClientRole, OrgRole } from "@/lib/data/types";

/**
 * Role → permission matrix. This is the single source of truth for what each
 * role may do; the UI reads it to hide controls and every server action and
 * query checks it again before touching data.
 */
export const TEAM_PERMISSIONS = [
  "workspace.view",
  "workspace.update",
  "team.view",
  "team.invite",
  "team.manage_roles",
  "clients.view",
  "clients.manage",
  "clients.manage_access",
  "projects.view_all",
  "projects.view_assigned",
  "projects.create",
  "projects.update",
  "projects.share",
  "tasks.manage",
  "deliverables.upload",
  "deliverables.submit",
  "comments.internal",
  "reports.view",
  "billing.view",
  "billing.manage",
  "audit.view",
  "integrations.manage",
  "data.export",
] as const;

export type TeamPermission = (typeof TEAM_PERMISSIONS)[number];

export const CLIENT_PERMISSIONS = ["portal.view", "portal.comment", "portal.approve"] as const;
export type ClientPermission = (typeof CLIENT_PERMISSIONS)[number];

const TEAM_MATRIX: Record<OrgRole, readonly TeamPermission[]> = {
  owner: TEAM_PERMISSIONS,
  manager: [
    "workspace.view",
    "team.view",
    "team.invite",
    "clients.view",
    "clients.manage",
    "clients.manage_access",
    "projects.view_all",
    "projects.view_assigned",
    "projects.create",
    "projects.update",
    "projects.share",
    "tasks.manage",
    "deliverables.upload",
    "deliverables.submit",
    "comments.internal",
    "reports.view",
    "audit.view",
  ],
  member: [
    "workspace.view",
    "team.view",
    "clients.view",
    "projects.view_assigned",
    "tasks.manage",
    "deliverables.upload",
    "comments.internal",
  ],
  // Billing managers handle invoices and plans but get no project data by default.
  billing: ["workspace.view", "billing.view", "billing.manage"],
};

const CLIENT_MATRIX: Record<ClientRole, readonly ClientPermission[]> = {
  approver: ["portal.view", "portal.comment", "portal.approve"],
  viewer: ["portal.view", "portal.comment"],
};

export function can(role: OrgRole, permission: TeamPermission): boolean {
  return TEAM_MATRIX[role].includes(permission);
}

export function clientCan(role: ClientRole, permission: ClientPermission): boolean {
  return CLIENT_MATRIX[role].includes(permission);
}

export function permissionsFor(role: OrgRole): readonly TeamPermission[] {
  return TEAM_MATRIX[role];
}

/** Which roles a given role is allowed to assign when inviting or editing. */
export function assignableRoles(actor: OrgRole): OrgRole[] {
  if (actor === "owner") return ["owner", "manager", "member", "billing"];
  if (actor === "manager") return ["member"];
  return [];
}

export const ROLE_LABELS: Record<OrgRole, string> = {
  owner: "Owner",
  manager: "Manager",
  member: "Team member",
  billing: "Billing manager",
};

export const ROLE_DESCRIPTIONS: Record<OrgRole, string> = {
  owner: "Full control of the workspace, members, clients, billing and settings.",
  manager: "Runs every project and client, invites team members and reads the audit log.",
  member: "Works on assigned projects: tasks, uploads and internal comments.",
  billing: "Manages plan, payment method and invoices. No access to project data.",
};

export const CLIENT_ROLE_LABELS: Record<ClientRole, string> = {
  approver: "Approver",
  viewer: "Viewer",
};

export const CLIENT_ROLE_DESCRIPTIONS: Record<ClientRole, string> = {
  approver: "Reviews deliverables, comments and gives the final approval.",
  viewer: "Follows progress and comments, but cannot approve.",
};
