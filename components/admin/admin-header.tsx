import { LogOut, ShieldCheck } from "lucide-react";
import { signOut } from "@/lib/actions/auth";
import type { User } from "@/lib/data/types";
import { Logo } from "@/components/brand/logo";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { NavTabs } from "@/components/ui/nav-tabs";

export function AdminHeader({ admin }: { admin: Pick<User, "name" | "email" | "avatarHue"> }) {
  return (
    <header className="sticky top-0 z-50">
      <div className="rounded-b-2xl border border-t-0 border-white/[0.08] bg-[#0b1722]/95 px-4 shadow-[0_12px_40px_rgba(0,0,0,.35)] backdrop-blur-xl lg:px-6">
        <div className="flex h-[70px] items-center gap-4">
          <Logo />
          <span className="hidden items-center gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-200 sm:inline-flex">
            <ShieldCheck size={13} aria-hidden="true" /> Platform operations
          </span>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right md:block">
              <p className="text-sm font-medium text-ink">{admin.name}</p>
              <p className="text-xs text-ink-faint">{admin.email}</p>
            </div>
            <Avatar user={admin} size="md" />
            <form action={signOut}>
              <Button type="submit" variant="outline" size="sm" aria-label="Sign out">
                <LogOut size={14} /> <span className="hidden sm:inline">Sign out</span>
              </Button>
            </form>
          </div>
        </div>
        <NavTabs
          label="Platform sections"
          className="-mb-px"
          tabs={[
            { href: "/admin", label: "Overview", exact: true },
            { href: "/admin/workspaces", label: "Workspaces" },
            { href: "/admin/webhooks", label: "Webhooks" },
          ]}
        />
      </div>
    </header>
  );
}
