"use client";

import * as React from "react";
import { Copy, LoaderCircle, RotateCcw, Send, UserX, X } from "lucide-react";
import { toast } from "sonner";
import { resendClientInvitation, revokeClientInvitation, setPortalAccess, setPortalRole } from "@/lib/actions/clients";
import type { ActionState } from "@/lib/actions/result";
import { CLIENT_ROLE_LABELS } from "@/lib/auth/permissions";
import type { ClientRole, MembershipStatus } from "@/lib/data/types";
import { Button } from "@/components/ui/button";

function report(result: ActionState, fallback: string) {
  if (result?.ok) {
    if (result.message) toast.success(result.message);
  } else {
    toast.error(result?.message ?? fallback);
  }
}

/** Inline role select for a portal user. Warns before removing the last approver. */
export function PortalRoleSelect({
  orgSlug,
  membershipId,
  name,
  role,
  isLastApprover,
}: {
  orgSlug: string;
  membershipId: string;
  name: string;
  role: ClientRole;
  isLastApprover: boolean;
}) {
  const [pending, startTransition] = React.useTransition();
  const [optimistic, setOptimistic] = React.useOptimistic(role);
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">Portal role for {name}</span>
      <select
        value={optimistic}
        disabled={pending}
        onChange={(event) => {
          const next = event.target.value as ClientRole;
          if (next === role) return;
          if (
            isLastApprover &&
            next === "viewer" &&
            !window.confirm(`${name} is the only approver. Without one, nobody at the client can approve deliverables. Make them a viewer anyway?`)
          ) {
            return;
          }
          startTransition(async () => {
            setOptimistic(next);
            report(await setPortalRole(orgSlug, membershipId, next), "Couldn't change the role.");
          });
        }}
        className="h-8 cursor-pointer appearance-none rounded-lg border border-line-strong bg-white/[0.03] py-0 pl-2.5 pr-7 text-xs text-ink-secondary outline-none transition hover:border-white/20 focus:border-cyan-400/50 disabled:opacity-60 [&>option]:bg-surface-raised"
      >
        {(Object.keys(CLIENT_ROLE_LABELS) as ClientRole[]).map((value) => (
          <option key={value} value={value}>
            {CLIENT_ROLE_LABELS[value]}
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

/** Revoke or restore one portal user's access. */
export function PortalAccessButton({
  orgSlug,
  membershipId,
  name,
  clientName,
  status,
}: {
  orgSlug: string;
  membershipId: string;
  name: string;
  clientName: string;
  status: MembershipStatus;
}) {
  const [pending, startTransition] = React.useTransition();
  const revoking = status === "active";
  return (
    <Button
      variant={revoking ? "ghost" : "secondary"}
      size="xs"
      disabled={pending}
      className={revoking ? "text-red-300 hover:bg-red-500/10 hover:text-red-200" : undefined}
      aria-label={revoking ? `Revoke portal access for ${name}` : `Restore portal access for ${name}`}
      onClick={() => {
        if (revoking && !window.confirm(`Revoke ${name}'s access to the ${clientName} portal? They're signed out right away. You can restore it later.`)) return;
        startTransition(async () => {
          report(await setPortalAccess(orgSlug, membershipId, revoking ? "suspended" : "active"), "Couldn't update access.");
        });
      }}
    >
      {pending ? <LoaderCircle size={13} className="animate-spin" /> : revoking ? <UserX size={13} /> : <RotateCcw size={13} />}
      {revoking ? "Revoke" : "Restore"}
    </Button>
  );
}

/** Copy link, re-send and revoke for a pending or expired client invitation. */
export function ClientInvitationActions({
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
    <div className="flex flex-wrap items-center gap-1">
      {expired ? (
        <Button
          variant="secondary"
          size="xs"
          disabled={pending}
          onClick={() => startTransition(async () => report(await resendClientInvitation(orgSlug, invitationId), "Couldn't re-send the invitation."))}
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
          if (!window.confirm(`Revoke the invitation for ${email}? The link stops working immediately.`)) return;
          startTransition(async () => report(await revokeClientInvitation(orgSlug, invitationId), "Couldn't revoke the invitation."));
        }}
      >
        <X size={13} /> Revoke
      </Button>
    </div>
  );
}
