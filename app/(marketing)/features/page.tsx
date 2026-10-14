import type { Metadata } from "next";
import {
  Bell,
  CalendarCheck2,
  Check,
  CreditCard,
  Download,
  FileStack,
  FolderKanban,
  Gauge,
  LayoutDashboard,
  ListChecks,
  MessagesSquare,
  Minus,
  Paperclip,
  ScrollText,
  ShieldCheck,
  ThumbsUp,
  UserCog,
  Users,
} from "lucide-react";
import { CLIENT_ROLE_LABELS, ROLE_LABELS, can, clientCan, type ClientPermission, type TeamPermission } from "@/lib/auth/permissions";
import type { ClientRole, OrgRole } from "@/lib/data/types";
import { cn } from "@/lib/utils";
import {
  Container,
  CtaBand,
  Eyebrow,
  FeatureBlurb,
  PageIntro,
  ScreenshotFrame,
  SectionHeading,
} from "@/components/marketing/primitives";
import { ClientRolesSnippet, PortalSnippet } from "@/components/marketing/product-snippets";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Projects, milestones, tasks, versioned deliverables, client approvals, notifications, billing and an audit log. Everything in Atrium, in one page.",
};

const TEAM_FEATURES = [
  {
    icon: FolderKanban,
    title: "Projects",
    text: "Each project has a client, a lead, start and due dates, an optional budget and a status from planning to completed. Share it with the client when you're ready.",
  },
  {
    icon: ListChecks,
    title: "Tasks on a board or a list",
    text: "Drag tasks across To do, In progress, In review, Blocked and Done, or switch to a list. Filter by assignee and priority; overdue tasks are flagged.",
  },
  {
    icon: CalendarCheck2,
    title: "Milestones with approval rules",
    text: "Group work into milestones. Mark a milestone as needing approval and it only completes once every deliverable inside it has been approved.",
  },
  {
    icon: FileStack,
    title: "Versioned deliverables",
    text: "Uploads stack up as versions with a note on what changed. Drafts stay internal until someone with the right role submits them for review.",
  },
  {
    icon: MessagesSquare,
    title: "Two comment threads",
    text: "Talk to the client on the client thread, and keep internal discussion on the team thread. Internal comments are never sent to client users.",
  },
  {
    icon: Paperclip,
    title: "Project files",
    text: "Keep briefs, contracts and source files with the project. Each file is internal or client-visible, and every download goes through an expiring link.",
  },
];

const CLIENT_FEATURES = [
  {
    icon: LayoutDashboard,
    title: "Only their own work",
    text: "A client sees the projects you've shared with their company, the tasks you've marked as visible and the deliverables you've submitted. Nothing else.",
  },
  {
    icon: ThumbsUp,
    title: "Approve or request changes",
    text: "Approvers decide on the version in front of them. A request for changes needs a comment, so your team knows exactly what to fix.",
  },
  {
    icon: Download,
    title: "Downloads that expire",
    text: "Clients download files through a link that's checked against their access and expires after 60 seconds, so forwarded links stop working.",
  },
  {
    icon: Bell,
    title: "Told when it matters",
    text: "Clients are notified when something is ready for their review or when your team replies, and can follow everything in the activity feed.",
  },
];

const BUSINESS_FEATURES = [
  {
    icon: Gauge,
    title: "A dashboard that answers “where are we?”",
    text: "Active projects, tasks due this week, deliverables waiting on clients and overdue work, compared with the previous period.",
  },
  {
    icon: CreditCard,
    title: "Plans, invoices and limits",
    text: "Owners and billing managers see the plan, payment method, usage and invoices. Limits on projects, portals, seats and storage are enforced on the server.",
  },
  {
    icon: ScrollText,
    title: "Audit log",
    text: "Invitations, role changes, sharing, approvals, downloads, exports and plan changes are recorded with actor, time and IP address.",
  },
  {
    icon: UserCog,
    title: "Roles that match how agencies work",
    text: "Owners, managers, team members and billing managers each get a fixed set of permissions, listed in full below.",
  },
];

const TEAM_ROWS: { label: string; permission: TeamPermission }[] = [
  { label: "See every project", permission: "projects.view_all" },
  { label: "Work on assigned projects", permission: "projects.view_assigned" },
  { label: "Create and edit projects", permission: "projects.create" },
  { label: "Share projects with clients", permission: "projects.share" },
  { label: "Submit deliverables for review", permission: "deliverables.submit" },
  { label: "Manage clients and portal access", permission: "clients.manage_access" },
  { label: "Invite team members", permission: "team.invite" },
  { label: "Change roles", permission: "team.manage_roles" },
  { label: "Read the audit log", permission: "audit.view" },
  { label: "Manage plan and invoices", permission: "billing.manage" },
  { label: "Export workspace data", permission: "data.export" },
  { label: "Change workspace settings", permission: "workspace.update" },
];

const TEAM_ROLES: OrgRole[] = ["owner", "manager", "member", "billing"];

