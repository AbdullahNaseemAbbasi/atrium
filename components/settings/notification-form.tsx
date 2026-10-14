"use client";

import * as React from "react";
import { useActionState } from "react";
import { Bell, Mail, MonitorSmartphone } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { updateNotificationPreferences } from "@/lib/actions/settings";
import type { ActionState } from "@/lib/actions/result";
import type { NotificationChannel, NotificationGroup } from "@/lib/data/types";
import { DIGEST_OPTIONS, NOTIFICATION_CHANNELS, NOTIFICATION_GROUPS, type DigestValue } from "@/lib/settings/options";
import { Card, CardHeader } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form";
import { SubmitButton, Switch } from "@/components/ui/interactive";

export function NotificationForm({
  orgSlug,
  orgName,
  email,
  muted,
  digest,
  seesBilling,
}: {
  orgSlug: string;
  orgName: string;
  email: string;
  muted: Record<NotificationChannel, NotificationGroup[]>;
  digest: DigestValue;
  seesBilling: boolean;
}) {
  const [state, formAction] = useActionState(async (previous: ActionState, formData: FormData) => {
    const result = await updateNotificationPreferences(orgSlug, previous, formData);
    if (result?.ok) toast.success(result.message ?? "Preferences saved.");
    return result;
  }, null);
  const [enabled, setEnabled] = React.useState<Record<NotificationChannel, Set<NotificationGroup>>>(() => ({
    inApp: new Set(NOTIFICATION_GROUPS.map((group) => group.key).filter((key) => !muted.inApp.includes(key))),
    email: new Set(NOTIFICATION_GROUPS.map((group) => group.key).filter((key) => !muted.email.includes(key))),
  }));
  const [digestValue, setDigestValue] = React.useState<DigestValue>(digest);

  const toggle = (channel: NotificationChannel, group: NotificationGroup, on: boolean) => {
    setEnabled((current) => {
      const next = new Set(current[channel]);
      if (on) next.add(group);
      else next.delete(group);
      return { ...current, [channel]: next };
    });
  };
  const setAll = (channel: NotificationChannel, on: boolean) =>
    setEnabled((current) => ({ ...current, [channel]: new Set(on ? NOTIFICATION_GROUPS.map((group) => group.key) : []) }));

  return (
    <Card>
      <CardHeader icon={Bell} title="Notifications" description={`What ${orgName} sends you. Emails go to ${email}.`} />
      <form action={formAction} className="px-4 pb-5 sm:px-5">
        {state && !state.ok && <FormMessage className="mb-4">{state.message}</FormMessage>}
        {(["inApp", "email"] as const).map((channel) =>
          [...enabled[channel]].map((group) => <input key={`${channel}-${group}`} type="hidden" name={channel} value={group} />),
        )}

        <div className="relative overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[340px] border-collapse text-sm">
            <caption className="sr-only">Notification channels per group</caption>
            <thead>
              <tr className="border-b border-line bg-white/[0.018] text-left text-xs text-ink-faint">
                <th scope="col" className="px-4 py-3 font-medium">
                  Notify me about
                </th>
                {NOTIFICATION_CHANNELS.map((channel) => {
                  const all = enabled[channel.key].size === NOTIFICATION_GROUPS.length;
                  const Icon = channel.key === "inApp" ? MonitorSmartphone : Mail;
                  return (
                    <th key={channel.key} scope="col" className="w-20 px-2 py-3 text-center font-medium sm:w-28">
                      <span className="inline-flex items-center gap-1.5">
                        <Icon size={14} aria-hidden="true" className="hidden sm:block" />
                        {channel.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => setAll(channel.key, !all)}
                        className="mt-1 block w-full text-[11px] font-normal text-cyan-300 hover:text-cyan-200"
                      >
                        {all ? "Turn all off" : "Turn all on"}
                        <span className="sr-only"> for {channel.label}</span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {NOTIFICATION_GROUPS.map((group) => {
                const unavailable = group.key === "billing" && !seesBilling;
                return (
                  <tr key={group.key} className="border-b border-white/[0.05] last:border-0">
                    <th scope="row" className="px-4 py-3.5 text-left font-normal">
                      <span className="block font-medium text-ink">{group.label}</span>
                      <span className="mt-0.5 block text-xs text-ink-faint">
                        {unavailable ? "Only for people with billing access." : group.description}
                      </span>
                    </th>
                    {NOTIFICATION_CHANNELS.map((channel) => (
                      <td key={channel.key} className="px-2 py-3.5 text-center">
                        <Switch
                          checked={!unavailable && enabled[channel.key].has(group.key)}
                          disabled={unavailable}
                          onCheckedChange={(on) => toggle(channel.key, group.key, on)}
                          aria-label={`${group.label} via ${channel.label}`}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <fieldset className="mt-6">
          <legend className="text-sm font-semibold text-ink">Email digest</legend>
          <p className="mt-1 text-xs text-ink-faint">A summary of open approvals and tasks due, sent even when individual emails are off.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {DIGEST_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition focus-within:ring-2 focus-within:ring-cyan-400/30",
                  digestValue === option.value ? "border-cyan-400/50 bg-cyan-500/[0.07]" : "border-line bg-white/[0.02] hover:border-line-strong",
                )}
              >
                <input
                  type="radio"
                  name="digest"
                  value={option.value}
                  checked={digestValue === option.value}
                  onChange={() => setDigestValue(option.value)}
                  className="mt-1 accent-cyan-400"
                />
                <span>
                  <span className="block text-sm font-medium text-ink">{option.label}</span>
                  <span className="mt-0.5 block text-xs text-ink-faint">{option.description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink-faint">Demo workspace: emails are never sent, only recorded.</p>
          <SubmitButton pendingLabel="Saving…">Save preferences</SubmitButton>
        </div>
      </form>
    </Card>
  );
}
