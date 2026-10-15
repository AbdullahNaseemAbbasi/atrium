import { getDbWith, saveDb } from "@/lib/data/store";
import { billingWebhookSecret, handleBillingWebhook, SIGNATURE_HEADER, verifyWebhookSignature } from "@/lib/billing/webhooks";

/**
 * Billing provider webhook endpoint (Stripe-style, test mode).
 *
 * The HMAC signature in `atrium-signature` is verified over the exact raw
 * body before anything is parsed or loaded; bad signatures and malformed
 * payloads get a 400. Valid events go through the shared processor, which
 * deduplicates by event ID and ignores out-of-order subscription events.
 * Webhooks have no signed-in user, so the event's workspace is loaded by id.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  if (rawBody.length > 64 * 1024) return Response.json({ received: false, message: "Payload too large." }, { status: 413 });
  const signature = request.headers.get(SIGNATURE_HEADER);
  const check = verifyWebhookSignature(rawBody, signature, billingWebhookSecret());
  if (!check.ok) return Response.json({ received: false, message: check.reason }, { status: 400, headers: { "Cache-Control": "no-store" } });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;

  const db = await getDbWith(organizationIdsIn(rawBody));
  const result = handleBillingWebhook(db, rawBody, signature, { ip });
  await saveDb();
  return Response.json(result.body, { status: result.httpStatus, headers: { "Cache-Control": "no-store" } });
}

function organizationIdsIn(rawBody: string): string[] {
  try {
    const id = (JSON.parse(rawBody) as { data?: { organizationId?: unknown } }).data?.organizationId;
    return typeof id === "string" && id.length <= 64 ? [id] : [];
  } catch {
    return [];
  }
}
