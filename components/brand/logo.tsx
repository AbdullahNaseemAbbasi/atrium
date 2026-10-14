import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Atrium mark: an arched doorway built from two pillars, the shared space
 * where an agency and its client meet.
 */
export function LogoMark({ className, size = 30 }: { className?: string; size?: number }) {
  // Unique per instance: a hidden copy with a shared id would blank out the others.
  const gradientId = `atrium-mark-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#67e8f9" />
          <stop offset="1" stopColor="#0ea5e9" />
        </linearGradient>
      </defs>
      <path
        d="M5 29V15.5C5 8.6 9.9 3 16 3s11 5.6 11 12.5V29h-5.5V15.8c0-3.6-2.5-6.5-5.5-6.5s-5.5 2.9-5.5 6.5V29H5Z"
        fill={`url(#${gradientId})`}
      />
      <rect x="13.25" y="19" width="5.5" height="10" rx="1.6" fill="#22d3ee" opacity="0.55" />
    </svg>
  );
}

export function Logo({ className, size = 30, wordmark = true }: { className?: string; size?: number; wordmark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={size} className="drop-shadow-[0_0_14px_rgba(34,211,238,.45)]" />
      {wordmark && <span className="text-xl font-bold tracking-tight text-ink">Atrium</span>}
    </span>
  );
}
