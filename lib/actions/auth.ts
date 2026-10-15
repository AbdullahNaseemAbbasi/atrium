"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { homePathFor } from "@/lib/auth/context";
import { safeNext } from "@/lib/auth/safe-next";
import { createSession, destroySession } from "@/lib/auth/session";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/data/seed";
import { getDb, newId, saveDb } from "@/lib/data/store";
import type { User } from "@/lib/data/types";
import { usesSupabase } from "@/lib/supabase/config";
import { fail, formValues, invalid, ok, type ActionState } from "./result";

const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
  next: z.string().optional(),
});

const WRONG_CREDENTIALS = "That email and password don't match an account.";

/** Only allow same-site relative redirects after sign-in. */

/* ---------- Supabase helpers ---------- */

async function supabaseClients() {
  const { createSupabaseServerClient, supabaseAdmin } = await import("@/lib/supabase/server");
  return { auth: (await createSupabaseServerClient()).auth, admin: supabaseAdmin() };
}

async function profileForAuthUser(authUserId: string): Promise<User | null> {
  const { admin } = await supabaseClients();
  const { fromRow } = await import("@/lib/data/supabase/tables");
  const { data } = await admin.from("profiles").select("*").eq("auth_user_id", authUserId).maybeSingle();
  return data ? fromRow<User>(data) : null;
}

/** First workspace, else first client portal, else operations, else onboarding. */
async function supabaseHomePath(profile: User) {
  const { admin } = await supabaseClients();
  const [team, portal] = await Promise.all([
    admin.from("memberships").select("organization_id, joined_at").eq("user_id", profile.id).eq("status", "active").order("joined_at"),
    admin.from("client_memberships").select("organization_id, joined_at").eq("user_id", profile.id).eq("status", "active").order("joined_at"),
  ]);
  const pick = async (orgId: string | undefined) => {
    if (!orgId) return null;
    const { data } = await admin.from("organizations").select("slug").eq("id", orgId).maybeSingle();
    return data?.slug as string | undefined;
  };
  const teamSlug = await pick(team.data?.[0]?.organization_id);
  if (teamSlug) return `/w/${teamSlug}`;
  const portalSlug = await pick(portal.data?.[0]?.organization_id);
  if (portalSlug) return `/portal/${portalSlug}`;
  if (profile.isPlatformAdmin) return "/admin";
  return "/onboarding";
}

async function supabaseSignIn(email: string, password: string): Promise<{ profile: User } | { error: string }> {
  const { auth } = await supabaseClients();
  const { data, error } = await auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: WRONG_CREDENTIALS };
  const profile = await profileForAuthUser(data.user.id);
  if (!profile) {
    await auth.signOut();
    return { error: "This login has no Atrium profile. Ask the workspace owner to invite you again." };
  }
  return { profile };
}

async function requestOrigin() {
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host") ?? "localhost:3000";
  const protocol = list.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${protocol}://${host}`;
}

/* ---------- Actions ---------- */

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formValues(formData));

  if (usesSupabase()) {
    const result = await supabaseSignIn(parsed.data.email, parsed.data.password);
    if ("error" in result) return fail(result.error, undefined, formValues(formData));
    redirect(safeNext(parsed.data.next) ?? (await supabaseHomePath(result.profile)));
  }

  const user = (await getDb()).users.find((item) => item.email === parsed.data.email);
  // Memory mode: every seeded account shares one password.
  if (!user || parsed.data.password !== DEMO_PASSWORD) return fail(WRONG_CREDENTIALS, undefined, formValues(formData));
  await createSession(user.id);
  redirect(safeNext(parsed.data.next) ?? (await homePathFor(user)));
}

export async function signInAsDemo(formData: FormData) {
  const userId = String(formData.get("userId") ?? "");
  const account = DEMO_ACCOUNTS.find((item) => item.userId === userId);
  if (!account) redirect("/login?error=demo");

  if (usesSupabase()) {
    const result = await supabaseSignIn(account.email, DEMO_PASSWORD);
    if ("error" in result) redirect("/login?error=demo");
    redirect(await supabaseHomePath(result.profile));
  }

  const user = (await getDb()).users.find((item) => item.id === account.userId);
  if (!user) redirect("/login?error=demo");
  await createSession(user.id);
  redirect(await homePathFor(user));
}

export async function signOut() {
  if (usesSupabase()) {
    const { auth } = await supabaseClients();
    await auth.signOut();
  } else {
    await destroySession();
  }
  redirect("/login?signedOut=1");
}

const signUpSchema = z.object({
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

const EMAIL_TAKEN = "An account with this email already exists. Sign in instead.";

export async function signUp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formValues(formData));
  const { name, email, password } = parsed.data;
  // Someone signing up from an invitation goes back to it instead of creating a workspace.
  const destination = safeNext(parsed.data.next) ?? "/onboarding";

  if (usesSupabase()) {
    const { auth, admin } = await supabaseClients();
    const existing = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
    if (existing.data) return fail(EMAIL_TAKEN, { email: ["Email already registered."] }, formValues(formData));
    const { data, error } = await auth.signUp({ email, password, options: { data: { name } } });
    if (error || !data.user) {
      return fail(error?.message ?? "We couldn't create your account. Try again in a minute.", undefined, formValues(formData));
    }
    const profile = {
      id: newId("usr"),
      name,
      email,
      avatar_hue: Math.floor(Math.random() * 360),
      timezone: "UTC",
      auth_user_id: data.user.id,
      created_at: new Date().toISOString(),
    };
    const insert = await admin.from("profiles").insert(profile);
    if (insert.error) return fail("We couldn't finish setting up your profile. Try signing in.", undefined, formValues(formData));
    if (!data.session) return ok("Check your inbox to confirm your email, then sign in.");
    redirect(destination);
  }

  const db = await getDb();
  if (db.users.some((item) => item.email === email)) {
    return fail(EMAIL_TAKEN, { email: ["Email already registered."] }, formValues(formData));
  }
  const id = newId("usr");
  db.users.push({ id, name, email, avatarHue: Math.floor(Math.random() * 360), timezone: "UTC", createdAt: new Date().toISOString() });
  await createSession(id);
  await saveDb();
  redirect(destination);
}

const emailSchema = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email address.") });

export async function requestPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = emailSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formValues(formData));
  if (usesSupabase()) {
    const { auth } = await supabaseClients();
    // The error is ignored on purpose: the answer must not reveal whether the account exists.
    await auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${await requestOrigin()}/auth/callback?next=${encodeURIComponent("/reset-password?token=session")}`,
    });
  }
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
  if (usesSupabase()) {
    // The reset link signed the person in through /auth/callback; now set the new password.
    const { auth } = await supabaseClients();
    const { error } = await auth.updateUser({ password: parsed.data.password });
    if (error) return fail("This reset link has expired. Ask for a new one from the sign-in page.");
    await auth.signOut();
  }
  return ok("Your password has been updated. You can sign in now.");
}
