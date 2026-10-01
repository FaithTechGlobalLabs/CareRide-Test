// Pure ride rules: who may move a ride between statuses, which partners can
// take it, and when it needs a person's attention. No I/O, so it's shared by
// both backends and unit-tested directly.

import type {
  ActorKind,
  Need,
  Organization,
  PaymentType,
  Ride,
  RideStatus,
} from "./types";

type Transition = { to: RideStatus; by: ActorKind[] };

const TRANSITIONS: Record<RideStatus, Transition[]> = {
  requested: [
    { to: "accepted", by: ["partner"] },
    { to: "cancelled", by: ["staff"] },
  ],
  accepted: [
    { to: "driver_assigned", by: ["partner"] },
    // Partner hands it back to the open pool.
    { to: "requested", by: ["partner"] },
    { to: "cancelled", by: ["staff"] },
  ],
  driver_assigned: [
    { to: "picked_up", by: ["driver", "partner"] },
    { to: "no_show", by: ["driver", "partner", "staff"] },
    { to: "requested", by: ["partner"] },
    { to: "cancelled", by: ["staff"] },
  ],
  picked_up: [{ to: "dropped_off", by: ["driver", "partner"] }],
  // Staff confirm the person actually got where they needed to be.
  dropped_off: [{ to: "completed", by: ["staff"] }],
  completed: [],
  cancelled: [],
  no_show: [],
};

export function canTransition(from: RideStatus, to: RideStatus, by: ActorKind): boolean {
  if (by === "system") return TRANSITIONS[from].some((t) => t.to === to);
  return TRANSITIONS[from].some((t) => t.to === to && t.by.includes(by));
}

export function nextStatuses(from: RideStatus, by: ActorKind): RideStatus[] {
  return TRANSITIONS[from].filter((t) => t.by.includes(by)).map((t) => t.to);
}

export const ACTIVE_STATUSES: RideStatus[] = [
  "requested",
  "accepted",
  "driver_assigned",
  "picked_up",
  "dropped_off",
];

export function isActive(status: RideStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

export const STATUS_LABELS: Record<RideStatus, string> = {
  requested: "Waiting for a partner",
  accepted: "Partner accepted",
  driver_assigned: "Driver assigned",
  picked_up: "Picked up",
  dropped_off: "Dropped off",
  completed: "Arrived safely",
  cancelled: "Cancelled",
  no_show: "Missed pickup",
};

export type StatusTone = "waiting" | "progress" | "done" | "stopped";

export const STATUS_TONE: Record<RideStatus, StatusTone> = {
  requested: "waiting",
  accepted: "progress",
  driver_assigned: "progress",
  picked_up: "progress",
  dropped_off: "progress",
  completed: "done",
  cancelled: "stopped",
  no_show: "stopped",
};

/** Can this partner serve this ride? Every need must be a capability, and payment type must be offered. */
export function partnerCanServe(
  partner: Pick<Organization, "type" | "capabilities" | "offers_free" | "offers_paid">,
  ride: { needs: Need[]; payment_type: PaymentType },
): boolean {
  if (partner.type !== "partner") return false;
  if (ride.payment_type === "free" && !partner.offers_free) return false;
  if (ride.payment_type === "paid" && !partner.offers_paid) return false;
  // Walker, extra time and service animals are things any driver can accommodate.
  const universal: Need[] = ["walker", "extra_time", "service_animal"];
  return ride.needs.every((n) => universal.includes(n) || partner.capabilities.includes(n));
}

export type Attention = { level: "urgent" | "warning"; reason: string };

const HOUR = 60 * 60 * 1000;

/**
 * Why a ride needs a staff member to look at it right now, or null.
 * Thresholds are deliberately simple; tune them with Belkin staff.
 */
export function needsAttention(
  ride: Pick<Ride, "status" | "pickup_at" | "appointment_at" | "updated_at">,
  now: Date = new Date(),
): Attention | null {
  const t = now.getTime();
  const pickup = new Date(ride.pickup_at).getTime();
  const arriveBy = ride.appointment_at ? new Date(ride.appointment_at).getTime() : pickup + HOUR;

  switch (ride.status) {
    case "requested":
      if (pickup < t) return { level: "urgent", reason: "Pickup time passed with no partner" };
      if (pickup - t <= 4 * HOUR) return { level: "urgent", reason: "No partner yet, pickup within 4 hours" };
      if (pickup - t <= 24 * HOUR) return { level: "warning", reason: "No partner yet, pickup within 24 hours" };
      return null;
    case "accepted":
      if (pickup - t <= 2 * HOUR) return { level: "urgent", reason: "No driver assigned, pickup within 2 hours" };
      return null;
    case "driver_assigned":
      if (t - pickup >= 30 * 60 * 1000) return { level: "urgent", reason: "Not marked picked up 30 min after pickup time" };
      return null;
    case "picked_up":
      if (t - arriveBy >= 30 * 60 * 1000) return { level: "urgent", reason: "Not marked dropped off 30 min after appointment" };
      return null;
    case "dropped_off":
      if (t - new Date(ride.updated_at).getTime() >= 2 * HOUR)
        return { level: "warning", reason: "Dropped off; confirm they arrived safely" };
      return null;
    default:
      return null;
  }
}
