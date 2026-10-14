"use client";

import * as React from "react";
import { useActionState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { sendContactMessage } from "@/lib/actions/contact";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/interactive";
import { CONTACT_TOPICS, type ContactTopic } from "./contact-topics";

export function ContactForm({ defaultTopic }: { defaultTopic?: ContactTopic }) {
  const [attempt, setAttempt] = React.useState(0);
  return <ContactFormInner key={attempt} defaultTopic={defaultTopic} onReset={() => setAttempt((value) => value + 1)} />;
}

function ContactFormInner({ defaultTopic, onReset }: { defaultTopic?: ContactTopic; onReset: () => void }) {
  const [state, action] = useActionState(sendContactMessage, null);
  const errors = state?.fieldErrors ?? {};
  const values = state?.values ?? {};
  const [length, setLength] = React.useState(values.message?.length ?? 0);

  if (state?.ok) {
    return (
      <div className="flex flex-col items-center py-8 text-center" role="status">
        <span className="grid h-14 w-14 place-items-center rounded-2xl border border-emerald-400/30 bg-emerald-500/10 text-emerald-300 shadow-[0_0_30px_rgba(52,211,153,.15)]">
          <CheckCircle2 size={26} aria-hidden="true" />
        </span>
        <h2 className="mt-5 text-xl font-semibold text-ink">Message sent</h2>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">{state.message}</p>
        <Button variant="outline" className="mt-6" onClick={onReset}>
          Send another message
        </Button>
      </div>
    );
  }

  const describedBy = (name: string) => (errors[name] ? `${name}-error` : undefined);

  return (
    <form action={action} className="space-y-5" noValidate>
      {state && !state.ok && !state.fieldErrors && <FormMessage>{state.message}</FormMessage>}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name" htmlFor="name" error={errors.name} required>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            defaultValue={values.name}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={describedBy("name")}
            required
          />
        </Field>
        <Field label="Work email" htmlFor="email" error={errors.email} required>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@studio.example"
            defaultValue={values.email}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={describedBy("email")}
            required
          />
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Company" htmlFor="company" error={errors.company} hint="Optional">
          <Input
            id="company"
            name="company"
            autoComplete="organization"
            defaultValue={values.company}
            aria-invalid={Boolean(errors.company)}
            aria-describedby={errors.company ? "company-error" : "company-hint"}
          />
        </Field>
        <Field label="What's it about?" htmlFor="topic" error={errors.topic} required>
          <Select
            id="topic"
            name="topic"
            defaultValue={values.topic ?? defaultTopic ?? ""}
            aria-invalid={Boolean(errors.topic)}
            aria-describedby={describedBy("topic")}
            required
          >
            <option value="" disabled>
              Choose a topic
            </option>
            {CONTACT_TOPICS.map((topic) => (
              <option key={topic.value} value={topic.value}>
                {topic.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field
        label="Message"
        htmlFor="message"
        error={errors.message}
        hint={`${length} / 4,000 characters. Include links or steps to reproduce if something isn't working.`}
        required
      >
        <Textarea
          id="message"
          name="message"
          rows={6}
          maxLength={4000}
          defaultValue={values.message}
          onChange={(event) => setLength(event.target.value.length)}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? "message-error" : "message-hint"}
          required
        />
      </Field>
      {/* Honeypot: invisible to people and skipped by keyboard and screen readers. */}
      <div className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-ink-faint">We only use your details to reply to this message.</p>
        <SubmitButton size="lg" pendingLabel="Sending…" className="sm:w-auto">
          <Send size={16} aria-hidden="true" /> Send message
        </SubmitButton>
      </div>
    </form>
  );
}
