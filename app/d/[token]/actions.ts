"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actor";
import { getBackend } from "@/lib/backend";
import { driverUpdate, RideError } from "@/lib/rides";
import type { RideStatus } from "@/lib/types";

export async function driverStatusAction(token: string, to: RideStatus, _prev: ActionResult, _data: FormData): Promise<ActionResult> {
  try {
    await driverUpdate(await getBackend(), token, to);
  } catch (e) {
    if (e instanceof RideError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/d/${token}`);
  return { ok: "Thanks, updated." };
}
