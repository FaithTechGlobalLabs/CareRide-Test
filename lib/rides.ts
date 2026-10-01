// Ride workflows used by server actions. Each checks lib/rules.ts before
// writing, records a timeline event, and lets the right people know.

import type { Backend } from "./backend/types";
import { sendEmail, sendSms } from "./notify";
import { canTransition, partnerCanServe, STATUS_LABELS } from "./rules";
import { formatShort } from "./time";
import type { Need, PaymentType, PlaceType, Ride, RideStatus, RideView } from "./types";

export type Actor = {
  id: string;
  name: string;
  role: "staff" | "coordinator" | "partner";
  org_id: string;
  org: { name: string };
};

export class RideError extends Error {}

const actorLabel = (a: Actor) => (a.role === "partner" ? `${a.name} (${a.org.name})` : a.name);

export type CreateRideInput = {
  rider: { id: string } | { display_name: string; language: string };
  needs: Need[];
  pickup: { name: string; address: string };
  dropoff: { name: string; address: string; type: PlaceType };
  pickup_at: string;
  appointment_at: string | null;
  /** When set, a return leg is created from the destination back to pickup. */
  return_pickup_at: string | null;
  payment_type: PaymentType;
  funding_source_id: string | null;
  cost_cap_cents: number | null;
  driver_notes: string;
  contact_phone: string;
};

export async function createRide(b: Backend, actor: Actor, input: CreateRideInput, baseUrl: string) {
  if (actor.role === "partner") throw new RideError("Only Salvation Army staff can request rides.");
  if (input.payment_type === "paid" && !input.funding_source_id)
    throw new RideError("Choose which fund is paying for this ride.");
  if (input.return_pickup_at && input.return_pickup_at <= input.pickup_at)
    throw new RideError("The return pickup must be after the first pickup.");

  let riderId: string;
  if ("id" in input.rider) {
    const existing = await b.getRider(input.rider.id);
    if (!existing || existing.org_id !== actor.org_id) throw new RideError("That person wasn't found.");
    riderId = existing.id;
  } else {
    const created = await b.createRider({
      org_id: actor.org_id,
      display_name: input.rider.display_name,
      language: input.rider.language,
      needs: input.needs,
    });
    riderId = created.id;
  }

  const now = new Date().toISOString();
  const common = {
    org_id: actor.org_id,
    rider_id: riderId,
    needs: input.needs,
    payment_type: input.payment_type,
    funding_source_id: input.payment_type === "paid" ? input.funding_source_id : null,
    cost_cap_cents: input.payment_type === "paid" ? input.cost_cap_cents : null,
    driver_notes: input.driver_notes,
    contact_phone: input.contact_phone,
    consent_at: now,
    created_by: actor.id,
  };

  const outbound = await b.insertRide({
    ...common,
    leg: "outbound",
    parent_id: null,
    pickup_name: input.pickup.name,
    pickup_address: input.pickup.address,
    dropoff_name: input.dropoff.name,
    dropoff_address: input.dropoff.address,
    dropoff_type: input.dropoff.type,
    pickup_at: input.pickup_at,
    appointment_at: input.appointment_at,
  });
  const rides: Ride[] = [outbound];

  if (input.return_pickup_at) {
    rides.push(
      await b.insertRide({
        ...common,
        leg: "return",
        parent_id: outbound.id,
        pickup_name: input.dropoff.name,
        pickup_address: input.dropoff.address,
        dropoff_name: input.pickup.name,
        dropoff_address: input.pickup.address,
        dropoff_type: "other",
        pickup_at: input.return_pickup_at,
        appointment_at: null,
      }),
    );
  }

  for (const r of rides) {
    await b.addEvent({ ride_id: r.id, actor_kind: "staff", actor_name: actorLabel(actor), from_status: null, to_status: "requested", note: null });
  }
  await notifyMatchingPartners(b, actor.org.name, rides, baseUrl);
  return outbound;
}

