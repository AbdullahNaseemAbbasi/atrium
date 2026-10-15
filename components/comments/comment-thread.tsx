"use client";

import * as React from "react";
import { useActionState } from "react";
import { LoaderCircle, Lock, MessageSquare, PenLine, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/lib/actions/result";
import type { AiDraftResult } from "@/lib/actions/ai";
import { Button } from "@/components/ui/button";
import type { CommentView } from "@/lib/data/views";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { FormMessage, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/interactive";

export type ThreadComment = CommentView & { when: string };

/**
 * Comment list + composer. Team members can choose whether a comment is
 * visible to the client or stays internal; client users always post
 * client-visible comments (enforced again on the server).
 */
export function CommentThread({
  comments,
  action,
  canChooseVisibility,
  defaultVisibility = "client",
  canPost = true,
  emptyText = "No comments yet.",
  placeholder = "Write a comment…",
  onDraftReply,
}: {
  comments: ThreadComment[];
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  canChooseVisibility: boolean;
  defaultVisibility?: "client" | "internal";
  canPost?: boolean;
  emptyText?: string;
  placeholder?: string;
  /** When set, a "Draft a reply" button fills the box with an AI draft (never posts it). */
  onDraftReply?: () => Promise<AiDraftResult>;
}) {
  const [draft, setDraft] = React.useState<{ status: "idle" | "loading" | "filled" } | { status: "error"; message: string }>({ status: "idle" });
  const [state, formAction] = useActionState(async (previous: ActionState, formData: FormData) => {
    const result = await action(previous, formData);
    if (result?.ok) setDraft({ status: "idle" });
    return result;
  }, null);
  const [visibility, setVisibility] = React.useState<"client" | "internal">(defaultVisibility);
  const formRef = React.useRef<HTMLFormElement>(null);
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);

  async function draftReply() {
    if (!onDraftReply) return;
    if (bodyRef.current?.value.trim() && !window.confirm("Replace what you've written with an AI draft?")) return;
    setDraft({ status: "loading" });
    try {
      const result = await onDraftReply();
      if (!result.ok) {
        setDraft({ status: "error", message: result.message });
        return;
      }
      setVisibility("client");
      if (bodyRef.current) {
        bodyRef.current.value = result.text;
        bodyRef.current.focus();
      }
      setDraft({ status: "filled" });
    } catch {
      setDraft({ status: "error", message: "The AI couldn't write a draft right now. Try again in a moment." });
    }
  }
  const listEnd = React.useRef<HTMLDivElement>(null);
  const count = comments.length;

  React.useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  // Scroll to the newest comment only when one is added, never on first render.
  const previousCount = React.useRef(count);
  React.useEffect(() => {
    if (count > previousCount.current) listEnd.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    previousCount.current = count;
  }, [count]);

  return (
    <div>
      {comments.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line px-4 py-8 text-center">
          <MessageSquare size={20} className="text-ink-faint" aria-hidden="true" />
          <p className="text-sm text-ink-muted">{emptyText}</p>
        </div>
      ) : (
        <ol className="space-y-4" aria-label="Comments">
          {comments.map((comment) => (
            <li key={comment.id} className="flex gap-3">
              {comment.author ? <Avatar user={comment.author} size="sm" /> : <span className="h-8 w-8 rounded-full bg-surface-raised" />}
              <div
                className={cn(
                  "min-w-0 flex-1 rounded-2xl rounded-tl-md border px-4 py-3",
                  comment.visibility === "internal" ? "border-amber-500/15 bg-amber-500/[0.04]" : "border-line bg-white/[0.025]",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-ink">{comment.author?.name ?? "Former member"}</span>
                  {comment.authorIsClient && <Badge tone="blue">Client</Badge>}
                  {comment.visibility === "internal" && (
                    <Badge tone="amber">
                      <Lock size={11} aria-hidden="true" /> Internal
                    </Badge>
                  )}
                  <span className="text-xs text-ink-faint">{comment.when}</span>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-secondary">{comment.body}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
      <div ref={listEnd} />

      {canPost && (
        <form ref={formRef} action={formAction} className="mt-5 space-y-3">
          {state && !state.ok && <FormMessage>{state.fieldErrors?.body?.[0] ?? state.message}</FormMessage>}
          <input type="hidden" name="visibility" value={visibility} />
          <label htmlFor="comment-body" className="sr-only">
            Comment
          </label>
          <Textarea
            ref={bodyRef}
            id="comment-body"
            name="body"
            rows={3}
            placeholder={visibility === "internal" ? "Internal note: only your team sees this…" : placeholder}
            maxLength={4000}
            required
            className={visibility === "internal" ? "border-amber-500/25 focus:border-amber-400/50 focus:ring-amber-400/10" : undefined}
          />
          {draft.status === "filled" && <p className="text-xs text-ink-faint">AI draft. Edit it before you post; it goes to the client.</p>}
          {draft.status === "error" && (
            <p className="text-xs text-red-300" role="alert">
              {draft.message}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {canChooseVisibility ? (
              <div className="inline-flex rounded-xl border border-line bg-white/[0.02] p-1" role="radiogroup" aria-label="Who can see this comment">
                {(
                  [
                    { value: "client", label: "Visible to client", icon: Users },
                    { value: "internal", label: "Internal note", icon: Lock },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={visibility === option.value}
                    onClick={() => setVisibility(option.value)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition",
                      visibility === option.value
                        ? option.value === "internal"
                          ? "bg-amber-500/15 text-amber-200"
                          : "bg-cyan-500/15 text-cyan-200"
                        : "text-ink-muted hover:text-ink",
                    )}
                  >
                    <option.icon size={13} aria-hidden="true" />
                    {option.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-ink-faint">
                {defaultVisibility === "internal" ? "Internal: only your team sees this." : "Everyone on this project can see comments."}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {onDraftReply && (
                <Button type="button" variant="ghost" size="sm" onClick={draftReply} disabled={draft.status === "loading"}>
                  {draft.status === "loading" ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : <PenLine size={14} />}
                  {draft.status === "loading" ? "Drafting…" : "Draft a reply"}
                </Button>
              )}
              <SubmitButton size="sm" pendingLabel="Posting…">
                Post comment
              </SubmitButton>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
