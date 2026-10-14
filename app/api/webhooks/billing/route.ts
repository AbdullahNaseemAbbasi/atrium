import { getDb } from "@/lib/data/store";
import { handleBillingWebhook, SIGNATURE_HEADER } from "@/lib/billing/webhooks";

/**
 * Billing provider webhook endpoint (Stripe-style, test mode).
 *
 * The HMAC signature in `atrium-signature` is verified over the exact raw
 * body before anything is parsed; bad signatures and malformed payloads get
 * a 400. Valid events go through the shared processor, which deduplicates by
 * event ID and ignores out-of-order subscription events.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  if (rawBody.length > 64 * 1024) return Response.json({ received: false, message: "Payload too large." }, { status: 413 });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;
  const result = handleBillingWebhook(getDb(), rawBody, request.headers.get(SIGNATURE_HEADER), { ip });
  return Response.json(result.body, { status: result.httpStatus, headers: { "Cache-Control": "no-store" } });
}
