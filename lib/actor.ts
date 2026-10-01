import "server-only";
import { headers } from "next/headers";
import type { Actor } from "./rides";
import type { Viewer } from "./session";

export function toActor(v: Viewer): Actor {
  return { id: v.id, name: v.name, role: v.role, org_id: v.org_id, org: { name: v.org.name } };
}

/** Absolute URL for links in emails and texts. */
export async function getBaseUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export type ActionResult = { error?: string; ok?: string } | undefined;
