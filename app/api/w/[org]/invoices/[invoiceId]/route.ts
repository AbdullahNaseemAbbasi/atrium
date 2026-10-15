import { can } from "@/lib/auth/permissions";
import { getPlan } from "@/lib/billing/plans";
import { getDb } from "@/lib/data/store";
import { attachmentHeaders, notFoundResponse, routeTeamContext } from "@/lib/export/route-auth";
import { formatDate, formatDateRange, formatMoney } from "@/lib/utils";

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

/**
 * Invoice receipt download. Billing access is re-checked and the invoice
 * must belong to this workspace; anything else is a 404 so invoice IDs
 * can't be probed across tenants.
 */
export async function GET(_request: Request, context: RouteContext<"/api/w/[org]/invoices/[invoiceId]">) {
  const { org, invoiceId } = await context.params;
  const ctx = await routeTeamContext(org);
  if (!ctx || !can(ctx.role, "billing.view")) return notFoundResponse();

  const db = getDb();
  const invoice = db.invoices.find((item) => item.id === invoiceId && item.organizationId === ctx.org.id);
  if (!invoice) return notFoundResponse();
  const subscription = db.subscriptions.find((item) => item.organizationId === ctx.org.id);
  const card = subscription?.paymentMethod;
  const amount = formatMoney(invoice.amountCents, invoice.currency);
  const rows: [string, string][] = [
    ["Invoice number", invoice.number],
    ["Issued", formatDate(invoice.issuedAt)],
    ["Billing period", formatDateRange(invoice.periodStart, invoice.periodEnd)],
    ["Billed to", ctx.org.name],
    ["Plan", subscription ? `Atrium ${getPlan(subscription.planKey).name}` : "Atrium"],
    ["Status", invoice.status === "paid" ? "Paid" : invoice.status === "open" ? "Open" : invoice.status === "void" ? "Void" : "Uncollectible"],
    ["Payment method", card ? `${card.brand} ending ${card.last4} (test card)` : "None on file"],
  ];

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(invoice.number)} · Atrium receipt</title>
<style>
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #0f172a; max-width: 640px; margin: 48px auto; padding: 0 24px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  p.muted { color: #475569; margin: 0 0 24px; font-size: 14px; }
  .test { display: inline-block; border: 1px solid #b45309; color: #92400e; background: #fffbeb; border-radius: 6px; padding: 4px 10px; font-size: 12px; font-weight: 600; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  td { padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
  td:last-child { text-align: right; }
  .total td { font-weight: 700; font-size: 16px; border-bottom: 0; padding-top: 16px; }
  footer { margin-top: 40px; color: #64748b; font-size: 12px; line-height: 1.6; }
</style>
</head>
<body>
<div class="test">Test mode · No real payment was taken</div>
<h1>Receipt ${escapeHtml(invoice.number)}</h1>
<p class="muted">Atrium · Client portal software</p>
<table>
${rows.map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`).join("\n")}
<tr class="total"><td>Total</td><td>${escapeHtml(amount)}</td></tr>
</table>
<footer>This receipt was generated from synthetic demo data in Stripe test mode. It is not a tax invoice and no money moved.</footer>
</body>
</html>`;

  return new Response(html, { headers: attachmentHeaders(`${invoice.number}.html`, "text/html; charset=utf-8") });
}
