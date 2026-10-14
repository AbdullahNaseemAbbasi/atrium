"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { homePathFor } from "@/lib/auth/context";
import { createSession, destroySession } from "@/lib/auth/session";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/data/seed";
import { getDb, newId } from "@/lib/data/store";
import { fail, formValues, invalid, ok, type ActionState } from "./result";

const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
  next: z.string().optional(),
});

/** Only allow same-site relative redirects after sign-in. */
function safeNext(next: string | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formValues(formData));

  const user = getDb().users.find((item) => item.email === parsed.data.email);
  // Demo build: every seeded account shares one password. Supabase Auth replaces this check.
  if (!user || parsed.data.password !== DEMO_PASSWORD) {
    return fail("That email and password don't match an account.", undefined, formValues(formData));
  }

  await createSession(user.id);
  redirect(safeNext(parsed.data.next) ?? homePathFor(user));
}

export async function signInAsDemo(formData: FormData) {
  const userId = String(formData.get("userId") ?? "");
  const account = DEMO_ACCOUNTS.find((item) => item.userId === userId);
  const user = account && getDb().users.find((item) => item.id === account.userId);
  if (!user) redirect("/login?error=demo");
  await createSession(user.id);
  redirect(homePathFor(user));
}

export async function signOut() {
  await destroySession();
  redirect("/login?signedOut=1");
}

const signUpSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name.").max(80),
    email: z.string().trim().toLowerCase().email("Enter a valid email address."),
    password: z
      .string()
      .min(10, "Use at least 10 characters.")
      .regex(/[A-Za-z]/, "Include at least one letter.")
      .regex(/[0-9]/, "Include at least one number."),
    terms: z.literal("on", { error: "Please accept the terms to continue." }),
    next: z.string().optional(),
  });

export async function signUp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formValues(formData));

  const db = getDb();
  if (db.users.some((item) => item.email === parsed.data.email)) {
    return fail("An account with this email already exists. Sign in instead.", { email: ["Email already registered."] }, formValues(formData));
  }

  const id = newId("usr");
  db.users.push({
    id,
    name: parsed.data.name,
    email: parsed.data.email,
    avatarHue: Math.floor(Math.random() * 360),
    timezone: "UTC",
    createdAt: new Date().toISOString(),
  });
  await createSession(id);
  // Someone signing up from an invitation goes back to it instead of creating a workspace.
  redirect(safeNext(parsed.data.next) ?? "/onboarding");
}

const emailSchema = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email address.") });

export async function requestPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = emailSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formValues(formData));
  // Same response whether or not the account exists, so emails can't be enumerated.
  return ok(`If an account exists for ${parsed.data.email}, a reset link is on its way. It expires in 30 minutes.`);
}

const resetSchema = z
  .object({
    token: z.string().min(1),
    password: z.string().min(10, "Use at least 10 characters.").regex(/[0-9]/, "Include at least one number."),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords don't match.",
    path: ["confirmPassword"],
  });

export async function resetPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = resetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  return ok("Your password has been updated. You can sign in now.");
}
