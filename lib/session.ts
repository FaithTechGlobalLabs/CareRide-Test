import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getBackend } from "./backend";
import { isSupabaseMode } from "./config";
import { createClient } from "./supabase/server";
import type { Organization, Profile } from "./types";

export const DEMO_COOKIE = "careride_demo_user";

export type Viewer = Profile & { org: Organization };

export async function getViewer(): Promise<Viewer | null> {
  let profileId: string | undefined;
  if (isSupabaseMode) {
    const { data } = await (await createClient()).auth.getUser();
    profileId = data.user?.id;
  } else {
    profileId = (await cookies()).get(DEMO_COOKIE)?.value;
  }
  if (!profileId) return null;

  const backend = await getBackend();
  const profile = await backend.getProfile(profileId);
  if (!profile) return null;
  const org = await backend.getOrg(profile.org_id);
  return org ? { ...profile, org } : null;
}

export const isStaff = (v: Viewer) => v.role === "staff" || v.role === "coordinator";

/** For Salvation Army staff pages. Partners are sent to their own inbox. */
export async function requireStaff(): Promise<Viewer> {
  const v = await getViewer();
  if (!v) redirect("/login");
  if (!isStaff(v)) redirect("/partner");
  return v;
}

/** For partner pages. Staff are sent to their dashboard. */
export async function requirePartner(): Promise<Viewer> {
  const v = await getViewer();
  if (!v) redirect("/login");
  if (v.role !== "partner") redirect("/app");
  return v;
}

export function homeFor(v: Viewer): string {
  return isStaff(v) ? "/app" : "/partner";
}
