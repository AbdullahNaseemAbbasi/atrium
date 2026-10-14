import { Globe, HeartPulse, Layers, Megaphone, Palette, Search, ShoppingCart, Smartphone, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectIcon as ProjectIconName } from "@/lib/data/types";

export const PROJECT_ICONS: Record<ProjectIconName, LucideIcon> = {
  globe: Globe,
  smartphone: Smartphone,
  palette: Palette,
  cart: ShoppingCart,
  megaphone: Megaphone,
  heart: HeartPulse,
  search: Search,
  layers: Layers,
};

export const PROJECT_ICON_OPTIONS: { value: ProjectIconName; label: string }[] = [
  { value: "globe", label: "Website" },
  { value: "smartphone", label: "App" },
  { value: "palette", label: "Brand" },
  { value: "cart", label: "E-commerce" },
  { value: "megaphone", label: "Campaign" },
  { value: "heart", label: "Health" },
  { value: "search", label: "SEO & content" },
  { value: "layers", label: "Other" },
];

/** Tinted project tile. Uses the client's brand hue when there is one. */
export function ProjectIcon({
  icon,
  hue,
  size = "md",
  className,
}: {
  icon: ProjectIconName;
  hue?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const Icon = PROJECT_ICONS[icon];
  const h = hue ?? 190;
  const dims = size === "sm" ? "h-7 w-7 rounded-md" : size === "lg" ? "h-14 w-14 rounded-2xl" : "h-9 w-9 rounded-lg";
  const iconSize = size === "sm" ? 14 : size === "lg" ? 26 : 16;
  return (
    <span
      className={cn("grid flex-none place-items-center", dims, className)}
      style={{
        background: `hsl(${h} 75% 50% / 0.13)`,
        color: `hsl(${h} 85% 70%)`,
        boxShadow: `inset 0 0 0 1px hsl(${h} 70% 55% / 0.22)`,
      }}
      aria-hidden="true"
    >
      <Icon size={iconSize} />
    </span>
  );
}
