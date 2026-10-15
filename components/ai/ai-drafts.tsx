"use client";

import * as React from "react";
import { Copy, ListChecks, LoaderCircle, Mail, RotateCcw, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { draftClientUpdate, summarizeFeedback, type AiDraftResult } from "@/lib/actions/ai";
import { addDeliverableComment } from "@/lib/actions/deliverables";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";

/**
 * AI draft cards. A draft only appears on screen: people copy it, post it as
 * an internal note, or ignore it. Nothing is sent to a client automatically.
 */
type DraftState = { status: "idle" } | { status: "loading" } | { status: "done"; text: string } | { status: "error"; message: string };

function useDraft(run: () => Promise<AiDraftResult>) {
  const [state, setState] = React.useState<DraftState>({ status: "idle" });
  const start = React.useCallback(async () => {
    setState({ status: "loading" });
    try {
      const result = await run();
      setState(result.ok ? { status: "done", text: result.text } : { status: "error", message: result.message });
    } catch {
      setState({ status: "error", message: "The AI couldn't write a draft right now. Try again in a moment." });
    }
  }, [run]);
  return { state, start };
}

/** Lines starting with "- " become a list; everything else stays as written. */
export function DraftText({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length === 0) return;
    blocks.push(
      <ul key={`list-${blocks.length}`} className="space-y-1.5">
        {list.map((item, index) => (
          <li key={index} className="flex gap-2.5">
            <span className="mt-[9px] h-1 w-1 flex-none rounded-full bg-ink-faint" aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>,
    );
    list = [];
  };
  for (const line of text.split("\n")) {
    if (line.startsWith("- ")) {
      list.push(line.slice(2));
      continue;
    }
    flush();
    if (line.trim()) blocks.push(<p key={`p-${blocks.length}`}>{line}</p>);
  }
  flush();
  return <div className="space-y-3 text-sm leading-relaxed text-ink-secondary">{blocks}</div>;
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied.");
  } catch {
    toast.error("Couldn't copy. Your browser blocked clipboard access.");
  }
}

function Loading({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-2 text-sm text-ink-muted" role="status">
      <LoaderCircle size={15} className="animate-spin text-cyan-300" aria-hidden="true" />
      {label}
    </p>
  );
}

const AI_NOTE = "Written by AI. Read it before you rely on it.";

/** Deliverable page: the client's change requests as a short checklist. */
export function FeedbackSummaryCard({
  orgSlug,
  deliverableId,
  hasFeedback,
  canPostNote,
}: {
  orgSlug: string;
  deliverableId: string;
  hasFeedback: boolean;
  canPostNote: boolean;
}) {
  const run = React.useCallback(() => summarizeFeedback(orgSlug, deliverableId), [orgSlug, deliverableId]);
  const { state, start } = useDraft(run);
  const [posting, startPosting] = React.useTransition();

  function postAsNote(text: string) {
    const formData = new FormData();
    formData.set("body", `Feedback summary (AI draft):\n${text}`);
    formData.set("visibility", "internal");
    startPosting(async () => {
      const result = await addDeliverableComment(orgSlug, deliverableId, null, formData);
      if (result?.ok) toast.success("Posted as an internal note.");
      else toast.error(result?.message ?? "Couldn't post the note.");
    });
  }

  return (
    <Card>
      <CardHeader
        icon={ListChecks}
        title="Feedback summary"
        description="What the client asked to change, pulled from the comments and decisions."
      />
      <div className="space-y-4 px-5 pb-5">
        {state.status === "idle" && (
          <Button variant="secondary" size="sm" onClick={start} disabled={!hasFeedback}>
            <ListChecks size={15} /> Summarize feedback
          </Button>
        )}
        {state.status === "idle" && !hasFeedback && <p className="text-xs text-ink-faint">{"There's no feedback to summarize yet."}</p>}
        {state.status === "loading" && <Loading label="Reading the comments…" />}
        {state.status === "error" && (
          <div className="space-y-3">
            <p className="text-sm text-red-300" role="alert">
              {state.message}
            </p>
            <Button variant="outline" size="sm" onClick={start}>
              <RotateCcw size={14} /> Try again
            </Button>
          </div>
        )}
        {state.status === "done" && (
          <>
            <DraftText text={state.text} />
            <p className="text-xs text-ink-faint">{AI_NOTE}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => copy(state.text)}>
                <Copy size={14} /> Copy
              </Button>
              {canPostNote && (
                <Button variant="outline" size="sm" onClick={() => postAsNote(state.text)} disabled={posting}>
                  <StickyNote size={14} /> {posting ? "Posting…" : "Post as internal note"}
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={start}>
                <RotateCcw size={14} /> Write again
              </Button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

/** Project overview: a weekly update for the client, from client-visible work only. */
export function ClientUpdateCard({ orgSlug, projectId, clientName }: { orgSlug: string; projectId: string; clientName: string }) {
  const run = React.useCallback(() => draftClientUpdate(orgSlug, projectId), [orgSlug, projectId]);
  const { state, start } = useDraft(run);

  return (
    <Card>
      <CardHeader
        icon={Mail}
        title="Client update"
        description={`A short weekly update for ${clientName}, written only from work they can already see.`}
      />
      <div className="space-y-4 px-5 pb-5">
        {state.status === "idle" && (
          <Button variant="secondary" size="sm" onClick={start}>
            <Mail size={15} /> {"Draft this week's update"}
          </Button>
        )}
        {state.status === "loading" && <Loading label={"Going through this week's work…"} />}
        {state.status === "error" && (
          <div className="space-y-3">
            <p className="text-sm text-red-300" role="alert">
              {state.message}
            </p>
            <Button variant="outline" size="sm" onClick={start}>
              <RotateCcw size={14} /> Try again
            </Button>
          </div>
        )}
        {state.status === "done" && (
          <>
            <div className="rounded-xl border border-line bg-white/[0.02] p-4">
              <DraftText text={state.text} />
            </div>
            <p className="text-xs text-ink-faint">{AI_NOTE} Nothing is sent until you send it yourself.</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => copy(state.text)}>
                <Copy size={14} /> Copy
              </Button>
              <Button variant="ghost" size="sm" onClick={start}>
                <RotateCcw size={14} /> Write again
              </Button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
