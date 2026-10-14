import type { z } from "zod";

/**
 * Shared return shape for server actions used with `useActionState`.
 * Field errors map form field names to messages so forms can show them inline.
 */
export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** Echo of submitted values so a failed form keeps what the user typed. */
  values?: Record<string, string>;
} | null;

export function ok(message?: string): ActionState {
  return { ok: true, message };
}

export function fail(message: string, fieldErrors?: Record<string, string[] | undefined>, values?: Record<string, string>): ActionState {
  return { ok: false, message, fieldErrors, values };
}

export function invalid(error: z.ZodError, values?: Record<string, string>): ActionState {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return { ok: false, message: "Please fix the highlighted fields.", fieldErrors, values };
}

/** Plain-object copy of string form fields (files and secrets excluded). */
export function formValues(formData: FormData, omit: string[] = ["password", "confirmPassword"]) {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !omit.includes(key) && !key.startsWith("$")) values[key] = value;
  }
  return values;
}
