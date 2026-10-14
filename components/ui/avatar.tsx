import { cn, initials } from "@/lib/utils";

interface AvatarUser {
  name: string;
  avatarHue: number;
}

const SIZES = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-9 w-9 text-xs",
  lg: "h-11 w-11 text-sm",
  xl: "h-16 w-16 text-lg",
} as const;

export function Avatar({
  user,
  size = "md",
  className,
  ring = false,
}: {
  user: AvatarUser;
  size?: keyof typeof SIZES;
  className?: string;
  ring?: boolean;
}) {
  const hue = user.avatarHue;
  return (
    <span
      className={cn(
        "inline-grid flex-none select-none place-items-center rounded-full font-semibold text-white",
        ring && "ring-2 ring-canvas",
        SIZES[size],
        className,
      )}
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 70% 45%), hsl(${(hue + 40) % 360} 75% 30%))`,
      }}
      title={user.name}
      aria-hidden="true"
    >
      {initials(user.name)}
    </span>
  );
}

export function AvatarStack({
  users,
  max = 4,
  size = "sm",
}: {
  users: (AvatarUser & { id: string })[];
  max?: number;
  size?: keyof typeof SIZES;
}) {
  const shown = users.slice(0, max);
  const rest = users.length - shown.length;
  return (
    <div className="flex items-center" aria-label={users.map((user) => user.name).join(", ")}>
      {shown.map((user, index) => (
        <Avatar key={user.id} user={user} size={size} ring className={index > 0 ? (size === "xs" ? "-ml-1" : "-ml-2") : undefined} />
      ))}
      {rest > 0 && (
        <span
          className={cn(
            "-ml-2 inline-grid place-items-center rounded-full bg-surface-raised font-semibold text-ink-muted ring-2 ring-canvas",
            SIZES[size],
          )}
          aria-hidden="true"
        >
          +{rest}
        </span>
      )}
    </div>
  );
}

/** Square brand tile for clients and organizations. */
export function BrandTile({
  name,
  hue,
  size = "md",
  className,
}: {
  name: string;
  hue: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dims = size === "sm" ? "h-7 w-7 rounded-md text-[11px]" : size === "lg" ? "h-12 w-12 rounded-xl text-base" : "h-9 w-9 rounded-lg text-xs";
  return (
    <span
      className={cn("inline-grid flex-none place-items-center font-bold", dims, className)}
      style={{
        background: `hsl(${hue} 70% 50% / 0.14)`,
        color: `hsl(${hue} 85% 72%)`,
        boxShadow: `inset 0 0 0 1px hsl(${hue} 70% 55% / 0.25)`,
      }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
