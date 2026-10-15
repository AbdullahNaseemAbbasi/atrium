/**
 * A `next` return path, if it's safe to redirect to: same-site relative paths
 * only (`//host` and `/\host` would lead off-site).
 */
export function safeNext(value: string | string[] | null | undefined): string | undefined {
  const next = Array.isArray(value) ? value[0] : value;
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return undefined;
  return next;
}
