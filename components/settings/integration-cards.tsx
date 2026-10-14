"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { CheckCircle2, CreditCard, Plug, Unplug } from "lucide-react";
import { toast } from "sonner";
import { connectIntegration, disconnectIntegration } from "@/lib/actions/settings";
import type { ActionState } from "@/lib/actions/result";
import type { IntegrationMeta } from "@/lib/settings/options";
import { formatDate } from "@/lib/utils";
import { BrandTile } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/interactive";

export interface IntegrationItem extends IntegrationMeta {
  connection: { account: string; connectedAt: string; when: string; byName: string } | null;
}

export function IntegrationCards({
  orgSlug,
  items,
  canManage,
  billingHref,
  stripeConnected,
}: {
  orgSlug: string;
  items: IntegrationItem[];
  canManage: boolean;
  billingHref: string | null;
  stripeConnected: boolean;
}) {
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {items.map((item) => (
        <li key={item.key}>
          <IntegrationCard orgSlug={orgSlug} item={item} canManage={canManage} />
        </li>
      ))}
      <li>
        <Card className="flex h-full flex-col p-5">
          <div className="flex items-start gap-3">
            <BrandTile name="Stripe" hue={250} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-ink">Stripe</h3>
                <Badge tone="violet">Test mode</Badge>
              </div>
              <p className="mt-1 text-sm text-ink-muted">Subscription payments and invoices for this workspace.</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-ink-faint">
            {stripeConnected ? "Connected through Billing. Customer and payment method are managed there." : "Set up automatically the first time you choose a paid plan."}
          </p>
          <div className="mt-auto pt-4">
            {billingHref ? (
              <Link href={billingHref} className={buttonClasses({ variant: "outline", size: "sm" })}>
                <CreditCard size={14} /> Managed in Billing
              </Link>
            ) : (
              <span className="text-xs text-ink-faint">Managed in Billing by the owner or billing manager.</span>
            )}
          </div>
        </Card>
      </li>
    </ul>
  );
}

function IntegrationCard({ orgSlug, item, canManage }: { orgSlug: string; item: IntegrationItem; canManage: boolean }) {
  const [pending, startTransition] = React.useTransition();
  const connected = item.connection;
  return (
    <Card className={connected ? "flex h-full flex-col border-cyan-500/20 p-5" : "flex h-full flex-col p-5"}>
      <div className="flex items-start gap-3">
        <BrandTile name={item.name} hue={item.hue} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-ink">{item.name}</h3>
            {connected ? (
              <Badge tone="emerald" dot>
                Connected
              </Badge>
            ) : (
              <Badge tone="slate">Not connected</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-ink-muted">{item.description}</p>
        </div>
      </div>
      {connected ? (
        <dl className="mt-4 grid gap-1 rounded-xl border border-line bg-white/[0.02] px-3.5 py-3 text-xs">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-faint">{item.accountLabel}</dt>
            <dd className="truncate text-ink-secondary">{connected.account}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-faint">Connected</dt>
            <dd className="text-ink-secondary" title={formatDate(connected.connectedAt)}>
              {connected.when} by {connected.byName}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="mt-4 text-xs text-ink-faint">{item.accountHint}</p>
      )}
      <div className="mt-auto flex items-center gap-2 pt-4">
        {!canManage ? (
          <span className="text-xs text-ink-faint">Only owners can {connected ? "disconnect" : "connect"} integrations.</span>
        ) : connected ? (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(`Disconnect ${item.name}? Atrium stops sending updates to ${connected.account}.`)) return;
              startTransition(async () => {
                const result = await disconnectIntegration(orgSlug, item.key);
                if (result?.ok) toast.success(result.message);
                else toast.error(result?.message ?? "Couldn't disconnect.");
              });
            }}
          >
            <Unplug size={14} /> {pending ? "Disconnecting…" : "Disconnect"}
          </Button>
        ) : (
          <ConnectDialog orgSlug={orgSlug} item={item} />
        )}
      </div>
    </Card>
  );
}

function ConnectDialog({ orgSlug, item }: { orgSlug: string; item: IntegrationItem }) {
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = useActionState(async (previous: ActionState, formData: FormData) => {
    const result = await connectIntegration(orgSlug, item.key, previous, formData);
    if (result?.ok) {
      setOpen(false);
      toast.success(result.message ?? `${item.name} connected.`);
    }
    return result;
  }, null);
  const error = state?.fieldErrors?.account;
  const inputId = `account-${item.key}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <Plug size={14} /> Connect
        </Button>
      </DialogTrigger>
      <DialogContent
        size="sm"
        title={`Connect ${item.name}`}
        description="Demo connection: no sign-in with the provider and no data leaves Atrium. The change is recorded in the audit log."
      >
        <form action={formAction} className="space-y-5" noValidate>
          {state && !state.ok && !error && <FormMessage>{state.message}</FormMessage>}
          <Field label={item.accountLabel} htmlFor={inputId} error={error} hint={item.accountHint} required>
            <Input
              id={inputId}
              name="account"
              placeholder={item.accountPlaceholder}
              defaultValue={state?.values?.account}
              maxLength={80}
              autoFocus
              aria-invalid={Boolean(error)}
            />
          </Field>
          <div className="flex items-start gap-2 text-xs text-ink-faint">
            <CheckCircle2 size={14} className="mt-0.5 flex-none text-cyan-300" aria-hidden="true" />
            Internal comments, drafts and budgets are never sent to integrations.
          </div>
          <div className="flex justify-end border-t border-line pt-5">
            <SubmitButton pendingLabel="Connecting…">Connect {item.name}</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