async function notifyMatchingPartners(b: Backend, fromOrg: string, rides: Ride[], baseUrl: string) {
  const partners = await b.listPartnerOrgs();
  const first = rides[0];
  const trip = `${formatShort(first.pickup_at)}: ${first.pickup_name} → ${first.dropoff_name}${rides.length > 1 ? " (+ return trip)" : ""}`;
  for (const p of partners.filter((p) => partnerCanServe(p, first))) {
    const body = `New ${first.payment_type} ride request from ${fromOrg}.\n${trip}\n\nOpen CareRide to accept: ${baseUrl}/partner`;
    await sendEmail(b, p.contact_email, `New ride request: ${formatShort(first.pickup_at)}`, body);
    await sendSms(b, p.contact_phone, `CareRide: new ride request ${trip}. ${baseUrl}/partner`);
  }
}

async function loadRide(b: Backend, rideId: string): Promise<RideView> {
  const ride = await b.getRide(rideId);
  if (!ride) throw new RideError("That ride wasn't found.");
  return ride;
}

async function tellRequestingOrg(b: Backend, ride: Pick<Ride, "org_id" | "pickup_at" | "dropoff_name" | "id">, what: string, baseUrl: string) {
  const org = await b.getOrg(ride.org_id);
  if (!org) return;
  await sendEmail(
    b,
    org.contact_email,
    `CareRide: ${what}`,
    `${what}\nRide: ${formatShort(ride.pickup_at)} to ${ride.dropoff_name}\n${baseUrl}/app/rides/${ride.id}`,
  );
}

// ── Staff ───────────────────────────────────────────────────────────────────

export async function staffSetStatus(b: Backend, actor: Actor, rideId: string, to: RideStatus, note: string | null) {
  if (actor.role === "partner") throw new RideError("Only staff can do that.");
  const ride = await loadRide(b, rideId);
  if (ride.org_id !== actor.org_id) throw new RideError("That ride belongs to another organization.");
  if (!canTransition(ride.status, to, "staff")) throw new RideError(`Can't change a ride from "${STATUS_LABELS[ride.status]}" to "${STATUS_LABELS[to]}".`);
  if (!(await b.updateRide(rideId, ride.status, { status: to }))) throw new RideError("Someone else just updated this ride. Refresh and try again.");
  await b.addEvent({ ride_id: rideId, actor_kind: "staff", actor_name: actorLabel(actor), from_status: ride.status, to_status: to, note });

  if (to === "cancelled" && ride.partner_org_id) {
    const partner = await b.getOrg(ride.partner_org_id);
    const msg = `Ride cancelled by ${actor.org.name}: ${formatShort(ride.pickup_at)}, ${ride.pickup_name} → ${ride.dropoff_name}.`;
    await sendEmail(b, partner?.contact_email ?? null, "CareRide: ride cancelled", `${msg}\n${note ?? ""}`);
    await sendSms(b, ride.driver_phone, `CareRide: ${msg} You don't need to go.`);
  }
}

// ── Partners ────────────────────────────────────────────────────────────────

function requirePartner(actor: Actor) {
  if (actor.role !== "partner") throw new RideError("Only partner organizations can do that.");
}

export async function partnerAccept(b: Backend, actor: Actor, rideId: string, baseUrl: string) {
  requirePartner(actor);
  if (!(await b.acceptRide(rideId, actor.org_id, actorLabel(actor))))
    throw new RideError("This ride was already taken by another partner, or it no longer matches what you can provide.");
  const ride = await loadRide(b, rideId);
  await tellRequestingOrg(b, ride, `${actor.org.name} accepted a ride`, baseUrl);
}

export async function partnerDecline(b: Backend, actor: Actor, rideId: string, reason: string) {
  requirePartner(actor);
  await b.declineRide(rideId, actor.org_id, reason);
}

