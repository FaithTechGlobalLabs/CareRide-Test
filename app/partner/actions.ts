"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getBaseUrl, toActor, type ActionResult } from "@/lib/actor";
import { getBackend } from "@/lib/backend";
import { assignDriver, partnerAccept, partnerDecline, partnerRelease, partnerSetStatus, RideError } from "@/lib/rides";
import { requirePartner } from "@/lib/session";
import type { RideStatus } from "@/lib/types";

async function run(fn: () => Promise<unknown>): Promise<ActionResult> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof RideError) return { error: e.message };
    throw e;
  }
  revalidatePath("/partner", "layout");
  return { ok: "Updated" };
}

export async function acceptRide(rideId: string, _prev: ActionResult, _data: FormData): Promise<ActionResult> {
  const viewer = await requirePartner();
  const result = await run(async () => partnerAccept(await getBackend(), toActor(viewer), rideId, await getBaseUrl()));
  if (result?.error) return result;
  redirect(`/partner/rides/${rideId}`);
}

export async function declineRide(rideId: string, _prev: ActionResult, data: FormData): Promise<ActionResult> {
  const viewer = await requirePartner();
  const reason = String(data.get("reason") ?? "").trim();
  return run(async () => partnerDecline(await getBackend(), toActor(viewer), rideId, reason));
}

export async function releaseRide(rideId: string, _prev: ActionResult, data: FormData): Promise<ActionResult> {
  const viewer = await requirePartner();
  const reason = String(data.get("reason") ?? "").trim();
  const result = await run(async () => partnerRelease(await getBackend(), toActor(viewer), rideId, reason, await getBaseUrl()));
  if (result?.error) return result;
  redirect("/partner");
}

export async function assignDriverAction(rideId: string, _prev: ActionResult, data: FormData): Promise<ActionResult> {
  const viewer = await requirePartner();
  const name = String(data.get("driver_name") ?? "").trim();
  const phone = String(data.get("driver_phone") ?? "").trim();
  if (!name || name.length > 60) return { error: "Add the driver's first name." };
  if (!/^[+\d][\d\s().-]{6,20}$/.test(phone)) return { error: "Add a mobile number the driver can get texts on." };
  return run(async () => assignDriver(await getBackend(), toActor(viewer), rideId, { name, phone }, await getBaseUrl()));
}

export async function partnerStatusAction(rideId: string, to: RideStatus, _prev: ActionResult, _data: FormData): Promise<ActionResult> {
  const viewer = await requirePartner();
  return run(async () => partnerSetStatus(await getBackend(), toActor(viewer), rideId, to, await getBaseUrl()));
}
