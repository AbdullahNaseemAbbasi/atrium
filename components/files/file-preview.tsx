import Image from "next/image";
import { Play } from "lucide-react";
import { formatBytes } from "@/lib/utils";
import { fileKind } from "./file-type-icon";

/**
 * Preview of a private file. Uploaded images show through a short-lived
 * signed URL (`previewUrl`); other types, and the seeded demo files, get a
 * neutral drawing that matches the file type.
 */
export function FilePreview({
  fileName,
  mimeType,
  sizeBytes,
  version,
  previewUrl,
}: {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  version: number;
  previewUrl?: string | null;
}) {
  const kind = fileKind(mimeType, fileName);
  return (
    <figure className="overflow-hidden rounded-2xl border border-line bg-[#0a1520]">
      <div className="relative grid aspect-[16/9] place-items-center overflow-hidden bg-[radial-gradient(circle_at_30%_20%,rgba(34,211,238,0.08),transparent_55%)]">
        {previewUrl ? (
          // Signed URLs change on every render and expire, so they skip the image optimizer.
          <Image src={previewUrl} alt={`Version ${version} of ${fileName}`} fill unoptimized sizes="(min-width: 1280px) 60vw, 100vw" className="object-contain" />
        ) : (
          kind === "image" && <MockupArt />
        )}
        {kind === "pdf" && <DocumentArt />}
        {kind === "video" && (
          <div className="relative grid h-full w-full place-items-center bg-[linear-gradient(135deg,#0f2533,#09141d)]">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-white/10 text-white backdrop-blur ring-1 ring-white/20">
              <Play size={26} className="ml-1" aria-hidden="true" />
            </span>
            <div className="absolute inset-x-6 bottom-5 h-1 rounded-full bg-white/10">
              <div className="h-full w-1/3 rounded-full bg-cyan-400" />
            </div>
          </div>
        )}
        {(kind === "sheet" || kind === "doc" || kind === "archive" || kind === "other") && <DocumentArt rows />}
        <span className="absolute left-3 top-3 rounded-md bg-black/40 px-2 py-1 text-[11px] font-medium text-white/80 backdrop-blur">v{version}</span>
      </div>
      <figcaption className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-xs">
        <span className="truncate text-ink-secondary">{fileName}</span>
        <span className="flex-none text-ink-faint">{formatBytes(sizeBytes)}</span>
      </figcaption>
    </figure>
  );
}

function MockupArt() {
  return (
    <svg viewBox="0 0 640 360" className="h-full w-full" aria-hidden="true">
      <rect x="70" y="30" width="500" height="300" rx="14" fill="#0f1f2c" stroke="rgba(255,255,255,0.08)" />
      <rect x="70" y="30" width="500" height="34" rx="14" fill="#132636" />
      <rect x="100" y="90" width="210" height="18" rx="5" fill="#e2e8f0" opacity="0.85" />
      <rect x="100" y="118" width="170" height="18" rx="5" fill="#e2e8f0" opacity="0.6" />
      <rect x="100" y="150" width="230" height="8" rx="4" fill="#94a3b8" opacity="0.5" />
      <rect x="100" y="166" width="200" height="8" rx="4" fill="#94a3b8" opacity="0.4" />
      <rect x="100" y="194" width="110" height="30" rx="9" fill="#22d3ee" />
      <rect x="350" y="86" width="190" height="150" rx="14" fill="url(#mock-grad)" />
      <rect x="100" y="256" width="135" height="50" rx="10" fill="#132636" />
      <rect x="252" y="256" width="135" height="50" rx="10" fill="#132636" />
      <rect x="404" y="256" width="135" height="50" rx="10" fill="#132636" />
      <defs>
        <linearGradient id="mock-grad" x1="350" y1="86" x2="540" y2="236">
          <stop stopColor="#0891b2" />
          <stop offset="1" stopColor="#1e3a8a" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function DocumentArt({ rows = false }: { rows?: boolean }) {
  return (
    <svg viewBox="0 0 640 360" className="h-full w-full" aria-hidden="true">
      <rect x="250" y="38" width="200" height="270" rx="10" fill="#0f1f2c" stroke="rgba(255,255,255,0.06)" transform="rotate(6 350 173)" />
      <rect x="220" y="30" width="200" height="280" rx="10" fill="#132636" stroke="rgba(255,255,255,0.1)" />
      <rect x="244" y="58" width="110" height="12" rx="4" fill="#e2e8f0" opacity="0.8" />
      {rows
        ? Array.from({ length: 9 }, (_, index) => (
            <g key={index}>
              <rect x="244" y={90 + index * 22} width="40" height="10" rx="3" fill="#22d3ee" opacity="0.35" />
              <rect x="292" y={90 + index * 22} width="104" height="10" rx="3" fill="#94a3b8" opacity="0.35" />
            </g>
          ))
        : Array.from({ length: 10 }, (_, index) => (
            <rect key={index} x="244" y={90 + index * 20} width={index % 3 === 2 ? 110 : 152} height="8" rx="4" fill="#94a3b8" opacity="0.4" />
          ))}
    </svg>
  );
}
