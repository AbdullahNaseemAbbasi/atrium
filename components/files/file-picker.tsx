"use client";

import * as React from "react";
import { FileUp, X } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import { ALLOWED_EXTENSIONS, MAX_UPLOAD_BYTES } from "@/lib/validation/schemas";
import { FileTypeIcon } from "./file-type-icon";

/**
 * File chooser with drag and drop. Only the file's metadata is posted with
 * the form (name, type, size); the bytes are uploaded separately to private
 * storage through a signed URL, so large files never pass through the app
 * server. The real <input type="file"> has no name on purpose.
 */
export function FilePicker({ error, label = "File" }: { error?: string; label?: string }) {
  const [file, setFile] = React.useState<{ name: string; type: string; size: number } | null>(null);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  function choose(next: File | undefined) {
    if (!next) return;
    const extension = next.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      setLocalError(`.${extension} files aren't allowed. Use PDF, images, video, ZIP or Office documents.`);
      setFile(null);
      return;
    }
    if (next.size > MAX_UPLOAD_BYTES) {
      setLocalError("Files can be up to 5 GB.");
      setFile(null);
      return;
    }
    setLocalError(null);
    setFile({ name: next.name, type: next.type, size: next.size });
  }

  const message = localError ?? error;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-ink-secondary">{label}</p>
      <input type="hidden" name="fileName" value={file?.name ?? ""} />
      <input type="hidden" name="mimeType" value={file?.type ?? ""} />
      <input type="hidden" name="sizeBytes" value={file?.size ?? ""} />
      {file ? (
        <div className="flex items-center gap-3 rounded-xl border border-cyan-500/25 bg-cyan-500/[0.05] px-4 py-3">
          <FileTypeIcon mimeType={file.type} fileName={file.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{file.name}</p>
            <p className="text-xs text-ink-faint">{formatBytes(file.size)}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setFile(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-faint hover:bg-white/5 hover:text-ink"
            aria-label="Remove file"
          >
            <X size={16} />
          </button>
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
            choose(event.dataTransfer.files[0]);
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
          <span className="text-xs text-ink-faint">PDF, images, video, ZIP or Office files · up to 5 GB</span>
          <input ref={inputRef} type="file" className="sr-only" onChange={(event) => choose(event.target.files?.[0])} />
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
