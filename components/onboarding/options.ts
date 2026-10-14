/**
 * Options and rules shared by the onboarding wizard (client) and the
 * `createWorkspace` / `checkSlugAvailability` actions (server). The server
 * re-validates everything; the client copy only gives faster feedback.
 */

export const INDUSTRIES = [
  "Design & development agency",
  "Marketing agency",
  "Branding studio",
  "Product design studio",
  "Web development studio",
  "Video & motion studio",
  "Consultancy",
  "Freelancer",
  "Other",
] as const;

export type Industry = (typeof INDUSTRIES)[number];

export const TIMEZONES: { value: string; label: string }[] = [
  { value: "Pacific/Honolulu", label: "Honolulu (UTC−10)" },
  { value: "America/Anchorage", label: "Anchorage (UTC−9)" },
  { value: "America/Los_Angeles", label: "Los Angeles (UTC−8)" },
  { value: "America/Denver", label: "Denver (UTC−7)" },
  { value: "America/Chicago", label: "Chicago (UTC−6)" },
  { value: "America/New_York", label: "New York (UTC−5)" },
  { value: "America/Toronto", label: "Toronto (UTC−5)" },
  { value: "America/Sao_Paulo", label: "São Paulo (UTC−3)" },
  { value: "UTC", label: "UTC" },
  { value: "Europe/London", label: "London (UTC+0)" },
  { value: "Europe/Dublin", label: "Dublin (UTC+0)" },
  { value: "Europe/Lisbon", label: "Lisbon (UTC+0)" },
  { value: "Europe/Berlin", label: "Berlin (UTC+1)" },
  { value: "Europe/Madrid", label: "Madrid (UTC+1)" },
  { value: "Europe/Paris", label: "Paris (UTC+1)" },
  { value: "Europe/Amsterdam", label: "Amsterdam (UTC+1)" },
  { value: "Europe/Stockholm", label: "Stockholm (UTC+1)" },
  { value: "Africa/Lagos", label: "Lagos (UTC+1)" },
  { value: "Africa/Johannesburg", label: "Johannesburg (UTC+2)" },
  { value: "Europe/Istanbul", label: "Istanbul (UTC+3)" },
  { value: "Asia/Dubai", label: "Dubai (UTC+4)" },
  { value: "Asia/Karachi", label: "Karachi (UTC+5)" },
  { value: "Asia/Kolkata", label: "Kolkata (UTC+5:30)" },
  { value: "Asia/Dhaka", label: "Dhaka (UTC+6)" },
  { value: "Asia/Bangkok", label: "Bangkok (UTC+7)" },
  { value: "Asia/Singapore", label: "Singapore (UTC+8)" },
  { value: "Asia/Shanghai", label: "Shanghai (UTC+8)" },
  { value: "Asia/Tokyo", label: "Tokyo (UTC+9)" },
  { value: "Australia/Sydney", label: "Sydney (UTC+10)" },
  { value: "Pacific/Auckland", label: "Auckland (UTC+12)" },
];

export const INVITE_ROLES = ["manager", "member", "billing"] as const;
export type InviteRole = (typeof INVITE_ROLES)[number];

export const MAX_INVITES = 10;
export const TRIAL_DAYS = 14;
export const INVITATION_DAYS = 7;

export const SLUG_MIN = 3;
export const SLUG_MAX = 32;
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Paths and words that would collide with app routes or confuse people. */
export const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "app",
  "atrium",
  "auth",
  "billing",
  "help",
  "invite",
  "login",
  "logout",
  "new",
  "onboarding",
  "portal",
  "pricing",
  "settings",
  "signup",
  "status",
  "support",
  "w",
  "www",
]);

/** Format problem with a workspace slug, or null when the format is fine. */
export function slugIssue(slug: string): string | null {
  if (slug.length < SLUG_MIN) return `Use at least ${SLUG_MIN} characters.`;
  if (slug.length > SLUG_MAX) return `Keep it to ${SLUG_MAX} characters or fewer.`;
  if (!SLUG_PATTERN.test(slug)) return "Use lowercase letters, numbers and single hyphens (not at the start or end).";
  if (RESERVED_SLUGS.has(slug)) return "That address is reserved. Try another.";
  return null;
}

/** Suggests a slug from a workspace name ("Northwind Studio" → "northwind-studio"). */
export function suggestSlug(name: string) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
}

export function isValidTimeZone(value: string) {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
