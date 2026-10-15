import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";
import { CLIENT_ROLE_LABELS, ROLE_LABELS, can, clientCan, type ClientPermission, type TeamPermission } from "@/lib/auth/permissions";
import type { ClientRole, OrgRole } from "@/lib/data/types";
import { cn } from "@/lib/utils";
import { Container, CtaBand, PageIntro, ScreenshotFrame, SectionHeading } from "@/components/marketing/primitives";

export const metadata: Metadata = {
  title: "Features",
  description:
    "What's in the Atrium team workspace and client portal: projects, milestones, tasks, versioned deliverables, approvals, roles, billing and an audit log.",
};

const TEAM_FEATURES = [
  {
    title: "Projects",
    text: "A project has a client, a lead, start and due dates, a status and an optional budget that only your team sees. You decide when to share it with the client.",
  },
  {
    title: "Tasks",
    text: "Move tasks between To do, In progress, In review, Blocked and Done on a board, or use the list or the calendar. Overdue tasks are flagged in red.",
  },
  {
    title: "Milestones",
    text: "Group the work into phases. If a milestone needs the client's approval, it only closes once every deliverable in it has been approved.",
  },
  {
    title: "Deliverables and versions",
    text: "Each upload becomes a new version with a note on what changed. It stays a draft until the project lead or a manager sends it to the client.",
  },
  {
    title: "Comments",
    text: "Write to the client, or leave an internal note for your team on the same file. Internal notes are never shown in the portal.",
  },
  {
    title: "Project files",
    text: "Briefs, contracts and source files live with the project. Each one is either internal or shared with the client.",
  },
];

const CLIENT_FEATURES = [
  {
    title: "Their own projects",
    text: "A client user sees the projects you've shared with their company, the tasks you've marked visible and the versions you've sent.",
  },
  {
    title: "Approve or ask for changes",
    text: "Approvers decide on the version in front of them. Asking for changes needs a comment, so your team knows what to fix.",
  },
  {
    title: "Downloads",
    text: "Each download link is checked against the person's access and stops working after 60 seconds, so a forwarded link is no use to anyone else.",
  },
  {
    title: "Notifications",
    text: "Clients hear about it when work is ready for review or when your team replies to them.",
  },
];

const BUSINESS_FEATURES = [
  {
    title: "Dashboard",
    text: "Active projects, tasks due this week, work waiting on clients and overdue tasks, each compared with an earlier period you pick.",
  },
  {
    title: "Billing",
    text: "Owners and billing managers see the plan, payment method, usage and invoices. Limits on projects, portals, seats and storage are checked on the server.",
  },
  {
    title: "Audit log",
    text: "Invitations, role changes, sharing, approvals, downloads, exports and plan changes, with who did it, when and from which IP address.",
  },
  {
    title: "Reports",
    text: "How long each client takes to review, how often work is approved on the first version, and which projects are slipping.",
  },
];

const TEAM_ROWS: { label: string; permission: TeamPermission }[] = [
  { label: "See every project", permission: "projects.view_all" },
  { label: "Work on assigned projects", permission: "projects.view_assigned" },
  { label: "Create and edit projects", permission: "projects.create" },
  { label: "Share projects with clients", permission: "projects.share" },
  { label: "Send deliverables for review", permission: "deliverables.submit" },
  { label: "Manage clients and portal access", permission: "clients.manage_access" },
  { label: "Invite team members", permission: "team.invite" },
  { label: "Change roles", permission: "team.manage_roles" },
  { label: "Read the audit log", permission: "audit.view" },
  { label: "Manage the plan and invoices", permission: "billing.manage" },
  { label: "Export workspace data", permission: "data.export" },
  { label: "Change workspace settings", permission: "workspace.update" },
];

const TEAM_ROLES: OrgRole[] = ["owner", "manager", "member", "billing"];

const CLIENT_ROWS: { label: string; permission: ClientPermission }[] = [
  { label: "See shared projects and deliverables", permission: "portal.view" },
  { label: "Comment", permission: "portal.comment" },
  { label: "Approve or ask for changes", permission: "portal.approve" },
];

const CLIENT_ROLES: ClientRole[] = ["approver", "viewer"];

