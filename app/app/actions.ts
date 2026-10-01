"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getBaseUrl, toActor, type ActionResult } from "@/lib/actor";
import { getBackend } from "@/lib/backend";
import { createRide, RideError, staffSetStatus, type CreateRideInput } from "@/lib/rides";
import { requireStaff } from "@/lib/session";
import { localInputToIso } from "@/lib/time";
import { NEEDS, type RideStatus } from "@/lib/types";

const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Choose a date and time");
const optionalLocalDateTime = z.union([z.literal(""), localDateTime]);

const RideForm = z
  .object({
    rider_id: z.string(),
    rider_name: z.string().trim().max(40),
    rider_language: z.string().trim().max(40),
    needs: z.array(z.enum(NEEDS)),
    pickup_place_id: z.string(),
    pickup_name: z.string().trim().max(120),
    pickup_address: z.string().trim().max(200),
    dropoff_place_id: z.string(),
    dropoff_name: z.string().trim().max(120),
    dropoff_address: z.string().trim().max(200),
    pickup_at: localDateTime,
    appointment_at: optionalLocalDateTime,
    return_pickup_at: optionalLocalDateTime,
    payment_type: z.enum(["free", "paid"]),
    funding_source_id: z.string(),
    cost_cap: z.string().trim(),
    driver_notes: z.string().trim().max(500, "Keep notes under 500 characters"),
    contact_phone: z.string().trim().min(7, "Add a phone number to call about this ride").max(30),
    consent: z.literal("on", { error: "Confirm the person agreed to share their first name and pickup details." }),
  })
  .superRefine((v, ctx) => {
    if (v.rider_id === "new" && !/^\S+( \S\.?)?$/.test(v.rider_name))
      ctx.addIssue({ code: "custom", message: 'Use a first name and last initial only, e.g. "Maria T."', path: ["rider_name"] });
    if (v.pickup_place_id === "other" && (!v.pickup_name || !v.pickup_address))
      ctx.addIssue({ code: "custom", message: "Add the pickup place and address.", path: ["pickup_name"] });
    if (v.dropoff_place_id === "other" && (!v.dropoff_name || !v.dropoff_address))
      ctx.addIssue({ code: "custom", message: "Add the destination and address.", path: ["dropoff_name"] });
    if (v.payment_type === "paid" && !/^\d+(\.\d{1,2})?$/.test(v.cost_cap))
      ctx.addIssue({ code: "custom", message: "Enter the most this ride may cost, e.g. 40.00", path: ["cost_cap"] });
  });

export async function requestRide(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  const viewer = await requireStaff();
  const parsed = RideForm.safeParse({ ...Object.fromEntries(data), needs: data.getAll("needs") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const f = parsed.data;

  const b = await getBackend();
  const places = await b.listPlaces(viewer.org_id);
  const placeOr = (id: string, name: string, address: string) => {
    const p = places.find((x) => x.id === id);
    return p ? { name: p.name, address: p.address, type: p.type } : { name, address, type: "other" as const };
  };

  const pickup_at = localInputToIso(f.pickup_at);
  if (new Date(pickup_at).getTime() < Date.now() - 15 * 60e3) return { error: "The pickup time is in the past." };

  const input: CreateRideInput = {
    rider: f.rider_id === "new" ? { display_name: f.rider_name, language: f.rider_language || "English" } : { id: f.rider_id },
    needs: f.needs,
    pickup: placeOr(f.pickup_place_id, f.pickup_name, f.pickup_address),
    dropoff: placeOr(f.dropoff_place_id, f.dropoff_name, f.dropoff_address),
    pickup_at,
    appointment_at: f.appointment_at ? localInputToIso(f.appointment_at) : null,
    return_pickup_at: f.return_pickup_at ? localInputToIso(f.return_pickup_at) : null,
    payment_type: f.payment_type,
    funding_source_id: f.payment_type === "paid" ? f.funding_source_id || null : null,
    cost_cap_cents: f.payment_type === "paid" ? Math.round(Number(f.cost_cap) * 100) : null,
    driver_notes: f.driver_notes,
    contact_phone: f.contact_phone,
  };

  let rideId: string;
  try {
    rideId = (await createRide(b, toActor(viewer), input, await getBaseUrl())).id;
  } catch (e) {
    if (e instanceof RideError) return { error: e.message };
    throw e;
  }
  revalidatePath("/app");
  redirect(`/app/rides/${rideId}?created=1`);
}

export async function setRideStatus(rideId: string, to: RideStatus, _prev: ActionResult, data: FormData): Promise<ActionResult> {
  const viewer = await requireStaff();
  const note = String(data.get("reason") ?? "").trim() || null;
  try {
    await staffSetStatus(await getBackend(), toActor(viewer), rideId, to, note);
  } catch (e) {
    if (e instanceof RideError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/app/rides/${rideId}`);
  revalidatePath("/app");
  return { ok: "Updated" };
}
