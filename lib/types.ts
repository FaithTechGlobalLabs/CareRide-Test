// Domain types shared by the demo store and the Supabase backend.
// Column names mirror supabase/migrations so rows map 1:1.

export type OrgType = "salvation_army" | "partner";
export type Role = "staff" | "coordinator" | "partner";
export type PaymentType = "free" | "paid";
export type PlaceType = "hospital" | "shelter" | "clinic" | "court" | "office" | "other";
export type Leg = "outbound" | "return";

/** What a rider may need from a ride. Partners advertise matching capabilities. */
export const NEEDS = [
  "wheelchair",
  "walker",
  "service_animal",
  "escort",
  "extra_time",
] as const;
export type Need = (typeof NEEDS)[number];

export const NEED_LABELS: Record<Need, string> = {
  wheelchair: "Wheelchair accessible vehicle",
  walker: "Uses a walker or cane",
  service_animal: "Travelling with a service animal",
  escort: "Needs someone to walk them in",
  extra_time: "Needs extra time getting in/out",
};

export const RIDE_STATUSES = [
  "requested",
  "accepted",
  "driver_assigned",
  "picked_up",
  "dropped_off",
  "completed",
  "cancelled",
  "no_show",
] as const;
export type RideStatus = (typeof RIDE_STATUSES)[number];

export type Organization = {
  id: string;
  name: string;
  type: OrgType;
  service_area: string;
  /** Needs this partner can serve. Empty for Salvation Army sites. */
  capabilities: Need[];
  offers_free: boolean;
  offers_paid: boolean;
  contact_email: string | null;
  contact_phone: string | null;
};

export type Profile = {
  id: string;
  org_id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
};

export type Rider = {
  id: string;
  org_id: string;
  /** First name + last initial only, e.g. "Maria T." */
  display_name: string;
  language: string;
  needs: Need[];
  created_at: string;
};

export type Place = {
  id: string;
  org_id: string;
  name: string;
  address: string;
  type: PlaceType;
};

export type FundingSource = {
  id: string;
  org_id: string;
  name: string;
  monthly_budget_cents: number;
};

export type Ride = {
  id: string;
  org_id: string;
  rider_id: string;
  leg: Leg;
  /** For a return leg, the outbound ride it belongs to. */
  parent_id: string | null;
  pickup_name: string;
  pickup_address: string;
  dropoff_name: string;
  dropoff_address: string;
  dropoff_type: PlaceType;
  pickup_at: string;
  appointment_at: string | null;
  /** Snapshot of the rider's needs for this trip. */
  needs: Need[];
  payment_type: PaymentType;
  funding_source_id: string | null;
  cost_cap_cents: number | null;
  driver_notes: string;
  /** Number to call about this ride: staff/front desk, never the rider's. */
  contact_phone: string;
  status: RideStatus;
  partner_org_id: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  driver_token: string | null;
  driver_token_expires_at: string | null;
  consent_at: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type ActorKind = "staff" | "partner" | "driver" | "system";

export type RideEvent = {
  id: string;
  ride_id: string;
  actor_kind: ActorKind;
  actor_name: string;
  from_status: RideStatus | null;
  to_status: RideStatus;
  note: string | null;
  created_at: string;
};

/** Ride joined with what a staff or partner screen needs to render it. */
export type RideView = Ride & {
  rider: Pick<Rider, "id" | "display_name" | "language"> | null;
  partner: Pick<Organization, "id" | "name" | "contact_phone"> | null;
  requesting_org: Pick<Organization, "id" | "name">;
};

/** What a partner sees for a request they haven't accepted yet: no rider name or notes. */
export type OpenRide = Pick<
  Ride,
  | "id"
  | "leg"
  | "pickup_name"
  | "pickup_address"
  | "dropoff_name"
  | "dropoff_type"
  | "pickup_at"
  | "appointment_at"
  | "needs"
  | "payment_type"
  | "cost_cap_cents"
> & { requesting_org_name: string };

/** What a driver sees through their one-ride link. */
export type DriverRide = Pick<
  Ride,
  | "id"
  | "leg"
  | "pickup_name"
  | "pickup_address"
  | "dropoff_name"
  | "dropoff_address"
  | "pickup_at"
  | "appointment_at"
  | "needs"
  | "driver_notes"
  | "contact_phone"
  | "status"
  | "driver_name"
> & { rider_display_name: string; partner_name: string };

export type Message = {
  id: string;
  channel: "email" | "sms";
  to: string;
  subject: string | null;
  body: string;
  created_at: string;
  delivered: boolean;
};
