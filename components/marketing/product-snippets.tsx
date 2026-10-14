import { Bell, CheckCircle2, Download, EyeOff, FileCheck2, MessageSquare, ShieldCheck, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, BrandTile } from "@/components/ui/avatar";
import { Badge, DeliverableStatusBadge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/misc";

/**
 * Small, static slices of the product UI used to illustrate features on the
 * marketing site. Names come from the demo workspace (Kinetic Studio and its
 * fictional clients) so they match what visitors see when they open the demo.
 */

function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn("rounded-xl border border-white/[0.07] bg-[#0b1722]/90 p-3 shadow-[0_12px_40px_rgba(0,0,0,.35)] sm:p-4", className)}
      aria-hidden="true"
    >
      {children}
    </div>
  );
}

export function PortalSnippet() {
  return (
    <Panel>
      <div className="flex items-center gap-2.5 border-b border-white/[0.06] pb-3">
        <BrandTile name="Acme Co." hue={12} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">Acme Co. portal</p>
          <p className="text-[11px] text-ink-faint">Shared by Kinetic Studio</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-ink">Homepage mockup · v3</p>
          <p className="text-[11px] text-ink-faint">Website Redesign</p>
        </div>
        <DeliverableStatusBadge status="in_review" />
      </div>
      <div className="mt-2 flex gap-2">
        <span className="flex-1 rounded-lg bg-gradient-to-r from-cyan-500 to-sky-500 py-1.5 text-center text-[11px] font-semibold text-on-brand">Approve v3</span>
        <span className="flex-1 rounded-lg border border-white/10 py-1.5 text-center text-[11px] text-ink-secondary">Request changes</span>
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-lg border border-dashed border-white/[0.08] px-2.5 py-2 text-[11px] text-ink-faint">
        <EyeOff size={13} className="flex-none" />
        Internal tasks, notes and budget stay hidden
      </div>
    </Panel>
  );
}

const NOTIFICATIONS = [
  { icon: CheckCircle2, tone: "text-emerald-300 bg-emerald-500/10", title: "Priya Shah approved MVP feature matrix", when: "2d" },
  { icon: MessageSquare, tone: "text-cyan-300 bg-cyan-500/10", title: "Hannah Cole commented on Product page walkthrough", when: "20h" },
  { icon: FileCheck2, tone: "text-amber-300 bg-amber-500/10", title: "Homepage mockup v3 is ready for review", when: "20h" },
];

export function NotificationsSnippet() {
  return (
    <Panel>
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
        <p className="flex items-center gap-2 text-sm font-medium text-ink">
          <Bell size={15} className="text-cyan-300" /> Notifications
        </p>
        <span className="rounded-md bg-cyan-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-200">3 new</span>
      </div>
      <ul className="mt-1">
        {NOTIFICATIONS.map((item) => (
          <li key={item.title} className="flex items-center gap-2.5 border-b border-white/[0.04] py-2.5 last:border-0">
            <span className={cn("grid h-7 w-7 flex-none place-items-center rounded-lg", item.tone)}>
              <item.icon size={14} />
            </span>
            <span className="min-w-0 flex-1 truncate text-xs text-ink-secondary">{item.title}</span>
            <span className="text-[10px] text-ink-faint">{item.when}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

const USAGE = [
  { label: "Active projects", used: 5, limit: 25 },
  { label: "Client portals", used: 6, limit: 15 },
  { label: "Team seats", used: 8, limit: 10 },
];

export function UsageSnippet() {
  return (
    <Panel>
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
        <p className="text-sm font-medium text-ink">Professional plan</p>
        <Badge tone="emerald" dot>
          Active
        </Badge>
      </div>
      <div className="mt-3 space-y-3">
        {USAGE.map((item) => {
          const value = Math.round((item.used / item.limit) * 100);
          return (
            <div key={item.label}>
              <div className="flex justify-between text-[11px]">
                <span className="text-ink-muted">{item.label}</span>
                <span className="tabular-nums text-ink-secondary">
                  {item.used} / {item.limit}
                </span>
              </div>
              <ProgressBar value={value} size="sm" tone={value >= 80 ? "amber" : "cyan"} className="mt-1.5" />
            </div>
          );
        })}
      </div>
      <p className="mt-3 rounded-lg bg-amber-500/[0.07] px-2.5 py-2 text-[11px] text-amber-100/80">2 seats left on this plan. Agency includes 40.</p>
    </Panel>
  );
}

const AUDIT = [
  { icon: UserPlus, actor: "Emma Wilson", text: "invited jordan@kinetic.example", code: "member.invited", ip: "203.0.113.24" },
  { icon: Download, actor: "Daniel Reed", text: "downloaded homepage-mockup-v3.png", code: "file.downloaded", ip: "198.51.100.7" },
  { icon: ShieldCheck, actor: "Emma Wilson", text: "shared Mobile App Launch with NovaTech", code: "project.shared", ip: "203.0.113.24" },
];

export function AuditSnippet() {
  return (
    <Panel>
      <p className="border-b border-white/[0.06] pb-3 text-sm font-medium text-ink">Audit log</p>
      <ul className="mt-1">
        {AUDIT.map((item) => (
          <li key={item.code} className="flex items-start gap-2.5 border-b border-white/[0.04] py-2.5 last:border-0">
            <span className="grid h-7 w-7 flex-none place-items-center rounded-lg bg-white/[0.05] text-ink-muted">
              <item.icon size={14} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs text-ink-secondary">
                <span className="text-ink">{item.actor}</span> {item.text}
              </span>
              <span className="mt-0.5 block truncate font-mono text-[10px] text-ink-faint">
                {item.code} · {item.ip}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

const PEOPLE = [
  { id: "a", name: "Daniel Reed", avatarHue: 12, role: "Approver", note: "Can approve and request changes" },
  { id: "b", name: "Chris Morgan", avatarHue: 100, role: "Viewer", note: "Follows progress and comments" },
];

export function ClientRolesSnippet() {
  return (
    <Panel>
      <p className="border-b border-white/[0.06] pb-3 text-sm font-medium text-ink">Client reviewers</p>
      <ul className="mt-1">
        {PEOPLE.map((person) => (
          <li key={person.id} className="flex items-center gap-2.5 border-b border-white/[0.04] py-2.5 last:border-0">
            <Avatar user={person} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs text-ink">{person.name}</span>
              <span className="block truncate text-[11px] text-ink-faint">{person.note}</span>
            </span>
            <Badge tone={person.role === "Approver" ? "cyan" : "slate"}>{person.role}</Badge>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
