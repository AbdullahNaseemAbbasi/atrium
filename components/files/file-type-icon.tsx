import { File, FileArchive, FileImage, FileSpreadsheet, FileText, FileVideo } from "lucide-react";
import { cn } from "@/lib/utils";

export function fileKind(mimeType: string, fileName = "") {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType === "application/pdf" || ext === "pdf") return "pdf";
  if (mimeType.includes("zip") || ext === "zip") return "archive";
  if (mimeType.includes("spreadsheet") || ext === "xlsx" || ext === "csv") return "sheet";
  if (mimeType.includes("word") || mimeType.startsWith("text/") || ext === "docx") return "doc";
  return "other";
}

const META = {
  image: { icon: FileImage, className: "bg-violet-500/10 text-violet-300" },
  video: { icon: FileVideo, className: "bg-pink-500/10 text-pink-300" },
  pdf: { icon: FileText, className: "bg-red-500/10 text-red-300" },
  archive: { icon: FileArchive, className: "bg-amber-500/10 text-amber-300" },
  sheet: { icon: FileSpreadsheet, className: "bg-emerald-500/10 text-emerald-300" },
  doc: { icon: FileText, className: "bg-blue-500/10 text-blue-300" },
  other: { icon: File, className: "bg-white/[0.06] text-ink-muted" },
} as const;

export function FileTypeIcon({ mimeType, fileName, size = "md" }: { mimeType: string; fileName?: string; size?: "sm" | "md" | "lg" }) {
  const meta = META[fileKind(mimeType, fileName)];
  const Icon = meta.icon;
  const dims = size === "sm" ? "h-8 w-8 rounded-lg" : size === "lg" ? "h-14 w-14 rounded-2xl" : "h-10 w-10 rounded-xl";
  return (
    <span className={cn("grid flex-none place-items-center", dims, meta.className)} aria-hidden="true">
      <Icon size={size === "lg" ? 26 : size === "sm" ? 15 : 18} />
    </span>
  );
}
