import { addDays, addHours, startOfDay } from "date-fns";
import type {
  ActivityEvent,
  Approval,
  AuditLog,
  Client,
  ClientMembership,
  Comment,
  Database,
  Deliverable,
  DeliverableVersion,
  ID,
  Invitation,
  Invoice,
  Membership,
  Milestone,
  Notification,
  Organization,
  Priority,
  Project,
  ProjectFile,
  ProjectMember,
  Task,
  TaskStatus,
  User,
  Visibility,
} from "./types";

/**
 * Deterministic synthetic demo data. Every name, company and email is
 * fictional (all domains use the reserved `.example` TLD). Dates are relative
 * to `now` so the demo always looks current.
 */
export function createSeed(now: Date): Database {
  const today = startOfDay(now);
  /** A calendar day relative to today, at 17:00. */
  const day = (offset: number) => addHours(addDays(today, offset), 17).toISOString();
  /** A moment relative to now, in hours. */
  const hoursAgo = (hours: number) => addHours(now, -hours).toISOString();
  const daysAgo = (days: number, hour = 11) => addHours(addDays(today, -days), hour).toISOString();

  const MB = 1024 ** 2;
  const GB = 1024 ** 3;

  /* ---------------- Users ---------------- */

  const users: User[] = [
    { id: "usr_alex", name: "Alex Carter", email: "alex@kinetic.example", title: "Founder & Creative Director", avatarHue: 192, timezone: "America/New_York", createdAt: daysAgo(420), lastActiveAt: hoursAgo(0.2) },
    { id: "usr_emma", name: "Emma Wilson", email: "emma@kinetic.example", title: "Project Manager", avatarHue: 330, timezone: "America/New_York", createdAt: daysAgo(400), lastActiveAt: hoursAgo(1) },
    { id: "usr_liam", name: "Liam Patel", email: "liam@kinetic.example", title: "Senior Product Designer", avatarHue: 28, timezone: "Europe/London", createdAt: daysAgo(380), lastActiveAt: hoursAgo(3) },
    { id: "usr_sophia", name: "Sophia Martinez", email: "sophia@kinetic.example", title: "Front-end Developer", avatarHue: 268, timezone: "America/Chicago", createdAt: daysAgo(300), lastActiveAt: hoursAgo(2) },
    { id: "usr_noah", name: "Noah Kim", email: "noah@kinetic.example", title: "Brand Strategist", avatarHue: 150, timezone: "America/Los_Angeles", createdAt: daysAgo(260), lastActiveAt: hoursAgo(26) },
    { id: "usr_olivia", name: "Olivia Brown", email: "olivia@kinetic.example", title: "Operations & Finance", avatarHue: 48, timezone: "America/New_York", createdAt: daysAgo(240), lastActiveAt: hoursAgo(50) },
    { id: "usr_ethan", name: "Ethan Davis", email: "ethan@kinetic.example", title: "Motion Designer", avatarHue: 210, timezone: "Europe/Berlin", createdAt: daysAgo(150), lastActiveAt: hoursAgo(5) },
    { id: "usr_ava", name: "Ava Thompson", email: "ava@kinetic.example", title: "Content Lead", avatarHue: 355, timezone: "America/New_York", createdAt: daysAgo(90), lastActiveAt: hoursAgo(7) },
    // Client portal users
    { id: "usr_daniel", name: "Daniel Reed", email: "daniel@acme.example", title: "Head of Marketing, Acme Co.", avatarHue: 12, timezone: "America/New_York", createdAt: daysAgo(55), lastActiveAt: hoursAgo(4) },
    { id: "usr_chris", name: "Chris Morgan", email: "chris@acme.example", title: "Brand Manager, Acme Co.", avatarHue: 100, timezone: "America/New_York", createdAt: daysAgo(40), lastActiveAt: hoursAgo(6) },
    { id: "usr_priya", name: "Priya Shah", email: "priya@novatech.example", title: "VP Product, NovaTech", avatarHue: 290, timezone: "Asia/Singapore", createdAt: daysAgo(10), lastActiveAt: hoursAgo(20) },
    { id: "usr_marcus", name: "Marcus Lee", email: "marcus@pulse.example", title: "CMO, Pulse Marketing", avatarHue: 170, timezone: "America/Toronto", createdAt: daysAgo(95), lastActiveAt: hoursAgo(300) },
    { id: "usr_hannah", name: "Hannah Cole", email: "hannah@shopease.example", title: "E-commerce Director, ShopEase", avatarHue: 230, timezone: "Europe/Dublin", createdAt: daysAgo(35), lastActiveAt: hoursAgo(19) },
    { id: "usr_omar", name: "Omar Haddad", email: "omar@brightpath.example", title: "Marketing Manager, BrightPath", avatarHue: 75, timezone: "Asia/Dubai", createdAt: daysAgo(45), lastActiveAt: hoursAgo(190) },
    // Second tenant
    { id: "usr_maya", name: "Maya Johnson", email: "maya@lumen.example", title: "Studio Lead", avatarHue: 265, timezone: "Europe/London", createdAt: daysAgo(200), lastActiveAt: hoursAgo(9) },
    { id: "usr_leo", name: "Leo Garcia", email: "leo@lumen.example", title: "UX Designer", avatarHue: 140, timezone: "Europe/Madrid", createdAt: daysAgo(180), lastActiveAt: hoursAgo(30) },
    { id: "usr_zara", name: "Zara Ahmed", email: "zara@orbit.example", title: "Head of Growth, Orbit Fintech", avatarHue: 20, timezone: "Asia/Karachi", createdAt: daysAgo(60), lastActiveAt: hoursAgo(40) },
    // Platform operator
    { id: "usr_sam", name: "Sam Rivera", email: "sam@atrium.example", title: "Platform Operations", avatarHue: 185, timezone: "UTC", isPlatformAdmin: true, createdAt: daysAgo(500), lastActiveAt: hoursAgo(12) },
  ];

  /* ---------------- Organizations ---------------- */

  const organizations: Organization[] = [
    { id: "org_kinetic", name: "Kinetic Studio", slug: "kinetic", timezone: "America/New_York", industry: "Design & development agency", website: "kinetic.example", brandHue: 190, createdAt: daysAgo(420) },
    { id: "org_lumen", name: "Lumen Labs", slug: "lumen", timezone: "Europe/London", industry: "Product design studio", website: "lumen.example", brandHue: 265, createdAt: daysAgo(200) },
  ];

  const memberships: Membership[] = [
    m("mem_k_alex", "org_kinetic", "usr_alex", "owner", 420),
    m("mem_k_emma", "org_kinetic", "usr_emma", "manager", 400),
    m("mem_k_liam", "org_kinetic", "usr_liam", "member", 380),
    m("mem_k_sophia", "org_kinetic", "usr_sophia", "member", 300),
    m("mem_k_noah", "org_kinetic", "usr_noah", "member", 260),
    m("mem_k_olivia", "org_kinetic", "usr_olivia", "billing", 240),
    m("mem_k_ethan", "org_kinetic", "usr_ethan", "member", 150),
    m("mem_k_ava", "org_kinetic", "usr_ava", "member", 90),
    m("mem_l_maya", "org_lumen", "usr_maya", "owner", 200),
    m("mem_l_leo", "org_lumen", "usr_leo", "member", 180),
    m("mem_l_alex", "org_lumen", "usr_alex", "manager", 70),
  ];

  function m(id: ID, organizationId: ID, userId: ID, role: Membership["role"], joined: number): Membership {
    return { id, organizationId, userId, role, status: "active", joinedAt: daysAgo(joined) };
  }

  /* ---------------- Clients ---------------- */

  const clients: Client[] = [
    { id: "cli_acme", organizationId: "org_kinetic", companyName: "Acme Co.", contactName: "Daniel Reed", email: "daniel@acme.example", phone: "+1 (212) 555-0142", website: "acme.example", industry: "Consumer goods", status: "active", brandHue: 12, notes: "Prefers Thursday reviews. CEO joins sign-off on major milestones.", createdAt: daysAgo(56) },
    { id: "cli_novatech", organizationId: "org_kinetic", companyName: "NovaTech", contactName: "Priya Shah", email: "priya@novatech.example", phone: "+65 5550 1180", website: "novatech.example", industry: "B2B software", status: "active", brandHue: 290, notes: "Fast decision maker. Wants weekly Loom updates.", createdAt: daysAgo(12) },
    { id: "cli_pulse", organizationId: "org_kinetic", companyName: "Pulse Marketing", contactName: "Marcus Lee", email: "marcus@pulse.example", phone: "+1 (416) 555-0199", website: "pulse.example", industry: "Marketing services", status: "active", brandHue: 170, createdAt: daysAgo(96) },
    { id: "cli_shopease", organizationId: "org_kinetic", companyName: "ShopEase", contactName: "Hannah Cole", email: "hannah@shopease.example", phone: "+353 1 555 0134", website: "shopease.example", industry: "E-commerce", status: "active", brandHue: 230, notes: "Launch tied to their November sale. Hard deadline.", createdAt: daysAgo(36) },
    { id: "cli_brightpath", organizationId: "org_kinetic", companyName: "BrightPath", contactName: "Omar Haddad", email: "omar@brightpath.example", website: "brightpath.example", industry: "Education", status: "paused", brandHue: 75, notes: "Campaign paused until their Q1 budget is confirmed.", createdAt: daysAgo(46) },
    { id: "cli_meridian", organizationId: "org_kinetic", companyName: "Meridian Health", contactName: "Grace Turner", email: "grace.turner@meridian.example", phone: "+1 (617) 555-0111", website: "meridian.example", industry: "Healthcare", status: "onboarding", brandHue: 160, notes: "Needs a signed BAA before any patient data is shared.", createdAt: daysAgo(6) },
    { id: "cli_orbit", organizationId: "org_lumen", companyName: "Orbit Fintech", contactName: "Zara Ahmed", email: "zara@orbit.example", website: "orbit.example", industry: "Financial services", status: "active", brandHue: 20, createdAt: daysAgo(61) },
  ];

  const clientMemberships: ClientMembership[] = [
    cm("clm_daniel", "org_kinetic", "cli_acme", "usr_daniel", "approver", 55),
    cm("clm_chris", "org_kinetic", "cli_acme", "usr_chris", "viewer", 40),
    cm("clm_priya", "org_kinetic", "cli_novatech", "usr_priya", "approver", 10),
    cm("clm_marcus", "org_kinetic", "cli_pulse", "usr_marcus", "approver", 95),
    cm("clm_hannah", "org_kinetic", "cli_shopease", "usr_hannah", "approver", 35),
    cm("clm_omar", "org_kinetic", "cli_brightpath", "usr_omar", "approver", 45),
    cm("clm_zara", "org_lumen", "cli_orbit", "usr_zara", "approver", 60),
  ];

  function cm(id: ID, organizationId: ID, clientId: ID, userId: ID, role: ClientMembership["role"], joined: number): ClientMembership {
    return { id, organizationId, clientId, userId, role, status: "active", joinedAt: daysAgo(joined) };
  }

  /* ---------------- Projects ---------------- */

  const projects: Project[] = [
    {
      id: "prj_website", organizationId: "org_kinetic", clientId: "cli_acme", name: "Website Redesign",
      description: "Full redesign of acme.example: new information architecture, a modular design system and a headless CMS build so the Acme team can publish without developers.",
      status: "in_progress", icon: "globe", startAt: day(-48), dueAt: day(13), sharedWithClient: true, budgetCents: 4_800_000,
      createdByUserId: "usr_emma", createdAt: daysAgo(50), updatedAt: hoursAgo(5),
    },
    {
      id: "prj_mobile", organizationId: "org_kinetic", clientId: "cli_novatech", name: "Mobile App Launch",
      description: "Discovery, UX and a beta build of NovaTech's first mobile companion app for field sales teams.",
      status: "planning", icon: "smartphone", startAt: day(-6), dueAt: day(45), sharedWithClient: true, budgetCents: 7_200_000,
      createdByUserId: "usr_emma", createdAt: daysAgo(8), updatedAt: hoursAgo(20),
    },
    {
      id: "prj_brand", organizationId: "org_kinetic", clientId: "cli_pulse", name: "Brand Guidelines",
      description: "Brand strategy, identity refresh and a 48-page guidelines document for Pulse Marketing.",
      status: "completed", icon: "palette", startAt: day(-90), dueAt: day(-12), sharedWithClient: true, budgetCents: 2_600_000,
      createdByUserId: "usr_noah", createdAt: daysAgo(92), updatedAt: daysAgo(12),
    },
    {
      id: "prj_ecom", organizationId: "org_kinetic", clientId: "cli_shopease", name: "E-commerce Platform",
      description: "A faster storefront and checkout for ShopEase, launching before their November sale.",
      status: "in_progress", icon: "cart", startAt: day(-30), dueAt: day(18), sharedWithClient: true, budgetCents: 9_500_000,
      createdByUserId: "usr_sophia", createdAt: daysAgo(32), updatedAt: hoursAgo(2),
    },
    {
      id: "prj_campaign", organizationId: "org_kinetic", clientId: "cli_brightpath", name: "Spring Enrolment Campaign",
      description: "Hero film, social cut-downs and landing page for BrightPath's spring enrolment push.",
      status: "on_hold", icon: "megaphone", startAt: day(-40), dueAt: day(15), sharedWithClient: true, budgetCents: 3_100_000,
      createdByUserId: "usr_noah", createdAt: daysAgo(42), updatedAt: daysAgo(8),
    },
    {
      id: "prj_meridian", organizationId: "org_kinetic", clientId: "cli_meridian", name: "Patient Portal UX",
      description: "User research and UX for Meridian Health's patient portal. Not shared with the client until the BAA is signed.",
      status: "planning", icon: "heart", startAt: day(4), dueAt: day(70), sharedWithClient: false, budgetCents: 6_400_000,
      createdByUserId: "usr_emma", createdAt: daysAgo(5), updatedAt: daysAgo(3),
    },
    {
      id: "prj_seo", organizationId: "org_kinetic", clientId: "cli_acme", name: "SEO & Content Sprint",
      description: "Keyword research, content gap analysis and a Q4 content calendar to support the new site.",
      status: "in_review", icon: "search", startAt: day(-20), dueAt: day(2), sharedWithClient: true, budgetCents: 1_200_000,
      createdByUserId: "usr_ava", createdAt: daysAgo(21), updatedAt: hoursAgo(26),
    },
    {
      id: "prj_site", organizationId: "org_kinetic", clientId: null, name: "Kinetic Website Refresh",
      description: "Internal project: new case studies, services copy and a faster blog.",
      status: "in_progress", icon: "layers", startAt: day(-14), dueAt: day(21), sharedWithClient: false,
      createdByUserId: "usr_alex", createdAt: daysAgo(15), updatedAt: daysAgo(1),
    },
    {
      id: "prj_orbit", organizationId: "org_lumen", clientId: "cli_orbit", name: "Orbit Onboarding Flow",
      description: "Redesign of Orbit's sign-up and identity verification flow to cut drop-off.",
      status: "in_progress", icon: "smartphone", startAt: day(-25), dueAt: day(10), sharedWithClient: true, budgetCents: 3_800_000,
      createdByUserId: "usr_maya", createdAt: daysAgo(26), updatedAt: hoursAgo(30),
    },
    {
      id: "prj_lumen_site", organizationId: "org_lumen", clientId: null, name: "Lumen Brand Refresh",
      description: "Internal refresh of the Lumen Labs identity and website.",
      status: "planning", icon: "palette", startAt: day(3), dueAt: day(40), sharedWithClient: false,
      createdByUserId: "usr_maya", createdAt: daysAgo(4), updatedAt: daysAgo(4),
    },
  ];

  const projectMembers: ProjectMember[] = [
    ...pm("prj_website", "org_kinetic", "usr_emma", ["usr_liam", "usr_sophia", "usr_ava"]),
    ...pm("prj_mobile", "org_kinetic", "usr_emma", ["usr_sophia", "usr_liam", "usr_ethan"]),
    ...pm("prj_brand", "org_kinetic", "usr_noah", ["usr_liam", "usr_ava"]),
    ...pm("prj_ecom", "org_kinetic", "usr_sophia", ["usr_liam", "usr_ethan", "usr_emma"]),
    ...pm("prj_campaign", "org_kinetic", "usr_noah", ["usr_ava", "usr_ethan"]),
    ...pm("prj_meridian", "org_kinetic", "usr_emma", ["usr_liam"]),
    ...pm("prj_seo", "org_kinetic", "usr_ava", ["usr_noah"]),
    ...pm("prj_site", "org_kinetic", "usr_alex", ["usr_liam", "usr_sophia"]),
    ...pm("prj_orbit", "org_lumen", "usr_maya", ["usr_leo", "usr_alex"]),
    ...pm("prj_lumen_site", "org_lumen", "usr_maya", ["usr_leo"]),
  ];

  function pm(projectId: ID, organizationId: ID, lead: ID, contributors: ID[]): ProjectMember[] {
    return [
      { id: `pm_${projectId}_${lead}`, organizationId, projectId, userId: lead, projectRole: "lead" },
      ...contributors.map((userId) => ({
        id: `pm_${projectId}_${userId}`,
        organizationId,
        projectId,
        userId,
        projectRole: "contributor" as const,
      })),
    ];
  }

  /* ---------------- Milestones ---------------- */

  const milestones: Milestone[] = [
    ms("ms_web_1", "prj_website", 1, "Discovery & sitemap", -34, "completed", true, "Interviews, content audit and an approved sitemap."),
    ms("ms_web_2", "prj_website", 2, "Visual design", 3, "in_progress", true, "Homepage, inner templates and the design system."),
    ms("ms_web_3", "prj_website", 3, "Front-end build", 10, "upcoming", false, "Component library and CMS integration."),
    ms("ms_web_4", "prj_website", 4, "QA & launch", 13, "upcoming", true, "Accessibility audit, redirects and go-live."),
    ms("ms_mob_1", "prj_mobile", 1, "Product discovery", 8, "in_progress", false, "Workshops, competitor review and the MVP scope."),
    ms("ms_mob_2", "prj_mobile", 2, "UX prototype", 22, "upcoming", true, "Clickable prototype of the core sales flows."),
    ms("ms_mob_3", "prj_mobile", 3, "Beta build", 45, "upcoming", true, "TestFlight and Play internal testing builds."),
    ms("ms_brand_1", "prj_brand", 1, "Brand strategy", -70, "completed", true),
    ms("ms_brand_2", "prj_brand", 2, "Identity design", -40, "completed", true),
    ms("ms_brand_3", "prj_brand", 3, "Guidelines document", -12, "completed", true),
    ms("ms_eco_1", "prj_ecom", 1, "Catalogue & checkout UX", -15, "completed", true),
    ms("ms_eco_2", "prj_ecom", 2, "Storefront build", 6, "in_progress", false),
    ms("ms_eco_3", "prj_ecom", 3, "Payments & QA", 18, "upcoming", true),
    ms("ms_cmp_1", "prj_campaign", 1, "Campaign concept", -25, "completed", true),
    ms("ms_cmp_2", "prj_campaign", 2, "Creative production", 15, "in_progress", true),
    ms("ms_mer_1", "prj_meridian", 1, "Research plan", 14, "upcoming", false),
    ms("ms_seo_1", "prj_seo", 1, "Research", -10, "completed", true),
    ms("ms_seo_2", "prj_seo", 2, "Content plan", 2, "awaiting_approval", true),
    ms("ms_orb_1", "prj_orbit", 1, "Onboarding flow", 10, "in_progress", true),
  ];

  function ms(
    id: ID,
    projectId: ID,
    position: number,
    title: string,
    dueOffset: number,
    status: Milestone["status"],
    approvalRequired: boolean,
    description?: string,
  ): Milestone {
    const project = projects.find((item) => item.id === projectId)!;
    return {
      id,
      organizationId: project.organizationId,
      projectId,
      title,
      description,
      position,
      dueAt: day(dueOffset),
      status,
      approvalRequired,
      completedAt: status === "completed" ? day(dueOffset + 1) : undefined,
    };
  }

  /* ---------------- Tasks ---------------- */

  type TaskRow = [
    id: string,
    title: string,
    status: TaskStatus,
    priority: Priority,
    dueOffset: number | null,
    assignee: ID | null,
    milestoneId: ID | null,
    completedDaysAgo?: number,
    visibility?: Visibility,
  ];

  const taskRows: Record<ID, TaskRow[]> = {
    prj_website: [
      ["tsk_w01", "Stakeholder interviews", "done", "high", -44, "usr_emma", "ms_web_1", 44],
      ["tsk_w02", "Content audit of current site", "done", "medium", -40, "usr_ava", "ms_web_1", 41],
      ["tsk_w03", "Sitemap and user flows", "done", "high", -36, "usr_liam", "ms_web_1", 36],
      ["tsk_w04", "Design homepage layout", "in_progress", "high", 1, "usr_liam", "ms_web_2"],
      ["tsk_w05", "Inner page templates", "in_progress", "medium", 3, "usr_liam", "ms_web_2"],
      ["tsk_w06", "Design system tokens", "in_review", "medium", 0, "usr_sophia", "ms_web_2"],
      ["tsk_w07", "Write homepage copy", "done", "medium", -6, "usr_ava", "ms_web_2", 6],
      ["tsk_w08", "Review analytics report", "todo", "low", 5, "usr_emma", null, undefined, "internal"],
      ["tsk_w09", "Set up Next.js project and CMS", "todo", "medium", 6, "usr_sophia", "ms_web_3"],
      ["tsk_w10", "Build component library", "todo", "high", 9, "usr_sophia", "ms_web_3"],
      ["tsk_w11", "Accessibility audit", "todo", "medium", 11, "usr_sophia", "ms_web_4"],
      ["tsk_w12", "Launch checklist and redirects", "todo", "high", 13, "usr_emma", "ms_web_4"],
    ],
    prj_mobile: [
      ["tsk_m01", "Kick-off workshop", "done", "high", -5, "usr_emma", "ms_mob_1", 5],
      ["tsk_m02", "Competitor teardown", "done", "medium", -3, "usr_liam", "ms_mob_1", 3],
      ["tsk_m03", "Prepare client presentation", "todo", "medium", 2, "usr_emma", "ms_mob_1"],
      ["tsk_m04", "Define MVP feature list", "in_progress", "high", 4, "usr_emma", "ms_mob_1"],
      ["tsk_m05", "Onboarding screens", "in_progress", "high", 12, "usr_liam", "ms_mob_2"],
      ["tsk_m06", "Motion spec for transitions", "todo", "low", 18, "usr_ethan", "ms_mob_2"],
      ["tsk_m07", "Choose React Native stack", "todo", "medium", 7, "usr_sophia", "ms_mob_1", undefined, "internal"],
      ["tsk_m08", "Set up CI for app builds", "todo", "medium", 25, "usr_sophia", "ms_mob_3", undefined, "internal"],
    ],
    prj_brand: [
      ["tsk_b01", "Brand workshop", "done", "high", -78, "usr_noah", "ms_brand_1", 78],
      ["tsk_b02", "Positioning statement", "done", "high", -72, "usr_noah", "ms_brand_1", 71],
      ["tsk_b03", "Logo concepts", "done", "high", -55, "usr_liam", "ms_brand_2", 56],
      ["tsk_b04", "Colour and type system", "done", "medium", -46, "usr_liam", "ms_brand_2", 47],
      ["tsk_b05", "Update brand assets", "done", "low", -20, "usr_liam", "ms_brand_3", 21],
      ["tsk_b06", "Guidelines PDF layout", "done", "medium", -14, "usr_ava", "ms_brand_3", 15],
      ["tsk_b07", "Final handover", "done", "medium", -12, "usr_noah", "ms_brand_3", 12],
    ],
    prj_ecom: [
      ["tsk_e01", "Checkout flow prototype", "done", "high", -18, "usr_liam", "ms_eco_1", 18],
      ["tsk_e02", "Product listing filters UX", "done", "medium", -16, "usr_liam", "ms_eco_1", 16],
      ["tsk_e03", "Fix responsive issues", "blocked", "urgent", -1, "usr_sophia", "ms_eco_2"],
      ["tsk_e04", "Product page build", "in_progress", "high", 3, "usr_sophia", "ms_eco_2"],
      ["tsk_e05", "Cart drawer interactions", "in_review", "medium", 2, "usr_ethan", "ms_eco_2"],
      ["tsk_e06", "Product photography guidelines", "done", "low", -8, "usr_liam", "ms_eco_2", 9],
      ["tsk_e07", "Stripe payment integration", "todo", "high", 12, "usr_sophia", "ms_eco_3"],
      ["tsk_e08", "Cross-browser QA", "todo", "medium", 16, "usr_emma", "ms_eco_3"],
      ["tsk_e09", "Performance budget review", "todo", "medium", -3, "usr_sophia", "ms_eco_2", undefined, "internal"],
    ],
    prj_campaign: [
      ["tsk_c01", "Campaign concept deck", "done", "high", -27, "usr_noah", "ms_cmp_1", 27],
      ["tsk_c02", "Write campaign copy", "in_progress", "medium", -2, "usr_ava", "ms_cmp_2"],
      ["tsk_c03", "Edit hero film", "in_progress", "high", 6, "usr_ethan", "ms_cmp_2"],
      ["tsk_c04", "Social cut-downs", "todo", "medium", 12, "usr_ethan", "ms_cmp_2"],
    ],
    prj_meridian: [
      ["tsk_r01", "Draft research plan", "todo", "high", 5, "usr_emma", "ms_mer_1"],
      ["tsk_r02", "Recruit interview participants", "todo", "medium", 9, "usr_emma", "ms_mer_1"],
      ["tsk_r03", "HIPAA compliance checklist", "todo", "high", 7, "usr_emma", "ms_mer_1", undefined, "internal"],
    ],
    prj_seo: [
      ["tsk_s01", "Keyword research", "done", "high", -12, "usr_noah", "ms_seo_1", 12],
      ["tsk_s02", "Competitor content gap analysis", "done", "medium", -9, "usr_noah", "ms_seo_1", 10],
      ["tsk_s03", "Q4 content calendar", "done", "high", -2, "usr_ava", "ms_seo_2", 2],
      ["tsk_s04", "Meta descriptions for top 40 pages", "in_progress", "medium", 4, "usr_ava", "ms_seo_2"],
    ],
    prj_site: [
      ["tsk_k01", "Homepage hero animation", "done", "medium", -4, "usr_liam", null, 4, "internal"],
      ["tsk_k02", "New case study template", "in_progress", "medium", 6, "usr_liam", null, undefined, "internal"],
      ["tsk_k03", "Rewrite services copy", "todo", "high", 10, "usr_alex", null, undefined, "internal"],
      ["tsk_k04", "Migrate blog to MDX", "todo", "low", 15, "usr_sophia", null, undefined, "internal"],
    ],
    prj_orbit: [
      ["tsk_o01", "Onboarding wireframes", "in_review", "high", 1, "usr_leo", "ms_orb_1"],
      ["tsk_o02", "Identity verification copy", "todo", "medium", 5, "usr_maya", "ms_orb_1"],
      ["tsk_o03", "Usability test script", "todo", "medium", 8, "usr_leo", "ms_orb_1"],
    ],
    prj_lumen_site: [["tsk_l01", "Moodboard", "todo", "medium", 6, "usr_leo", null, undefined, "internal"]],
  };

  const tasks: Task[] = Object.entries(taskRows).flatMap(([projectId, rows]) => {
    const project = projects.find((item) => item.id === projectId)!;
    return rows.map(([id, title, status, priority, dueOffset, assignee, milestoneId, completedDaysAgo, visibility]) => ({
      id,
      organizationId: project.organizationId,
      projectId,
      milestoneId: milestoneId ?? undefined,
      title,
      status,
      priority,
      dueAt: dueOffset === null ? undefined : day(dueOffset),
      assigneeUserId: assignee ?? undefined,
      createdByUserId: project.createdByUserId,
      clientVisible: visibility !== "internal",
      createdAt: project.createdAt,
      completedAt: completedDaysAgo === undefined ? undefined : daysAgo(completedDaysAgo, 15),
    }));
  });

  // Descriptions for the tasks people open most in the demo.
  const descriptions: Record<ID, string> = {
    tsk_w04: "Desktop and mobile homepage based on the approved sitemap. Hero must include the new value proposition and a single primary CTA.",
    tsk_e03: "Product grid breaks between 768px and 900px. Waiting on final image ratios from ShopEase before fixing the card component.",
    tsk_m03: "Twelve-slide deck covering discovery findings, proposed MVP scope and the timeline to beta.",
    tsk_c02: "Headline, body and CTA variants for the landing page and three social formats.",
  };
  for (const task of tasks) task.description = descriptions[task.id];

  /* ---------------- Deliverables, versions, approvals ---------------- */

  const deliverables: Deliverable[] = [];
  const deliverableVersions: DeliverableVersion[] = [];
  const approvals: Approval[] = [];

  type VersionRow = [fileName: string, mimeType: string, sizeBytes: number, uploader: ID, daysAgo: number, note?: string];
  type ApprovalRow = [version: number, clientUser: ID, decision: Approval["decision"], daysAgo: number, comment?: string];

  function deliverable(
    id: ID,
    projectId: ID,
    milestoneId: ID | undefined,
    title: string,
    status: Deliverable["status"],
    description: string,
    versions: VersionRow[],
    decisions: ApprovalRow[] = [],
    submittedHoursAgo?: number,
  ) {
    const project = projects.find((item) => item.id === projectId)!;
    const created = versions[0][4];
    const latest = versions[versions.length - 1][4];
    deliverables.push({
      id,
      organizationId: project.organizationId,
      projectId,
      milestoneId,
      title,
      description,
      status,
      currentVersion: versions.length,
      createdByUserId: versions[0][3],
      createdAt: daysAgo(created, 10),
      updatedAt: daysAgo(latest, 16),
      submittedAt: submittedHoursAgo !== undefined ? hoursAgo(submittedHoursAgo) : status === "draft" ? undefined : daysAgo(latest, 16),
    });
    versions.forEach(([fileName, mimeType, sizeBytes, uploader, ago, note], index) => {
      deliverableVersions.push({
        id: `${id}_v${index + 1}`,
        organizationId: project.organizationId,
        deliverableId: id,
        version: index + 1,
        fileName,
        mimeType,
        sizeBytes,
        storageKey: `org/${project.organizationId}/projects/${projectId}/deliverables/${id}/v${index + 1}/${fileName}`,
        note,
        uploadedByUserId: uploader,
        createdAt: daysAgo(ago, 16),
      });
    });
    decisions.forEach(([version, clientUserId, decision, ago, comment], index) => {
      approvals.push({
        id: `apr_${id}_${index + 1}`,
        organizationId: project.organizationId,
        deliverableId: id,
        versionId: `${id}_v${version}`,
        version,
        clientUserId,
        decision,
        comment,
        decidedAt: daysAgo(ago, 13),
      });
    });
  }

  deliverable("dlv_sitemap", "prj_website", "ms_web_1", "Sitemap & user flows", "approved",
    "Proposed site structure and the five priority user journeys.",
    [
      ["acme-sitemap-v1.pdf", "application/pdf", 2.1 * MB, "usr_liam", 38],
      ["acme-sitemap-v2.pdf", "application/pdf", 2.4 * MB, "usr_liam", 35, "Merged Resources and Blog into one section, as requested."],
    ],
    [
      [1, "usr_daniel", "changes_requested", 37, "Can we merge Resources and Blog into one section? Our team only updates them together."],
      [2, "usr_daniel", "approved", 34, "Looks right. Approved."],
    ]);

  deliverable("dlv_homepage", "prj_website", "ms_web_2", "Homepage mockup", "in_review",
    "Desktop and mobile homepage design, including hover states and the cookie banner.",
    [
      ["homepage-mockup-v1.png", "image/png", 4.8 * MB, "usr_liam", 14],
      ["homepage-mockup-v2.png", "image/png", 5.1 * MB, "usr_liam", 7, "Simplified the hero and moved testimonials above the fold."],
      ["homepage-mockup-v3.png", "image/png", 5.3 * MB, "usr_liam", 1, "Shorter headline, 'Book a demo' as the primary CTA, mobile breakpoints added."],
    ],
    [[2, "usr_daniel", "changes_requested", 5, "Love the direction. The hero headline feels long and the CTA should say 'Book a demo'."]],
    20);

  deliverable("dlv_templates", "prj_website", "ms_web_2", "Inner page templates", "draft",
    "Product, article and contact page templates.",
    [["inner-templates-v1.pdf", "application/pdf", 12.6 * MB, "usr_liam", 2]]);

  deliverable("dlv_tokens", "prj_website", "ms_web_2", "Design system tokens", "changes_requested",
    "Colour, type, spacing and radius tokens with usage examples.",
    [["acme-design-tokens.pdf", "application/pdf", 1.9 * MB, "usr_sophia", 6]],
    [[1, "usr_daniel", "changes_requested", 4, "The secondary green is very close to a competitor's brand. Could we try a warmer accent?"]]);

  deliverable("dlv_screens", "prj_mobile", "ms_mob_2", "Mobile app screens", "in_review",
    "First pass of onboarding, pipeline and visit check-in screens.",
    [["novatech-app-screens-v1.pdf", "application/pdf", 18.4 * MB, "usr_liam", 3]],
    [], 70);

  deliverable("dlv_mvp", "prj_mobile", "ms_mob_1", "MVP feature matrix", "approved",
    "Must, should and could features for the first release, with effort estimates.",
    [["mvp-feature-matrix.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 220 * 1024, "usr_emma", 4]],
    [[1, "usr_priya", "approved", 2, "Agreed on scope. Approved."]]);

  deliverable("dlv_guidelines", "prj_brand", "ms_brand_3", "Brand guidelines PDF", "approved",
    "The complete 48-page brand book.",
    [
      ["pulse-guidelines-v1.pdf", "application/pdf", 24 * MB, "usr_ava", 30],
      ["pulse-guidelines-v2.pdf", "application/pdf", 24.8 * MB, "usr_ava", 24, "Added web type scale."],
      ["pulse-guidelines-v3.pdf", "application/pdf", 25.6 * MB, "usr_ava", 18, "Fixed logo clear-space page."],
      ["pulse-guidelines-v4.pdf", "application/pdf", 26.2 * MB, "usr_ava", 13, "Final proofread."],
    ],
    [
      [1, "usr_marcus", "changes_requested", 27, "The typography section needs the web font sizes too."],
      [2, "usr_marcus", "changes_requested", 21, "Logo clear-space diagram is cut off on page 14."],
      [3, "usr_marcus", "changes_requested", 16, "Two typos on page 31. Otherwise ready."],
      [4, "usr_marcus", "approved", 12, "Perfect. Approved for release."],
    ]);

  deliverable("dlv_logo", "prj_brand", "ms_brand_2", "Logo suite", "approved",
    "Primary, secondary and icon marks in all formats.",
    [
      ["pulse-logo-suite-v1.zip", "application/zip", 48 * MB, "usr_liam", 50],
      ["pulse-logo-suite-v2.zip", "application/zip", 51 * MB, "usr_liam", 45, "Tightened the icon at small sizes."],
    ],
    [
      [1, "usr_marcus", "changes_requested", 48, "Icon gets muddy at 16px."],
      [2, "usr_marcus", "approved", 44],
    ]);

  deliverable("dlv_checkout", "prj_ecom", "ms_eco_1", "Checkout flow prototype", "approved",
    "Clickable prototype of cart, guest checkout and payment.",
    [
      ["shopease-checkout-v1.pdf", "application/pdf", 8.2 * MB, "usr_liam", 20],
      ["shopease-checkout-v2.pdf", "application/pdf", 8.9 * MB, "usr_liam", 17, "Guest checkout is now the default path."],
    ],
    [
      [1, "usr_hannah", "changes_requested", 19, "Guest checkout must come first. Account creation can be offered after payment."],
      [2, "usr_hannah", "approved", 15, "Great, approved."],
    ]);

  deliverable("dlv_product", "prj_ecom", "ms_eco_2", "Product page walkthrough", "in_review",
    "Screen recording of the product page on staging, with variant switching and reviews.",
    [["product-page-walkthrough.mp4", "video/mp4", 1.2 * GB, "usr_sophia", 1]],
    [], 30);

  deliverable("dlv_creative", "prj_campaign", "ms_cmp_2", "Campaign creative", "changes_requested",
    "Hero film and key visuals.",
    [
      ["brightpath-key-visuals-v1.pdf", "application/pdf", 32 * MB, "usr_ethan", 20],
      ["brightpath-hero-film-v2.mp4", "video/mp4", 2.8 * GB, "usr_ethan", 9, "First full cut of the hero film."],
    ],
    [[2, "usr_omar", "changes_requested", 8, "Pausing until our budget is confirmed. The music will need to be licence-free."]]);

  deliverable("dlv_calendar", "prj_seo", "ms_seo_2", "Q4 content calendar", "in_review",
    "Twelve weeks of articles mapped to target keywords.",
    [["q4-content-calendar.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 340 * 1024, "usr_ava", 1]],
    [], 26);

  deliverable("dlv_keywords", "prj_seo", "ms_seo_1", "Keyword research report", "approved",
    "Priority keywords with volume, difficulty and intent.",
    [["keyword-research.pdf", "application/pdf", 3.2 * MB, "usr_noah", 11]],
    [[1, "usr_daniel", "approved", 10, "Clear and useful. Approved."]]);

  deliverable("dlv_orbit_wire", "prj_orbit", "ms_orb_1", "Onboarding wireframes", "in_review",
    "Low-fidelity wireframes for sign-up and KYC.",
    [["orbit-onboarding-wireframes.pdf", "application/pdf", 6 * MB, "usr_leo", 2]],
    [], 40);

  /* ---------------- Comments ---------------- */

  const comments: Comment[] = [];
  function comment(id: ID, projectId: ID, target: { taskId?: ID; deliverableId?: ID }, author: ID, body: string, visibility: Visibility, at: string) {
    const project = projects.find((item) => item.id === projectId)!;
    comments.push({ id, organizationId: project.organizationId, projectId, ...target, authorUserId: author, body, visibility, createdAt: at });
  }

  comment("cmt_01", "prj_website", { deliverableId: "dlv_homepage" }, "usr_daniel", "Love the direction overall. The hero headline feels long and our CTA should say 'Book a demo'.", "client", daysAgo(5, 14));
  comment("cmt_02", "prj_website", { deliverableId: "dlv_homepage" }, "usr_liam", "Thanks Daniel. v3 cuts the headline to seven words and uses 'Book a demo' as the primary CTA. Mobile breakpoints are on pages 4 and 5.", "client", daysAgo(1, 16));
  comment("cmt_03", "prj_website", { deliverableId: "dlv_homepage" }, "usr_emma", "Daniel's CEO joins the review on Thursday. Keep the testimonial carousel static until then.", "internal", hoursAgo(22));
  comment("cmt_04", "prj_website", { deliverableId: "dlv_homepage" }, "usr_chris", "Is the mobile menu final? The icons look slightly different from our app.", "client", hoursAgo(6));
  comment("cmt_05", "prj_website", { deliverableId: "dlv_tokens" }, "usr_daniel", "The secondary green is very close to a competitor's brand. Could we try a warmer accent?", "client", daysAgo(4, 13));
  comment("cmt_06", "prj_website", { deliverableId: "dlv_tokens" }, "usr_sophia", "Trying amber #E8A33D and a coral. I'll send both options tomorrow.", "internal", daysAgo(3, 10));
  comment("cmt_07", "prj_mobile", { deliverableId: "dlv_screens" }, "usr_priya", "Can we also see a dark mode version of the pipeline screen?", "client", daysAgo(2, 9));
  comment("cmt_08", "prj_mobile", { deliverableId: "dlv_screens" }, "usr_liam", "Yes. Dark mode frames will be in v2 later this week.", "client", daysAgo(1, 11));
  comment("cmt_09", "prj_ecom", { deliverableId: "dlv_product" }, "usr_hannah", "The video stops at 2:10 for me. Is it just my connection?", "client", hoursAgo(20));
  comment("cmt_10", "prj_ecom", { deliverableId: "dlv_product" }, "usr_emma", "Re-exporting at 1080p. The original was 4K, which is why it stalls.", "internal", hoursAgo(18));
  comment("cmt_11", "prj_ecom", { taskId: "tsk_e03" }, "usr_sophia", "Blocked on the final product image ratios from ShopEase. Asked Hannah on Monday.", "internal", daysAgo(1, 10));
  comment("cmt_12", "prj_ecom", { taskId: "tsk_e03" }, "usr_emma", "I'll raise it on Thursday's call. Let's not wait: use 4:5 for now.", "internal", hoursAgo(9));
  comment("cmt_13", "prj_campaign", { deliverableId: "dlv_creative" }, "usr_omar", "Pausing until our budget is confirmed. The music will need to be licence-free.", "client", daysAgo(8, 12));
  comment("cmt_14", "prj_seo", { deliverableId: "dlv_calendar" }, "usr_noah", "Weeks 6 to 8 lean on the product launch. Worth flagging to Daniel.", "internal", hoursAgo(25));
  comment("cmt_15", "prj_orbit", { deliverableId: "dlv_orbit_wire" }, "usr_zara", "Could the ID scan step come after the account is created?", "client", hoursAgo(28));

  /* ---------------- Files ---------------- */

  const files: ProjectFile[] = [];
  function file(id: ID, projectId: ID, name: string, mimeType: string, sizeBytes: number, uploader: ID, ago: number, visibility: Visibility) {
    const project = projects.find((item) => item.id === projectId)!;
    files.push({
      id,
      organizationId: project.organizationId,
      projectId,
      name,
      mimeType,
      sizeBytes,
      storageKey: `org/${project.organizationId}/projects/${projectId}/files/${id}/${name}`,
      visibility,
      uploadedByUserId: uploader,
      createdAt: daysAgo(ago, 12),
    });
  }

  file("fil_01", "prj_website", "Signed statement of work.pdf", "application/pdf", 380 * 1024, "usr_alex", 50, "client");
  file("fil_02", "prj_website", "Acme brand assets.zip", "application/zip", 640 * MB, "usr_emma", 46, "client");
  file("fil_03", "prj_website", "Interview notes.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 120 * 1024, "usr_emma", 44, "internal");
  file("fil_04", "prj_mobile", "NovaTech project brief.pdf", "application/pdf", 1.4 * MB, "usr_emma", 7, "client");
  file("fil_05", "prj_mobile", "Discovery workshop recordings.zip", "application/zip", 3.4 * GB, "usr_ethan", 4, "internal");
  file("fil_06", "prj_brand", "Brand workshop photos.zip", "application/zip", 860 * MB, "usr_noah", 76, "internal");
  file("fil_07", "prj_brand", "Final brand assets.zip", "application/zip", 1.6 * GB, "usr_liam", 12, "client");
  file("fil_08", "prj_ecom", "Product photo shoot (raw).zip", "application/zip", 6.2 * GB, "usr_liam", 10, "internal");
  file("fil_09", "prj_ecom", "Payment provider contract.pdf", "application/pdf", 610 * 1024, "usr_alex", 25, "internal");
  file("fil_10", "prj_campaign", "Raw footage day 1.zip", "application/zip", 9.8 * GB, "usr_ethan", 14, "internal");
  file("fil_11", "prj_seo", "Content style guide.pdf", "application/pdf", 2.2 * MB, "usr_ava", 15, "client");
  file("fil_12", "prj_orbit", "Orbit research synthesis.pdf", "application/pdf", 4.1 * MB, "usr_leo", 18, "client");

  /* ---------------- Activity ---------------- */

  const activity: ActivityEvent[] = [];
  function act(
    id: ID,
    organizationId: ID,
    projectId: ID | undefined,
    actor: ID,
    verb: ActivityEvent["verb"],
    targetType: ActivityEvent["targetType"],
    targetId: ID,
    targetLabel: string,
    at: string,
    visibility: Visibility = "client",
  ) {
    activity.push({ id, organizationId, projectId, actorUserId: actor, verb, targetType, targetId, targetLabel, visibility, createdAt: at });
  }

  act("act_01", "org_kinetic", "prj_website", "usr_chris", "comment.posted", "deliverable", "dlv_homepage", "Homepage mockup", hoursAgo(6));
  act("act_02", "org_kinetic", "prj_ecom", "usr_sophia", "deliverable.submitted", "deliverable", "dlv_product", "Product page walkthrough", hoursAgo(30));
  act("act_03", "org_kinetic", "prj_website", "usr_liam", "deliverable.uploaded", "deliverable", "dlv_homepage", "Homepage mockup v3", hoursAgo(20));
  act("act_04", "org_kinetic", "prj_ecom", "usr_hannah", "comment.posted", "deliverable", "dlv_product", "Product page walkthrough", hoursAgo(20));
  act("act_05", "org_kinetic", "prj_seo", "usr_ava", "deliverable.submitted", "deliverable", "dlv_calendar", "Q4 content calendar", hoursAgo(26));
  act("act_06", "org_kinetic", "prj_mobile", "usr_priya", "deliverable.approved", "deliverable", "dlv_mvp", "MVP feature matrix", daysAgo(2, 13));
  act("act_07", "org_kinetic", "prj_mobile", "usr_liam", "deliverable.submitted", "deliverable", "dlv_screens", "Mobile app screens", daysAgo(3, 15));
  act("act_08", "org_kinetic", "prj_seo", "usr_ava", "task.completed", "task", "tsk_s03", "Q4 content calendar", daysAgo(2, 15));
  act("act_09", "org_kinetic", "prj_website", "usr_daniel", "deliverable.changes_requested", "deliverable", "dlv_tokens", "Design system tokens", daysAgo(4, 13));
  act("act_10", "org_kinetic", "prj_site", "usr_liam", "task.completed", "task", "tsk_k01", "Homepage hero animation", daysAgo(4, 15), "internal");
  act("act_11", "org_kinetic", "prj_meridian", "usr_emma", "project.created", "project", "prj_meridian", "Patient Portal UX", daysAgo(5, 10), "internal");
  act("act_12", "org_kinetic", "prj_mobile", "usr_ethan", "file.uploaded", "file", "fil_05", "Discovery workshop recordings.zip", daysAgo(4, 12), "internal");
  act("act_13", "org_kinetic", undefined, "usr_alex", "client.added", "client", "cli_meridian", "Meridian Health", daysAgo(6, 9), "internal");
  act("act_14", "org_kinetic", "prj_website", "usr_daniel", "deliverable.changes_requested", "deliverable", "dlv_homepage", "Homepage mockup v2", daysAgo(5, 13));
  act("act_15", "org_kinetic", "prj_campaign", "usr_omar", "deliverable.changes_requested", "deliverable", "dlv_creative", "Campaign creative", daysAgo(8, 13));
  act("act_16", "org_kinetic", "prj_mobile", "usr_emma", "project.created", "project", "prj_mobile", "Mobile App Launch", daysAgo(8, 9));
  act("act_17", "org_kinetic", "prj_brand", "usr_marcus", "deliverable.approved", "deliverable", "dlv_guidelines", "Brand guidelines PDF", daysAgo(12, 13));
  act("act_18", "org_kinetic", "prj_brand", "usr_noah", "milestone.completed", "milestone", "ms_brand_3", "Guidelines document", daysAgo(11, 10));
  act("act_19", "org_kinetic", "prj_ecom", "usr_hannah", "deliverable.approved", "deliverable", "dlv_checkout", "Checkout flow prototype", daysAgo(15, 13));
  act("act_20", "org_kinetic", undefined, "usr_emma", "member.invited", "member", "inv_01", "jordan@kinetic.example", daysAgo(2, 10), "internal");
  act("act_21", "org_lumen", "prj_orbit", "usr_leo", "deliverable.submitted", "deliverable", "dlv_orbit_wire", "Onboarding wireframes", hoursAgo(40));
  act("act_22", "org_lumen", "prj_orbit", "usr_zara", "comment.posted", "deliverable", "dlv_orbit_wire", "Onboarding wireframes", hoursAgo(28));

  /* ---------------- Notifications ---------------- */

  const notifications: Notification[] = [];
  function notify(id: ID, organizationId: ID, recipient: ID, type: Notification["type"], title: string, body: string, href: string, at: string, read = false) {
    notifications.push({ id, organizationId, recipientUserId: recipient, type, title, body, href, createdAt: at, readAt: read ? at : undefined });
  }

  const k = "/w/kinetic";
  notify("ntf_01", "org_kinetic", "usr_alex", "comment.posted", "Chris Morgan commented on Homepage mockup", "Is the mobile menu final? The icons look slightly different from our app.", `${k}/projects/prj_website/deliverables/dlv_homepage`, hoursAgo(6));
  notify("ntf_02", "org_kinetic", "usr_alex", "deliverable.submitted", "Product page walkthrough is waiting for ShopEase", "Sophia submitted v1 for client review.", `${k}/projects/prj_ecom/deliverables/dlv_product`, hoursAgo(30));
  notify("ntf_03", "org_kinetic", "usr_alex", "deliverable.approved", "Priya Shah approved MVP feature matrix", "Agreed on scope. Approved.", `${k}/projects/prj_mobile/deliverables/dlv_mvp`, daysAgo(2, 13));
  notify("ntf_04", "org_kinetic", "usr_alex", "deliverable.changes_requested", "Daniel Reed requested changes to Design system tokens", "The secondary green is very close to a competitor's brand.", `${k}/projects/prj_website/deliverables/dlv_tokens`, daysAgo(4, 13), true);
  notify("ntf_05", "org_kinetic", "usr_alex", "task.assigned", "You were assigned Rewrite services copy", "Kinetic Website Refresh · due in 10 days", `${k}/projects/prj_site/tasks`, daysAgo(5, 9), true);
  notify("ntf_06", "org_kinetic", "usr_alex", "billing.invoice_paid", "Invoice INV-2026-010 paid", "$49.00 charged to Visa ending 4242.", `${k}/billing`, daysAgo(13, 9), true);
  notify("ntf_07", "org_kinetic", "usr_emma", "comment.posted", "Hannah Cole commented on Product page walkthrough", "The video stops at 2:10 for me.", `${k}/projects/prj_ecom/deliverables/dlv_product`, hoursAgo(20));
  notify("ntf_08", "org_kinetic", "usr_emma", "task.due_soon", "Prepare client presentation is due in 2 days", "Mobile App Launch", `${k}/projects/prj_mobile/tasks`, hoursAgo(10));
  notify("ntf_09", "org_kinetic", "usr_daniel", "deliverable.submitted", "Homepage mockup v3 is ready for your review", "Kinetic Studio uploaded a new version.", "/portal/kinetic/deliverables/dlv_homepage", hoursAgo(20));
  notify("ntf_10", "org_kinetic", "usr_daniel", "deliverable.submitted", "Q4 content calendar is ready for your review", "SEO & Content Sprint", "/portal/kinetic/deliverables/dlv_calendar", hoursAgo(26));
  notify("ntf_11", "org_kinetic", "usr_priya", "deliverable.submitted", "Mobile app screens are ready for your review", "Mobile App Launch", "/portal/kinetic/deliverables/dlv_screens", daysAgo(3, 15));
  notify("ntf_12", "org_kinetic", "usr_hannah", "deliverable.submitted", "Product page walkthrough is ready for your review", "E-commerce Platform", "/portal/kinetic/deliverables/dlv_product", hoursAgo(30));
  notify("ntf_13", "org_kinetic", "usr_olivia", "billing.invoice_paid", "Invoice INV-2026-010 paid", "$49.00 charged to Visa ending 4242.", `${k}/billing`, daysAgo(13, 9));
  notify("ntf_14", "org_lumen", "usr_alex", "deliverable.submitted", "Onboarding wireframes sent to Orbit Fintech", "Leo submitted v1 for review.", "/w/lumen/projects/prj_orbit/deliverables/dlv_orbit_wire", hoursAgo(40));

  /* ---------------- Invitations ---------------- */

  const invitations: Invitation[] = [
    { id: "inv_01", organizationId: "org_kinetic", email: "jordan@kinetic.example", kind: "team", role: "member", status: "pending", invitedByUserId: "usr_emma", createdAt: daysAgo(2, 10), expiresAt: day(5) },
    { id: "inv_02", organizationId: "org_kinetic", email: "grace.turner@meridian.example", kind: "client", role: "approver", clientId: "cli_meridian", status: "pending", invitedByUserId: "usr_alex", createdAt: daysAgo(1, 9), expiresAt: day(6) },
    { id: "inv_03", organizationId: "org_kinetic", email: "riley@kinetic.example", kind: "team", role: "manager", status: "expired", invitedByUserId: "usr_alex", createdAt: daysAgo(20, 10), expiresAt: day(-13) },
    { id: "inv_04", organizationId: "org_kinetic", email: "priya@novatech.example", kind: "client", role: "approver", clientId: "cli_novatech", status: "accepted", invitedByUserId: "usr_emma", createdAt: daysAgo(11, 10), expiresAt: day(-4), acceptedAt: daysAgo(10, 9) },
    { id: "inv_05", organizationId: "org_lumen", email: "sana@lumen.example", kind: "team", role: "member", status: "pending", invitedByUserId: "usr_maya", createdAt: daysAgo(1, 9), expiresAt: day(6) },
  ];

  /* ---------------- Audit log ---------------- */

  const auditLogs: AuditLog[] = [];
  function audit(id: ID, organizationId: ID, actor: ID | undefined, action: AuditLog["action"], entityType: string, entityId: ID, summary: string, at: string, metadata: AuditLog["metadata"] = {}, ip = "203.0.113.24") {
    auditLogs.push({ id, organizationId, actorUserId: actor, action, entityType, entityId, summary, metadata, ip, createdAt: at });
  }

  audit("aud_01", "org_kinetic", "usr_alex", "auth.sign_in", "user", "usr_alex", "Signed in", hoursAgo(1), { method: "password" });
  audit("aud_02", "org_kinetic", "usr_daniel", "file.downloaded", "deliverable_version", "dlv_homepage_v3", "Downloaded homepage-mockup-v3.png", hoursAgo(5), { project: "Website Redesign" }, "198.51.100.7");
  audit("aud_03", "org_kinetic", "usr_priya", "deliverable.approved", "deliverable", "dlv_mvp", "Approved MVP feature matrix (v1)", daysAgo(2, 13), { version: 1 }, "198.51.100.40");
  audit("aud_04", "org_kinetic", "usr_emma", "member.invited", "invitation", "inv_01", "Invited jordan@kinetic.example as Team member", daysAgo(2, 10), { role: "member" });
  audit("aud_05", "org_kinetic", "usr_alex", "client.access_granted", "invitation", "inv_02", "Invited grace.turner@meridian.example to the Meridian Health portal", daysAgo(1, 9), { role: "approver" });
  audit("aud_06", "org_kinetic", "usr_daniel", "deliverable.changes_requested", "deliverable", "dlv_tokens", "Requested changes on Design system tokens (v1)", daysAgo(4, 13), { version: 1 }, "198.51.100.7");
  audit("aud_07", "org_kinetic", "usr_alex", "client.created", "client", "cli_meridian", "Created client Meridian Health", daysAgo(6, 9));
  audit("aud_08", "org_kinetic", "usr_emma", "project.created", "project", "prj_meridian", "Created project Patient Portal UX", daysAgo(5, 10));
  audit("aud_09", "org_kinetic", "usr_emma", "project.created", "project", "prj_mobile", "Created project Mobile App Launch", daysAgo(8, 9));
  audit("aud_10", "org_kinetic", "usr_emma", "project.shared", "project", "prj_mobile", "Shared Mobile App Launch with NovaTech", daysAgo(8, 9));
  audit("aud_11", "org_kinetic", "usr_alex", "member.role_changed", "membership", "mem_k_emma", "Changed Emma Wilson from Team member to Manager", daysAgo(9, 15), { from: "member", to: "manager" });
  audit("aud_12", "org_kinetic", "usr_olivia", "data.exported", "export", "exp_01", "Exported invoices as CSV", daysAgo(13, 10), { rows: 10 });
  audit("aud_13", "org_kinetic", "usr_marcus", "deliverable.approved", "deliverable", "dlv_guidelines", "Approved Brand guidelines PDF (v4)", daysAgo(12, 13), { version: 4 }, "198.51.100.88");
  audit("aud_14", "org_kinetic", undefined, "billing.payment_failed", "invoice", "inv_k_7", "Payment failed for INV-2026-007 (card declined)", daysAgo(100, 8), { attempt: 1 }, undefined);
  audit("aud_15", "org_kinetic", "usr_olivia", "billing.plan_changed", "subscription", "sub_kinetic", "Changed plan from Starter to Professional", daysAgo(160, 11), { from: "starter", to: "professional" });
  audit("aud_16", "org_kinetic", "usr_alex", "workspace.updated", "organization", "org_kinetic", "Updated workspace timezone to America/New_York", daysAgo(30, 12), { field: "timezone" });
  audit("aud_17", "org_kinetic", "usr_alex", "invitation.revoked", "invitation", "inv_x", "Revoked invitation for temp@kinetic.example", daysAgo(22, 16));
  audit("aud_18", "org_lumen", "usr_maya", "project.created", "project", "prj_orbit", "Created project Orbit Onboarding Flow", daysAgo(26, 10));

  /* ---------------- Billing ---------------- */

  const subscriptions: Database["subscriptions"] = [
    { id: "sub_kinetic", organizationId: "org_kinetic", planKey: "professional", status: "active", interval: "month", currentPeriodEnd: day(17), cancelAtPeriodEnd: false, providerCustomerId: "cus_TEST_kinetic", providerSubscriptionId: "sub_TEST_kinetic", paymentMethod: { brand: "Visa", last4: "4242", expMonth: 8, expYear: 2028 } },
    { id: "sub_lumen", organizationId: "org_lumen", planKey: "starter", status: "trialing", interval: "month", currentPeriodEnd: day(9), cancelAtPeriodEnd: false, trialEndsAt: day(9) },
  ];

  const invoices: Invoice[] = Array.from({ length: 10 }, (_, index) => {
    const n = 10 - index;
    const issued = addDays(today, -13 - index * 30);
    return {
      id: `inv_k_${n}`,
      organizationId: "org_kinetic",
      number: `INV-2026-${String(n).padStart(3, "0")}`,
      amountCents: 4900,
      currency: "USD",
      status: n === 7 ? "void" : "paid",
      periodStart: issued.toISOString(),
      periodEnd: addDays(issued, 30).toISOString(),
      issuedAt: issued.toISOString(),
    } satisfies Invoice;
  });

  const webhookEvents: Database["webhookEvents"] = [
    { id: "whe_01", provider: "stripe", providerEventId: "evt_TEST_1Q9a", eventType: "invoice.paid", organizationId: "org_kinetic", status: "processed", receivedAt: daysAgo(13, 9), processedAt: daysAgo(13, 9) },
    { id: "whe_02", provider: "stripe", providerEventId: "evt_TEST_1Q9a", eventType: "invoice.paid", organizationId: "org_kinetic", status: "skipped_duplicate", receivedAt: daysAgo(13, 9) },
    { id: "whe_03", provider: "stripe", providerEventId: "evt_TEST_7Hx2", eventType: "customer.subscription.updated", organizationId: "org_lumen", status: "processed", receivedAt: daysAgo(4, 11), processedAt: daysAgo(4, 11) },
    { id: "whe_04", provider: "stripe", providerEventId: "evt_TEST_k31P", eventType: "invoice.payment_failed", organizationId: "org_kinetic", status: "failed", receivedAt: daysAgo(100, 8) },
  ];

  return {
    users,
    organizations,
    memberships,
    invitations,
    clients,
    clientMemberships,
    projects,
    projectMembers,
    milestones,
    tasks,
    deliverables,
    deliverableVersions,
    approvals,
    comments,
    files,
    activity,
    notifications,
    notificationPreferences: [],
    auditLogs,
    subscriptions,
    invoices,
    webhookEvents,
    integrations: [
      { organizationId: "org_kinetic", key: "slack", connectedAt: daysAgo(120), connectedByUserId: "usr_alex", account: "#kinetic-clients" },
      { organizationId: "org_kinetic", key: "google_drive", connectedAt: daysAgo(200), connectedByUserId: "usr_emma", account: "Kinetic Shared Drive" },
    ],
  };
}

/** Demo accounts shown on the sign-in screen. Password for all of them: "atrium-demo". */
export const DEMO_ACCOUNTS = [
  { userId: "usr_alex", label: "Agency owner", hint: "Everything, two workspaces", email: "alex@kinetic.example" },
  { userId: "usr_emma", label: "Project manager", hint: "All projects and clients", email: "emma@kinetic.example" },
  { userId: "usr_liam", label: "Team member", hint: "Only assigned projects", email: "liam@kinetic.example" },
  { userId: "usr_olivia", label: "Billing manager", hint: "Billing only, no project data", email: "olivia@kinetic.example" },
  { userId: "usr_daniel", label: "Client approver", hint: "Acme Co. portal, can approve", email: "daniel@acme.example" },
  { userId: "usr_chris", label: "Client viewer", hint: "Acme Co. portal, read and comment", email: "chris@acme.example" },
  { userId: "usr_sam", label: "Platform operator", hint: "Platform health and support", email: "sam@atrium.example" },
] as const;

export const DEMO_PASSWORD = "atrium-demo";