export async function partnerRelease(b: Backend, actor: Actor, rideId: string, reason: string, baseUrl: string) {
  requirePartner(actor);
  const ride = await loadRide(b, rideId);
  if (ride.partner_org_id !== actor.org_id) throw new RideError("Your organization doesn't hold this ride.");
  if (!canTransition(ride.status, "requested", "partner")) throw new RideError("This ride can't be handed back now.");
  if (!(await b.releaseRide(rideId, actor.org_id, actorLabel(actor), reason)))
    throw new RideError("Someone else just updated this ride. Refresh and try again.");
  if (ride.driver_phone) await sendSms(b, ride.driver_phone, `CareRide: you're no longer driving the ${formatShort(ride.pickup_at)} ride. You don't need to go. Thank you!`);
  await tellRequestingOrg(b, ride, `${actor.org.name} can no longer do a ride; it's open again`, baseUrl);
}

function newDriverToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function assignDriver(
  b: Backend,
  actor: Actor,
  rideId: string,
  driver: { name: string; phone: string },
  baseUrl: string,
) {
  requirePartner(actor);
  const ride = await loadRide(b, rideId);
  if (ride.partner_org_id !== actor.org_id) throw new RideError("Your organization doesn't hold this ride.");
  // Reassigning to a different driver is allowed until pickup.
  if (ride.status !== "accepted" && ride.status !== "driver_assigned") throw new RideError("A driver can't be assigned at this stage.");

  const token = newDriverToken();
  const expires = new Date(new Date(ride.pickup_at).getTime() + 12 * 3600e3).toISOString();
  const ok = await b.updateRide(rideId, ride.status, {
    status: "driver_assigned",
    driver_name: driver.name,
    driver_phone: driver.phone,
    driver_token: token,
    driver_token_expires_at: expires,
  });
  if (!ok) throw new RideError("Someone else just updated this ride. Refresh and try again.");
  await b.addEvent({
    ride_id: rideId,
    actor_kind: "partner",
    actor_name: actorLabel(actor),
    from_status: ride.status,
    to_status: "driver_assigned",
    note: ride.status === "driver_assigned" ? `Driver changed to ${driver.name}` : `Driver: ${driver.name}`,
  });

  if (ride.status === "driver_assigned" && ride.driver_phone && ride.driver_phone !== driver.phone) {
    await sendSms(b, ride.driver_phone, `CareRide: you're no longer driving the ${formatShort(ride.pickup_at)} ride. Thank you!`);
  }
  await sendSms(
    b,
    driver.phone,
    `CareRide ride for ${actor.org.name}: pick up ${formatShort(ride.pickup_at)} at ${ride.pickup_name}. Details and updates: ${baseUrl}/d/${token}`,
  );
  return token;
}

/** A partner dispatcher updating a ride on behalf of their driver. */
export async function partnerSetStatus(b: Backend, actor: Actor, rideId: string, to: RideStatus, baseUrl: string) {
  requirePartner(actor);
  const ride = await loadRide(b, rideId);
  if (ride.partner_org_id !== actor.org_id) throw new RideError("Your organization doesn't hold this ride.");
  if (!canTransition(ride.status, to, "partner")) throw new RideError("That update isn't possible right now.");
  if (!(await b.updateRide(rideId, ride.status, { status: to }))) throw new RideError("Someone else just updated this ride. Refresh and try again.");
  await b.addEvent({ ride_id: rideId, actor_kind: "partner", actor_name: actorLabel(actor), from_status: ride.status, to_status: to, note: null });
  if (to === "dropped_off" || to === "no_show") await tellRequestingOrg(b, ride, STATUS_LABELS[to], baseUrl);
}

// ── Drivers ─────────────────────────────────────────────────────────────────

export async function driverUpdate(b: Backend, token: string, to: RideStatus) {
  const result = await b.driverSetStatus(token, to);
  if (!result.ok) throw new RideError(result.error);
  const { ride, notify_email } = result;
  if (to === "dropped_off" || to === "no_show") {
    const what = to === "no_show" ? `Driver ${ride.driver_name} couldn't find ${ride.rider_display_name}` : `${ride.rider_display_name} was dropped off`;
    await sendEmail(b, notify_email, `CareRide: ${what}`, `${what} (${formatShort(ride.pickup_at)}, ${ride.pickup_name} → ${ride.dropoff_name}).`);
  }
  return ride;
}
