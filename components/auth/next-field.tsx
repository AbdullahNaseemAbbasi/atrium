import { safeNext } from "@/lib/auth/safe-next";

/**
 * The `?next=` return path as a hidden form field. It streams in on its own
 * Suspense boundary, so the inputs around it render once and keep what people
 * type while the page finishes loading. The actions check the path again.
 */
export async function NextField({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const next = safeNext((await searchParams).next);
  return <input type="hidden" name="next" value={next ?? ""} />;
}
