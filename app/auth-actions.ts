"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getBaseUrl, type ActionResult } from "@/lib/actor";
import { demoBackend, resetDemo } from "@/lib/backend/demo";
import { isSupabaseMode } from "@/lib/config";
import { DEMO_COOKIE } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export async function demoSignIn(profileId: string) {
  if (isSupabaseMode) redirect("/login");
  const profile = await demoBackend().getProfile(profileId);
  if (!profile) redirect("/login");
  (await cookies()).set(DEMO_COOKIE, profile.id, { httpOnly: true, sameSite: "lax", path: "/" });
  redirect(profile.role === "partner" ? "/partner" : "/app");
}

export async function sendMagicLink(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  const email = String(data.get("email") ?? "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email address." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    // Accounts are created by an admin; signing in never creates one.
    options: { shouldCreateUser: false, emailRedirectTo: `${await getBaseUrl()}/auth/callback` },
  });
  // Same message either way, so the form doesn't reveal who has an account.
  if (error) console.warn("[careride] magic link:", error.message);
  return { ok: "If that email belongs to a CareRide account, a sign-in link is on its way." };
}

export async function signOut() {
  if (isSupabaseMode) await (await createClient()).auth.signOut();
  else (await cookies()).delete(DEMO_COOKIE);
  redirect("/");
}

export async function resetDemoData() {
  if (!isSupabaseMode) resetDemo();
  redirect("/login");
}
