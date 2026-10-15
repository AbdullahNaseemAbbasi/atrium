"use client";

import * as React from "react";
import { Check, FileUp, LoaderCircle, X } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import { prepareUpload, type UploadTarget } from "@/lib/actions/uploads";
import { ALLOWED_EXTENSIONS, MAX_UPLOAD_BYTES } from "@/lib/validation/schemas";
import { FileTypeIcon } from "./file-type-icon";

type Status = { state: "idle" } | { state: "uploading"; progress: number } | { state: "done" } | { state: "failed"; message: string };

/**
 * File chooser with drag and drop. Choosing a file starts the upload right
 * away: the server checks it and hands out a signed URL, and the bytes go
 * from the browser straight to private storage. The form then posts only the
 * file's metadata and the upload ticket. The real <input type="file"> has no
 * name on purpose.
 */
export function FilePicker({
  orgSlug,
  target,
  error,
  label = "File",
  onBusyChange,
}: {
  orgSlug: string;
  target: UploadTarget;
  error?: string;
  label?: string;
  /** True while bytes are still uploading, so the form can hold its submit button. */
  onBusyChange?: (busy: boolean) => void;
}) {
  const [file, setFile] = React.useState<{ name: string; type: string; size: number } | null>(null);
  const [ticket, setTicket] = React.useState("");
  const [status, setStatusState] = React.useState<Status>({ state: "idle" });
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const requestRef = React.useRef<XMLHttpRequest | null>(null);
  const attemptRef = React.useRef(0);

  function setStatus(next: Status) {
    setStatusState(next);
    onBusyChange?.(next.state === "uploading");
  }

  function clear() {
    attemptRef.current += 1;
    requestRef.current?.abort();
    requestRef.current = null;
    setFile(null);
    setTicket("");
    setStatus({ state: "idle" });
    if (inputRef.current) inputRef.current.value = "";
  }

  async function choose(next: File | undefined) {
    if (!next) return;
    const extension = next.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      clear();
      setLocalError(`.${extension} files aren't allowed. Use PDF, images, video, ZIP or Office documents.`);
      return;
    }
    if (next.size > MAX_UPLOAD_BYTES) {
      clear();
      setLocalError("Files can be up to 5 GB.");
      return;
    }

    clear();
    const attempt = attemptRef.current;
    setLocalError(null);
    setFile({ name: next.name, type: next.type, size: next.size });
    setStatus({ state: "uploading", progress: 0 });

    try {
      const prepared = await prepareUpload(orgSlug, target, { fileName: next.name, mimeType: next.type, sizeBytes: next.size });
      if (attempt !== attemptRef.current) return;
      if (!prepared.ok) {
        setStatus({ state: "failed", message: prepared.message });
        return;
      }
      if (prepared.uploadUrl) {
        await putFile(prepared.uploadUrl, next, requestRef, (progress) => {
          if (attempt === attemptRef.current) setStatusState({ state: "uploading", progress });
        });
        if (attempt !== attemptRef.current) return;
      }
      setTicket(prepared.ticket);
      setStatus({ state: "done" });
    } catch (cause) {
      if (attempt !== attemptRef.current) return;
      setStatus({ state: "failed", message: cause instanceof Error ? cause.message : "The upload failed. Try again." });
    }
  }

  const message = localError ?? (status.state === "failed" ? status.message : error);

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-ink-secondary">{label}</p>
      <input type="hidden" name="fileName" value={file?.name ?? ""} />
      <input type="hidden" name="mimeType" value={file?.type ?? ""} />
      <input type="hidden" name="sizeBytes" value={file?.size ?? ""} />
      <input type="hidden" name="uploadTicket" value={ticket} />
      {file ? (
        <div
          className={cn(
            "rounded-xl border px-4 py-3",
            status.state === "failed" ? "border-red-500/40 bg-red-500/[0.04]" : "border-cyan-500/25 bg-cyan-500/[0.05]",
          )}
        >
          <div className="flex items-center gap-3">
            <FileTypeIcon mimeType={file.type} fileName={file.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{file.name}</p>
              <p className="flex items-center gap-1.5 text-xs text-ink-faint" aria-live="polite">
                {status.state === "uploading" && (
                  <>
                    <LoaderCircle size={12} className="animate-spin" aria-hidden="true" />
                    Uploading {Math.round(status.progress * 100)}% of {formatBytes(file.size)}
                  </>
                )}
                {status.state === "done" && (
                  <>
                    <Check size={12} className="text-emerald-300" aria-hidden="true" />
                    {formatBytes(file.size)}, uploaded
                  </>
                )}
                {(status.state === "failed" || status.state === "idle") && formatBytes(file.size)}
              </p>
            </div>
            <button
              type="button"
              onClick={clear}
              className="grid h-8 w-8 place-items-center rounded-lg text-ink-faint hover:bg-white/5 hover:text-ink"
              aria-label={status.state === "uploading" ? "Cancel upload" : "Remove file"}
            >
              <X size={16} />
            </button>
          </div>
          {status.state === "uploading" && (
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
              <div className="h-full rounded-full bg-cyan-400 transition-[width]" style={{ width: `${Math.max(status.progress * 100, 3)}%` }} />
            </div>
          )}
        </div>
      ) : (
        <label
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void choose(event.dataTransfer.files[0]);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center transition",
            dragging ? "border-cyan-400 bg-cyan-500/[0.08]" : "border-line-strong bg-white/[0.02] hover:border-cyan-400/40",
            message && "border-red-500/40",
          )}
        >
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-500/10 text-cyan-300">
            <FileUp size={20} aria-hidden="true" />
          </span>
          <span className="text-sm text-ink">
            <span className="font-medium text-cyan-300">Choose a file</span> or drag it here
          </span>
          <span className="text-xs text-ink-faint">PDF, images, video, ZIP or Office files</span>
          <input ref={inputRef} type="file" className="sr-only" onChange={(event) => void choose(event.target.files?.[0])} />
        </label>
      )}
      {message && (
        <p className="text-xs text-red-300" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}

/** PUT to a Supabase signed upload URL with progress (fetch can't report upload progress). */
function putFile(url: string, file: File, requestRef: React.RefObject<XMLHttpRequest | null>, onProgress: (progress: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    requestRef.current = request;
    request.open("PUT", url);
    request.setRequestHeader("content-type", file.type || "application/octet-stream");
    request.setRequestHeader("x-upsert", "false");
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error(storageMessage(request.status, request.responseText)));
    };
    request.onerror = () => reject(new Error("The connection dropped during the upload. Try again."));
    request.onabort = () => reject(new Error("Upload cancelled."));
    request.send(file);
  });
}

function storageMessage(status: number, body: string) {
  if (status === 413 || /maximum allowed size|too large/i.test(body)) return "This file is larger than storage accepts. Try a smaller file.";
  return "Storage didn't accept the file. Try again.";
}
