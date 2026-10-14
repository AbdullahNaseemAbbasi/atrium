"use client";

import * as React from "react";
import { Copy, LoaderCircle, Send, UserMinus, X } from "lucide-react";
import { toast } from "sonner";
import { changeMemberRole, removeMember, resendTeamInvitation, revokeTeamInvitation } from "@/lib/actions/team";
import type { ActionState } from "@/lib/actions/result";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import type { OrgRole } from "@/lib/data/types";
import { Button } from "@/components/ui/button";

function report(result: ActionState, fallback: string) {
  if (result?.ok) {
    if (result.message) toast.success(result.message);
  } else {
    toast.error(result?.message ?? fallback);
  }
}

/** Inline role picker. Only the roles the viewer may assign are offered. */
export function MemberRoleSelect({
  orgSlug,
  membershipId,
  name,
  role,
  choices,
}: {
  orgSlug: string;
  membershipId: string;
  name: string;
  role: OrgRole;
  choices: OrgRole[];
}) {
  const [pending, startTransition] = React.useTransition();
  const [optimistic, setOptimistic] = React.useOptimistic(role);
  const options = choices.includes(role) ? choices : [role, ...choices];
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">Role for {name}</span>
      <select
        value={optimistic}
        disabled={pending}
        onChange={(event) => {
          const next = event.target.value as OrgRole;
          if (next === role) return;
          const warning =
            next === "owner"
              ? `Make ${name} an owner? Owners have full control, including billing and removing other owners.`
              : next === "billing"
                ? `Make ${name} a billing manager? They'll lose access to every project and only see billing.`
                : `Change ${name} to ${ROLE_LABELS[next]}?`;
          // Controlled select: cancelling leaves React to restore the current value.
          if (!window.confirm(warning)) return;
          startTransition(async () => {
            setOptimistic(next);
            report(await changeMemberRole(orgSlug, membershipId, next), "Couldn't change the role.");
          });
        }}
        className="h-8 cursor-pointer appearance-none rounded-lg border border-line-strong bg-white/[0.03] py-0 pl-2.5 pr-7 text-xs text-ink-secondary outline-none transition hover:border-white/20 focus:border-cyan-400/50 disabled:opacity-60 [&>option]:bg-surface-raised"
      >
        {options.map((value) => (
          <option key={value} value={value}>
            {ROLE_LABELS[value]}
          </option>
        ))}
      </select>
      {pending ? (
        <LoaderCircle size={13} className="pointer-events-none absolute right-2 animate-spin text-ink-faint" aria-hidden="true" />
      ) : (
        <svg className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-ink-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      )}
    </label>
  );
}

export function RemoveMemberButton({
  orgSlug,
  membershipId,
  name,
  projects,
  leads,
}: {
  orgSlug: string;
  membershipId: string;
  name: string;
  projects: number;
  leads: number;
}) {
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      disabled={pending}
      className="text-ink-faint hover:bg-red-500/10 hover:text-red-300"
      aria-label={`Remove ${name} from the workspace`}
      title={`Remove ${name}`}
      onClick={() => {
        const details = [
          projects > 0 ? `They'll be taken off ${projects} ${projects === 1 ? "project" : "projects"}${leads > 0 ? ` (lead on ${leads})` : ""}.` : null,
          "Their open tasks become unassigned. Comments and uploads stay.",
        ]
          .filter(Boolean)
          .join(" ");
        if (!window.confirm(`Remove ${name} from the workspace? ${details}`)) return;
        startTransition(async () => report(await removeMember(orgSlug, membershipId), "Couldn't remove this member."));
      }}
    >
      {pending ? <LoaderCircle size={15} className="animate-spin" /> : <UserMinus size={15} />}
    </Button>
  );
}

export function TeamInvitationActions({
  orgSlug,
  invitationId,
  email,
  expired,
}: {
  orgSlug: string;
  invitationId: string;
  email: string;
  expired: boolean;
}) {
  const [pending, startTransition] = React.useTransition();
  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {expired ? (
        <Button
          variant="secondary"
          size="xs"
          disabled={pending}
          onClick={() => startTransition(async () => report(await resendTeamInvitation(orgSlug, invitationId), "Couldn't re-send the invitation."))}
        >
          <Send size={13} /> Re-send
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="xs"
          aria-label={`Copy invite link for ${email}`}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(`${window.location.origin}/invite/${invitationId}`);
              toast.success("Invite link copied");
            } catch {
              toast.error("Couldn't copy. Your browser blocked clipboard access.");
            }
          }}
        >
          <Copy size={13} /> Copy link
        </Button>
      )}
      <Button
        variant="ghost"
        size="xs"
        disabled={pending}
        className="text-red-300 hover:bg-red-500/10 hover:text-red-200"
        aria-label={`Revoke invitation for ${email}`}
        onClick={() => {
          if (!window.confirm(`Revoke the invitation for ${email}? The link stops working and the seat is freed.`)) return;
          startTransition(async () => report(await revokeTeamInvitation(orgSlug, invitationId), "Couldn't revoke the invitation."));
        }}
      >
        <X size={13} /> Revoke
      </Button>
    </div>
  );
}
