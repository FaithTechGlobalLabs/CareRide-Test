import type {
  DriverRide,
  FundingSource,
  Message,
  OpenRide,
  Organization,
  Place,
  Profile,
  Ride,
  RideEvent,
  RideStatus,
  RideView,
  Rider,
} from "../types";

export type NewRide = Omit<
  Ride,
  | "id"
  | "status"
  | "partner_org_id"
  | "driver_name"
  | "driver_phone"
  | "driver_token"
  | "driver_token_expires_at"
  | "created_at"
  | "updated_at"
>;

export type RidePatch = Partial<
  Pick<Ride, "status" | "driver_name" | "driver_phone" | "driver_token" | "driver_token_expires_at">
>;

/**
 * Storage for CareRide. Two implementations:
 * - demo: in-memory, seeded, no setup (lib/backend/demo.ts)
 * - supabase: Postgres + Row Level Security (lib/backend/supabase.ts)
 *
 * Callers go through lib/rides.ts, which applies the rules in lib/rules.ts.
 * In Supabase mode, RLS and the SQL functions enforce the same rules again.
 */
export interface Backend {
  mode: "demo" | "supabase";

  getProfile(id: string): Promise<Profile | null>;
  getOrg(id: string): Promise<Organization | null>;
  listPartnerOrgs(): Promise<Organization[]>;
  listPlaces(orgId: string): Promise<Place[]>;
  listFundingSources(orgId: string): Promise<FundingSource[]>;
  listRiders(orgId: string): Promise<Rider[]>;
  getRider(id: string): Promise<Rider | null>;
  createRider(input: Omit<Rider, "id" | "created_at">): Promise<Rider>;

  insertRide(input: NewRide): Promise<Ride>;
  getRide(id: string): Promise<RideView | null>;
  listOrgRides(orgId: string): Promise<RideView[]>;
  listPartnerRides(partnerOrgId: string): Promise<RideView[]>;
  /** Requests a partner could take: still open, matching capabilities, not declined by them. */
  listOpenRides(partnerOrgId: string): Promise<OpenRide[]>;
  /** Update only if the ride is still in `expected` status. Returns false if it moved on. */
  updateRide(id: string, expected: RideStatus, patch: RidePatch): Promise<boolean>;
  /** Atomically claim an open request for a partner and record the event. */
  acceptRide(id: string, partnerOrgId: string, actorName: string): Promise<boolean>;
  declineRide(id: string, partnerOrgId: string, reason: string): Promise<void>;
  /** Partner hands a ride back to the open pool: clears driver, records the event, hides it from them. */
  releaseRide(id: string, partnerOrgId: string, actorName: string, reason: string): Promise<boolean>;

  addEvent(e: Omit<RideEvent, "id" | "created_at">): Promise<void>;
  listEvents(rideId: string): Promise<RideEvent[]>;

  getDriverRide(token: string): Promise<DriverRide | null>;
  /**
   * Driver status change through their link; validates the token and transition.
   * notify_email is the requesting site's front-desk address, for the server to email; never shown to the driver.
   */
  driverSetStatus(
    token: string,
    to: RideStatus,
  ): Promise<{ ok: true; ride: DriverRide; notify_email: string | null } | { ok: false; error: string }>;

  logMessage(m: Omit<Message, "id" | "created_at">): Promise<void>;
  listMessages(): Promise<Message[]>;
}