export default function FeaturesPage() {
  return (
    <>
      <PageIntro
        title="What's in Atrium"
        description="Your team gets a workspace for running projects, and each client gets a portal for reviewing them. This page goes through both, then lists exactly who can do what."
      />

      <section aria-labelledby="team-title" className="py-16 sm:py-20">
        <Container>
          <SectionHeading id="team-title" title="In the team workspace" />
          <ScreenshotFrame
            src="/screenshots/dashboard.png"
            alt="The team dashboard with active projects, tasks due soon, pending approvals and overdue tasks"
            priority
            className="mt-10"
            caption="The dashboard for the owner of Kinetic Studio, one of the demo workspaces."
          />
          <FeatureList items={TEAM_FEATURES} className="mt-12" />
        </Container>
      </section>

      <section aria-labelledby="client-title" className="border-t border-line py-16 sm:py-20">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
            <div>
              <SectionHeading
                id="client-title"
                title="In the client portal"
                description="Clients sign in from an invitation and land on their own projects. The portal shows your studio's name next to theirs."
              />
              <FeatureList items={CLIENT_FEATURES} columns={1} className="mt-10" />
            </div>
            <ScreenshotFrame
              src="/screenshots/portal.png"
              alt="The client portal overview for Acme Co. with two deliverables waiting for review"
              crop="aspect-[4/3]"
              sizes="(min-width: 1024px) 620px, 100vw"
              caption="What Daniel at Acme Co. sees when he signs in."
            />
          </div>
        </Container>
      </section>

      <section aria-labelledby="business-title" className="border-t border-line py-16 sm:py-20">
        <Container>
          <SectionHeading
            id="business-title"
            title="For the people running the studio"
            description="Owners and managers get the overview. Billing managers get billing and nothing else."
          />
          <FeatureList items={BUSINESS_FEATURES} className="mt-10" />
        </Container>
      </section>

      <section aria-labelledby="roles-title" className="border-t border-line py-16 sm:py-20">
        <Container>
          <SectionHeading
            id="roles-title"
            title="Who can do what"
            description="These tables are built from the same permission rules the app checks on every request, so they can't drift out of date."
          />
          <div className="mt-10 grid gap-10 lg:grid-cols-[1.5fr_1fr]">
            <PermissionTable
              caption="Team roles"
              minWidth="min-w-[560px]"
              note="A project lead can also edit their own project and send its deliverables for review, whatever their role."
              columns={TEAM_ROLES.map((role) => ROLE_LABELS[role])}
              rows={TEAM_ROWS.map((row) => ({ label: row.label, cells: TEAM_ROLES.map((role) => can(role, row.permission)) }))}
            />
            <PermissionTable
              caption="Client roles"
              minWidth="min-w-[300px]"
              note="Client users only ever see projects shared with their own company."
              columns={CLIENT_ROLES.map((role) => CLIENT_ROLE_LABELS[role])}
              rows={CLIENT_ROWS.map((row) => ({ label: row.label, cells: CLIENT_ROLES.map((role) => clientCan(role, row.permission)) }))}
            />
          </div>
        </Container>
      </section>

      <CtaBand />
    </>
  );
}

function FeatureList({
  items,
  columns = 2,
  className,
}: {
  items: { title: string; text: string }[];
  columns?: 1 | 2;
  className?: string;
}) {
  return (
    <dl className={cn("grid gap-x-16 gap-y-8", columns === 2 && "sm:grid-cols-2", className)}>
      {items.map((item) => (
        <div key={item.title} className="border-t border-line pt-5">
          <dt className="text-base font-semibold text-ink">{item.title}</dt>
          <dd className="mt-2 text-[0.9375rem] leading-relaxed text-ink-muted">{item.text}</dd>
        </div>
      ))}
    </dl>
  );
}

function PermissionTable({
  caption,
  columns,
  rows,
  minWidth,
  note,
}: {
  caption: string;
  columns: string[];
  rows: { label: string; cells: boolean[] }[];
  minWidth: string;
  note?: string;
}) {
  return (
    <div className="min-w-0 self-start">
      <h3 className="text-base font-semibold text-ink">{caption}</h3>
      <div className="relative mt-3 overflow-x-auto">
        <table className={cn("w-full border-collapse text-sm", minWidth)}>
          <caption className="sr-only">{caption} and their permissions</caption>
          <thead>
            <tr className="border-b border-line-strong text-left text-ink-muted">
              <th scope="col" className="py-3 pr-3 font-medium">
                Permission
              </th>
              {columns.map((column) => (
                <th key={column} scope="col" className="px-3 py-3 text-center font-medium">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-white/[0.06]">
                <th scope="row" className="py-2.5 pr-3 text-left font-normal text-ink-secondary">
                  {row.label}
                </th>
                {row.cells.map((allowed, index) => (
                  <td key={columns[index]} className="px-3 py-2.5 text-center">
                    {allowed ? (
                      <Check size={16} className="mx-auto text-cyan-300" aria-label="Allowed" />
                    ) : (
                      <Minus size={16} className="mx-auto text-ink-faint/50" aria-label="Not allowed" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {note && <p className="mt-3 text-sm leading-relaxed text-ink-faint">{note}</p>}
    </div>
  );
}
