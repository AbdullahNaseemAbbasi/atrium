/**
 * Help centre content. Answers describe how the app actually behaves; keep
 * them in sync when a rule changes (limits, expiry times, roles).
 */

export type HelpCategoryKey = "getting-started" | "projects" | "deliverables" | "portal" | "team" | "billing" | "account";

export interface HelpCategory {
  key: HelpCategoryKey;
  title: string;
  description: string;
}

export interface HelpArticle {
  id: string;
  category: HelpCategoryKey;
  title: string;
  body: string[];
}

export const HELP_CATEGORIES: HelpCategory[] = [
  { key: "getting-started", title: "Getting started", description: "Create a workspace, try the demo and bring in your first client." },
  { key: "projects", title: "Projects and tasks", description: "Sharing projects, client-visible tasks and milestones." },
  { key: "deliverables", title: "Deliverables and approvals", description: "Versions, reviews and what an approval records." },
  { key: "portal", title: "Client portal", description: "What clients see, their roles and downloading files." },
  { key: "team", title: "Team and roles", description: "Invitations, roles and who can change what." },
  { key: "billing", title: "Billing and plans", description: "Limits, the trial and who can see invoices." },
  { key: "account", title: "Account and security", description: "Passwords, sessions and expiring links." },
];

export const HELP_ARTICLES: HelpArticle[] = [
  {
    id: "create-workspace",
    category: "getting-started",
    title: "Create your workspace",
    body: [
      "Sign up with your name, work email and a password. A short setup asks for your workspace name, its web address, your timezone and the kind of work you do.",
      "You can invite teammates in the second step or skip it, then choose the free Starter plan or a 14-day Professional trial. You become the workspace owner.",
    ],
  },
  {
    id: "demo-accounts",
    category: "getting-started",
    title: "Try Atrium with the demo accounts",
    body: [
      "The sign-in page lists demo accounts for an agency owner, a project manager, a team member, a billing manager, a client approver, a client viewer and a platform operator.",
      "Each one opens the same sample workspace from a different point of view, which is the quickest way to see what each role can and can't do.",
    ],
  },
  {
    id: "first-client",
    category: "getting-started",
    title: "Add your first client",
    body: [
      "Owners and managers can add a client from the Clients page with the company name, a main contact and their industry.",
      "To give the client access, invite their contacts to the portal as an approver or a viewer. Nothing is visible to them until you share a project.",
    ],
  },
  {
    id: "invite-team",
    category: "getting-started",
    title: "Invite your team",
    body: [
      "Owners can invite people as a manager, team member or billing manager. Managers can invite team members.",
      "Invitations stay open for 7 days. Each person who joins uses one seat on your plan; the owner uses one too.",
    ],
  },
  {
    id: "share-project",
    category: "projects",
    title: "Share a project with a client",
    body: [
      "Open the project, choose Edit and tick 'Share this project with the client'. The project needs a client before it can be shared.",
      "Only owners and managers can change sharing, and each change is written to the audit log. Turning sharing off removes the project from the portal straight away.",
    ],
  },
  {
    id: "client-visible-tasks",
    category: "projects",
    title: "Choose which tasks the client sees",
    body: [
      "Every task has a 'Visible to the client' option. Turn it off for internal work such as QA checklists or estimates; client users only see visible tasks, and only in shared projects.",
      "Internal comments on a task are never shown in the portal, even when the task itself is visible.",
    ],
  },
  {
    id: "milestone-approval",
    category: "projects",
    title: "Milestones that need approval",
    body: [
      "When a milestone is marked as needing approval, it only completes once every deliverable inside it has been approved by the client.",
      "Use this for stages that must be signed off before the next one starts, such as wireframes before visual design.",
    ],
  },
  {
    id: "overdue",
    category: "projects",
    title: "When is a task overdue?",
    body: [
      "A task is overdue when it isn't done and its due date has passed. Overdue tasks are highlighted on the board and counted on the dashboard.",
    ],
  },
  {
    id: "new-version",
    category: "deliverables",
    title: "Upload a new version",
    body: [
      "On a deliverable, choose Upload and add a short note on what changed. The new file becomes the next version; earlier versions stay in the history and can still be downloaded.",
    ],
  },
  {
    id: "submit-review",
    category: "deliverables",
    title: "Send a deliverable for review",
    body: [
      "Drafts are only visible to your team. When the work is ready, submit it for review and the client's approvers are notified.",
      "Owners, managers and the project lead can submit. Team members can upload versions but not send them to the client.",
    ],
  },
  {
    id: "approval-record",
    category: "deliverables",
    title: "What an approval records",
    body: [
      "Each decision is pinned to the version the client was looking at, with the reviewer's name, the time and any comment.",
      "If you upload a new version after an approval, the earlier decision stays attached to the earlier version, so there's never doubt about what was signed off.",
    ],
  },
  {
    id: "request-changes",
    category: "deliverables",
    title: "Approving or requesting changes",
    body: [
      "Client approvers choose Approve or Request changes on a deliverable that's in review. A request for changes needs a short comment so your team knows what to fix.",
      "After changes are requested, upload a new version and submit it again.",
    ],
  },
  {
    id: "client-roles",
    category: "portal",
    title: "Approver and viewer roles",
    body: [
      "Approvers can review deliverables, comment and give the final approval. Viewers can follow progress and comment, but can't approve.",
      "Use viewers for people who should stay informed, such as a colleague of the main contact.",
    ],
  },
  {
    id: "client-cant-see",
    category: "portal",
    title: "Why can't my client see a project?",
    body: [
      "Check that the project is shared with the client and belongs to their company. Drafts never appear in the portal, so a deliverable must be submitted first.",
      "A client also loses portal access when their client record is archived or their access is suspended.",
    ],
  },
  {
    id: "portal-downloads",
    category: "portal",
    title: "Downloading files from the portal",
    body: [
      "Each download creates a private link that works for 60 seconds. If a link has expired, go back to the file and choose Download again.",
    ],
  },
  {
    id: "roles",
    category: "team",
    title: "Team roles explained",
    body: [
      "Owners have full control, including billing and roles. Managers run every project and client, invite team members and read the audit log.",
      "Team members work on the projects they're assigned to. Billing managers handle the plan and invoices and don't see project data.",
    ],
  },
  {
    id: "accept-invite",
    category: "team",
    title: "Accepting an invitation",
    body: [
      "Open the link in your invitation, then sign in or create an account with the email address the invitation was sent to. Once signed in, choose Accept invitation.",
      "If the link has expired or been withdrawn, ask the person who invited you to send a new one.",
    ],
  },
  {
    id: "plan-limits",
    category: "billing",
    title: "How plan limits work",
    body: [
      "Plans limit active projects, client portals, team seats and file storage. Active projects are those in planning, in progress or in review.",
      "When you reach a limit, Atrium explains which one and stops new items until you upgrade or free up space. Existing work is never removed.",
    ],
  },
  {
    id: "trial",
    category: "billing",
    title: "The 14-day Professional trial",
    body: [
      "Choose the trial when you create a workspace. You get Professional limits for 14 days without adding a card, and can pick a paid plan from Billing at any time.",
    ],
  },
  {
    id: "billing-access",
    category: "billing",
    title: "Who can see billing?",
    body: [
      "Owners and billing managers can see the plan, payment method, usage and invoices. Managers and team members can't, and billing managers can't see project data.",
    ],
  },
  {
    id: "reset-password",
    category: "account",
    title: "Reset your password",
    body: [
      "Choose 'Forgot password?' on the sign-in page and enter your email. If an account exists, a reset link is sent that works for 30 minutes.",
      "New passwords need at least 10 characters, including a number.",
    ],
  },
  {
    id: "expired-link",
    category: "account",
    title: "Why did my download link stop working?",
    body: [
      "Download links expire after 60 seconds and are tied to your account, so a forwarded link won't work for anyone else. Open the file in Atrium and download it again.",
    ],
  },
  {
    id: "data-separation",
    category: "account",
    title: "Can other workspaces see our data?",
    body: [
      "No. Every record belongs to one workspace and every request checks your membership first. Anything outside your workspace is treated as if it doesn't exist.",
    ],
  },
];