const CLIENT_ROWS: { label: string; permission: ClientPermission }[] = [
  { label: "View shared projects and deliverables", permission: "portal.view" },
  { label: "Comment on the client thread", permission: "portal.comment" },
  { label: "Approve or request changes", permission: "portal.approve" },
];

const CLIENT_ROLES: ClientRole[] = ["approver", "viewer"];

export default function FeaturesPage() {
  return (
    <>
      <PageIntro
        eyebrow={<Eyebrow>Features</Eyebrow>}
        title="Everything between “here's the first draft” and “approved”"
        description="Atrium gives your team a workspace to run projects and gives each client a portal to review them. Here's what's in each, and who can do what."
      />

      <Container>
        <ScreenshotFrame
          src="/screenshots/review.png"
          alt="A deliverable in review: the Homepage mockup at version 3 with client reviewers and version history."
          label="Website Redesign · Deliverables"
          priority
        />
      </Container>

      <section aria-labelledby="team-title" className="py-20 sm:py-28">
        <Container>
          <SectionHeading
            id="team-title"
            eyebrow="For your team"
            title="Run the project in one place"
            description="Plan, build and review inside the workspace. Clients only see what you decide to share."
          />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TEAM_FEATURES.map((item) => (
              <FeatureBlurb key={item.title} icon={item.icon} title={item.title}>
                {item.text}
              </FeatureBlurb>
            ))}
          </div>
        </Container>
      </section>

      <section aria-labelledby="client-title" className="border-y border-line bg-[#06101a]/40 py-20 sm:py-28">
        <Container className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="min-w-0">
            <SectionHeading
              id="client-title"
              align="left"
              eyebrow="For your clients"
              title="A portal clients don't need training for"
              description="Clients sign in with an invitation and land on their own projects. The portal carries your workspace name, so it feels like part of your service."
            />
            <div className="mt-10 grid gap-x-8 gap-y-7 sm:grid-cols-2">
              {CLIENT_FEATURES.map((item) => (
                <div key={item.title}>
                  <p className="flex items-center gap-2.5 font-semibold text-ink">
                    <item.icon size={18} className="text-cyan-300" aria-hidden="true" />
                    {item.title}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-md space-y-4">
            <div className="pointer-events-none absolute inset-0 rounded-full bg-cyan-500/10 blur-[80px]" aria-hidden="true" />
            <div className="relative">
              <PortalSnippet />
            </div>
            <div className="relative ml-auto w-[88%]">
              <ClientRolesSnippet />
            </div>
          </div>
        </Container>
      </section>

      <section aria-labelledby="business-title" className="py-20 sm:py-28">
        <Container>
          <SectionHeading
            id="business-title"
            eyebrow="For running the business"
            title="See the whole agency, not just one project"
            description="Owners and managers get the overview; billing managers get billing and nothing else."
          />
          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {BUSINESS_FEATURES.map((item) => (
              <FeatureBlurb key={item.title} icon={item.icon} title={item.title}>
                {item.text}
              </FeatureBlurb>
            ))}
          </div>
        </Container>
      </section>

      <section aria-labelledby="roles-title" className="pb-8">
        <Container>
          <SectionHeading
            id="roles-title"
            eyebrow="Roles and permissions"
            title="Who can do what"
            description="These tables are generated from the same permission rules the app checks on every request."
          />
          <div className="mt-12 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
            <PermissionTable
              caption="Team roles"
              icon={Users}
              minWidth="min-w-[560px]"
              note="Project leads can also edit their own project and submit its deliverables, whatever their role."
              columns={TEAM_ROLES.map((role) => ROLE_LABELS[role])}
              rows={TEAM_ROWS.map((row) => ({ label: row.label, cells: TEAM_ROLES.map((role) => can(role, row.permission)) }))}
            />
            <PermissionTable
              caption="Client roles"
              icon={ShieldCheck}
              minWidth="min-w-[320px]"
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

function PermissionTable({
  caption,
  icon: Icon,
  columns,
  rows,
  minWidth,
  note,
}: {
  caption: string;
  icon: typeof Users;
  columns: string[];
  rows: { label: string; cells: boolean[] }[];
  minWidth: string;
  note?: string;
}) {
  return (
    <div className="card min-w-0 self-start">
      <h3 className="flex items-center gap-2.5 px-5 pt-5 font-semibold text-ink">
        <Icon size={18} className="text-cyan-300" aria-hidden="true" />
        {caption}
      </h3>
      <div className="relative mt-3 overflow-x-auto px-2 pb-3">
        <table className={cn("w-full border-collapse text-sm", minWidth)}>
          <caption className="sr-only">{caption} and their permissions</caption>
          <thead>
            <tr className="border-b border-line text-xs text-ink-faint">
              <th scope="col" className="px-3 py-3 text-left font-medium">
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
              <tr key={row.label} className="border-b border-white/[0.04] last:border-0">
                <th scope="row" className="px-3 py-2.5 text-left font-normal text-ink-secondary">
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
      {note && <p className="border-t border-line px-5 py-3.5 text-xs leading-relaxed text-ink-faint">{note}</p>}
    </div>
  );
}
