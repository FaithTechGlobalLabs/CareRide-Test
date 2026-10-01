// Supabase backend. Every query runs as the signed-in person, so Row Level
// Security (supabase/migrations) decides what they can see and change.

import type { SupabaseClient } from "@supabase/supabase-js";
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
import type { Backend, NewRide, RidePatch } from "./types";

const RIDE_VIEW = `*,
  rider:riders(id, display_name, language),
  partner:organizations!ride_requests_partner_org_id_fkey(id, name, contact_phone),
  requesting_org:organizations!ride_requests_org_id_fkey(id, name)`;

function must<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

export class SupabaseBackend implements Backend {
  mode = "supabase" as const;
  constructor(private db: SupabaseClient) {}

  async getProfile(id: string) {
    return must(await this.db.from("profiles").select("*").eq("id", id).maybeSingle()) as Profile | null;
  }
  async getOrg(id: string) {
    return must(await this.db.from("organizations").select("*").eq("id", id).maybeSingle()) as Organization | null;
  }
  async listPartnerOrgs() {
    return must(await this.db.from("organizations").select("*").eq("type", "partner").order("name")) as Organization[];
  }
  async listPlaces(orgId: string) {
    return must(await this.db.from("places").select("*").eq("org_id", orgId).order("name")) as Place[];
  }
  async listFundingSources(orgId: string) {
    return must(await this.db.from("funding_sources").select("*").eq("org_id", orgId).order("name")) as FundingSource[];
  }
  async listRiders(orgId: string) {
    return must(await this.db.from("riders").select("*").eq("org_id", orgId).order("display_name")) as Rider[];
  }
  async getRider(id: string) {
    return must(await this.db.from("riders").select("*").eq("id", id).maybeSingle()) as Rider | null;
  }
  async createRider(input: Omit<Rider, "id" | "created_at">) {
    return must(await this.db.from("riders").insert(input).select().single()) as Rider;
  }

  async insertRide(input: NewRide) {
    return must(await this.db.from("ride_requests").insert(input).select().single()) as Ride;
  }
  async getRide(id: string) {
    return must(await this.db.from("ride_requests").select(RIDE_VIEW).eq("id", id).maybeSingle()) as RideView | null;
  }
  async listOrgRides(orgId: string) {
    return must(await this.db.from("ride_requests").select(RIDE_VIEW).eq("org_id", orgId).order("pickup_at")) as RideView[];
  }
  async listPartnerRides(partnerOrgId: string) {
    return must(
      await this.db.from("ride_requests").select(RIDE_VIEW).eq("partner_org_id", partnerOrgId).order("pickup_at"),
    ) as RideView[];
  }
  async listOpenRides() {
    return must(await this.db.rpc("open_rides_for_partner")) as OpenRide[];
  }
  async updateRide(id: string, expected: RideStatus, patch: RidePatch) {
    const { error, count } = await this.db
      .from("ride_requests")
      .update(patch, { count: "exact" })
      .eq("id", id)
      .eq("status", expected);
    if (error) throw new Error(error.message);
    return (count ?? 0) > 0;
  }
  async acceptRide(id: string, _partnerOrgId: string, actorName: string) {
    return must(await this.db.rpc("accept_ride", { p_ride: id, p_actor_name: actorName })) as boolean;
  }
  async declineRide(id: string, partnerOrgId: string, reason: string) {
    must(await this.db.from("partner_declines").upsert({ ride_id: id, partner_org_id: partnerOrgId, reason }));
  }
  async releaseRide(id: string, _partnerOrgId: string, actorName: string, reason: string) {
    return must(await this.db.rpc("release_ride", { p_ride: id, p_actor_name: actorName, p_reason: reason })) as boolean;
  }

  async addEvent(e: Omit<RideEvent, "id" | "created_at">) {
    must(await this.db.from("ride_events").insert(e));
  }
  async listEvents(rideId: string) {
    return must(await this.db.from("ride_events").select("*").eq("ride_id", rideId).order("created_at")) as RideEvent[];
  }

  async getDriverRide(token: string) {
    return must(await this.db.rpc("driver_ride", { p_token: token })) as DriverRide | null;
  }
  async driverSetStatus(token: string, to: RideStatus) {
    return must(await this.db.rpc("driver_set_status", { p_token: token, p_to: to })) as
      | { ok: true; ride: DriverRide; notify_email: string | null }
      | { ok: false; error: string };
  }

  // Outgoing messages aren't stored in Supabase mode; they go to Resend/Twilio and the server log.
  async logMessage(m: Omit<Message, "id" | "created_at">) {
    console.info(`[careride] ${m.channel} → ${m.to}${m.delivered ? "" : " (not sent: provider not configured)"}`);
  }
  async listMessages() {
    return [];
  }
}
