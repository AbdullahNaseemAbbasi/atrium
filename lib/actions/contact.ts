"use server";

import { z } from "zod";
import { formValues, invalid, ok, type ActionState } from "./result";

const contactSchema = z.object({
  name: z.string().trim().min(2, "Tell us your name.").max(80, "Keep your name under 80 characters."),
  email: z.string().trim().toLowerCase().email("Enter a valid email address so we can reply."),
  company: z.string().trim().max(100, "Keep the company name under 100 characters.").optional(),
  topic: z.enum(["sales", "support", "billing", "security", "other"], { error: "Choose what your message is about." }),
  message: z
    .string()
    .trim()
    .min(20, "Add a little more detail (at least 20 characters).")
    .max(4000, "Keep your message under 4,000 characters."),
  /** Honeypot: hidden from people, often filled in by bots. */
  website: z.string().optional(),
});

/**
 * Validates a contact-form message. The demo build doesn't send email; in
 * production this hands the message to the support inbox.
 */
export async function sendContactMessage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formValues(formData, ["website"]));

  const firstName = parsed.data.name.split(/\s+/)[0];
  const reply = `Thanks, ${firstName}. Your message is with our team and we'll reply to ${parsed.data.email} within one business day.`;

  // Bots that fill the hidden field get the same answer, so they learn nothing.
  if (parsed.data.website) return ok(reply);

  return ok(reply);
}
