// In-memory backend for demos and local development. State lives in the
// server process and resets on restart. Everyone and everything here is fictional.

import { canTransition, partnerCanServe } from "../rules";
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

type State = {
  orgs: Organization[];
  profiles: Profile[];
  places: Place[];
  funding: FundingSource[];
  riders: Rider[];
  rides: Ride[];
  events: RideEvent[];
  declines: { ride_id: string; partner_org_id: string; reason: string }[];
  messages: Message[];
};

let seq = 0;
const id = (prefix: string) => `${prefix}_${Date.now().toString(36)}${(seq++).toString(36)}`;

export const BELKIN = "org_belkin";
export const DEMO_PROFILES = {
  staff: "user_dana",
  coordinator: "user_alex",
  hopeRides: "user_priya",
  careVan: "user_marcus",
  cabs: "user_jordan",
} as const;

export function seedState(now: Date = new Date()): State {
  // Round to the quarter hour so demo times look like real bookings.
  const quarter = 15 * 60e3;
  const anchor = Math.round(now.getTime() / quarter) * quarter;
  const at = (hours: number) => new Date(anchor + Math.round((hours * 3600e3) / quarter) * quarter).toISOString();
  const ago = (hours: number) => at(-hours);

  const orgs: Organization[] = [
    {
      id: BELKIN,
      name: "Belkin House (demo)",
      type: "salvation_army",
      service_area: "Downtown Vancouver",
      capabilities: [],
      offers_free: false,
      offers_paid: false,
      contact_email: "frontdesk@belkin.example",
      contact_phone: "604-555-0100",
    },
    {
      id: "org_hope",
      name: "Hope Rides Volunteer Drivers",
      type: "partner",
      service_area: "Vancouver & Burnaby",
      capabilities: ["escort"],
      offers_free: true,
      offers_paid: false,
      contact_email: "dispatch@hoperides.example",
      contact_phone: "604-555-0141",
    },
    {
      id: "org_carevan",
      name: "Grace Church Care Van",
      type: "partner",
      service_area: "Downtown Vancouver",
      capabilities: ["wheelchair", "escort"],
      offers_free: true,
      offers_paid: false,
      contact_email: "carevan@gracechurch.example",
      contact_phone: "604-555-0162",
    },
    {
      id: "org_cabs",
      name: "Metro Accessible Cabs",
      type: "partner",
      service_area: "Metro Vancouver",
      capabilities: ["wheelchair"],
      offers_free: false,
      offers_paid: true,
      contact_email: "accounts@metrocabs.example",
      contact_phone: "604-555-0188",
    },
  ];

  const profiles: Profile[] = [
    { id: DEMO_PROFILES.staff, org_id: BELKIN, name: "Dana", email: "dana@belkin.example", phone: null, role: "staff" },
    { id: DEMO_PROFILES.coordinator, org_id: BELKIN, name: "Alex", email: "alex@belkin.example", phone: null, role: "coordinator" },
    { id: DEMO_PROFILES.hopeRides, org_id: "org_hope", name: "Priya", email: "priya@hoperides.example", phone: null, role: "partner" },
    { id: DEMO_PROFILES.careVan, org_id: "org_carevan", name: "Marcus", email: "marcus@gracechurch.example", phone: null, role: "partner" },
    { id: DEMO_PROFILES.cabs, org_id: "org_cabs", name: "Jordan", email: "jordan@metrocabs.example", phone: null, role: "partner" },
  ];

  const places: Place[] = [
    { id: "pl_belkin", org_id: BELKIN, name: "Belkin House front desk", address: "555 Homer St, Vancouver", type: "office" },
    { id: "pl_vgh", org_id: BELKIN, name: "Vancouver General Hospital", address: "920 W 10th Ave, Vancouver", type: "hospital" },
    { id: "pl_stp", org_id: BELKIN, name: "St. Paul's Hospital", address: "1081 Burrard St, Vancouver", type: "hospital" },
    { id: "pl_court", org_id: BELKIN, name: "Downtown Community Court", address: "211 Gore Ave, Vancouver", type: "court" },
    { id: "pl_ugm", org_id: BELKIN, name: "Union Gospel Mission (shelter intake)", address: "601 E Hastings St, Vancouver", type: "shelter" },
    { id: "pl_clinic", org_id: BELKIN, name: "Downtown dental clinic (demo)", address: "100 W Pender St, Vancouver", type: "clinic" },
  ];

  const funding: FundingSource[] = [
    { id: "fund_belkin", org_id: BELKIN, name: "Belkin transportation fund", monthly_budget_cents: 150000 },
    { id: "fund_health", org_id: BELKIN, name: "Health outreach grant", monthly_budget_cents: 80000 },
  ];

  const riders: Rider[] = [
    { id: "rider_maria", org_id: BELKIN, display_name: "Maria T.", language: "English", needs: ["wheelchair"], created_at: ago(400) },
    { id: "rider_joe", org_id: BELKIN, display_name: "Joe K.", language: "English", needs: ["escort", "walker"], created_at: ago(300) },
    { id: "rider_ana", org_id: BELKIN, display_name: "Ana R.", language: "Spanish", needs: [], created_at: ago(200) },
    { id: "rider_tom", org_id: BELKIN, display_name: "Tom B.", language: "English", needs: [], created_at: ago(100) },
  ];

  const fromBelkin = { pickup_name: "Belkin House front desk", pickup_address: "555 Homer St, Vancouver" };
  const base = {
    org_id: BELKIN,
    leg: "outbound" as const,
    parent_id: null,
    funding_source_id: null,
    cost_cap_cents: null,
    payment_type: "free" as const,
    driver_notes: "",
    contact_phone: "604-555-0100",
    partner_org_id: null,
    driver_name: null,
    driver_phone: null,
    driver_token: null,
    driver_token_expires_at: null,
    created_by: DEMO_PROFILES.staff,
  };

  const rides: Ride[] = [
    {
      ...base,
      ...fromBelkin,
      id: "ride_tom_court",
      rider_id: "rider_tom",
      dropoff_name: "Downtown Community Court",
      dropoff_address: "211 Gore Ave, Vancouver",
      dropoff_type: "court",
      pickup_at: at(3),
      appointment_at: at(3.5),
      needs: [],
      driver_notes: "Court date. Must not be late. Tom will wait inside the front door.",
      status: "requested",
      consent_at: ago(20),
      created_at: ago(20),
      updated_at: ago(20),
    },
    {
      ...base,
      ...fromBelkin,
      id: "ride_maria_vgh",
      rider_id: "rider_maria",
      dropoff_name: "Vancouver General Hospital",
      dropoff_address: "920 W 10th Ave, Vancouver",
      dropoff_type: "hospital",
      pickup_at: at(1),
      appointment_at: at(1.75),
      needs: ["wheelchair"],
      driver_notes: "Jim Pattison Pavilion entrance. Maria uses a manual wheelchair.",
      status: "driver_assigned",
      partner_org_id: "org_carevan",
      driver_name: "Sam",
      driver_phone: "604-555-0177",
      driver_token: "demo-driver-sam",
      driver_token_expires_at: at(14),
      consent_at: ago(30),
      created_at: ago(30),
      updated_at: ago(5),
    },
    {
      ...base,
      id: "ride_maria_vgh_return",
      rider_id: "rider_maria",
      leg: "return",
      parent_id: "ride_maria_vgh",
      pickup_name: "Vancouver General Hospital",
      pickup_address: "920 W 10th Ave, Vancouver",
      dropoff_name: "Belkin House front desk",
      dropoff_address: "555 Homer St, Vancouver",
      dropoff_type: "office",
      pickup_at: at(4),
      appointment_at: null,
      needs: ["wheelchair"],
      driver_notes: "Pick up at the same entrance. Maria will be waiting with hospital staff.",
      status: "requested",
      consent_at: ago(30),
      created_at: ago(30),
      updated_at: ago(30),
    },
    {
      ...base,
      ...fromBelkin,
      id: "ride_joe_stp",
      rider_id: "rider_joe",
      dropoff_name: "St. Paul's Hospital",
      dropoff_address: "1081 Burrard St, Vancouver",
      dropoff_type: "hospital",
      pickup_at: ago(1.25),
      appointment_at: ago(0.6),
      needs: ["escort", "walker"],
      driver_notes: "Please walk Joe to the clinic desk on level 2.",
      status: "picked_up",
      partner_org_id: "org_hope",
      driver_name: "Ruth",
      driver_phone: "604-555-0155",
      driver_token: "demo-driver-ruth",
      driver_token_expires_at: at(10),
      consent_at: ago(48),
      created_at: ago(48),
      updated_at: ago(1.2),
    },
    {
      ...base,
      ...fromBelkin,
      id: "ride_tom_ugm",
      rider_id: "rider_tom",
      dropoff_name: "Union Gospel Mission (shelter intake)",
      dropoff_address: "601 E Hastings St, Vancouver",
      dropoff_type: "shelter",
      pickup_at: ago(4),
      appointment_at: ago(3.5),
      needs: [],
      status: "dropped_off",
      partner_org_id: "org_hope",
      driver_name: "Ruth",
      driver_phone: "604-555-0155",
      consent_at: ago(6),
      created_at: ago(6),
      updated_at: ago(3.4),
    },
    {
      ...base,
      ...fromBelkin,
      id: "ride_ana_clinic",
      rider_id: "rider_ana",
      dropoff_name: "Downtown dental clinic (demo)",
      dropoff_address: "100 W Pender St, Vancouver",
      dropoff_type: "clinic",
      pickup_at: at(22),
      appointment_at: at(22.5),
      needs: [],
      driver_notes: "Ana speaks Spanish; a few words of English.",
      status: "requested",
      consent_at: ago(2),
      created_at: ago(2),
      updated_at: ago(2),
    },
    {
      ...base,
      ...fromBelkin,
      id: "ride_maria_stp_paid",
      rider_id: "rider_maria",
      dropoff_name: "St. Paul's Hospital",
      dropoff_address: "1081 Burrard St, Vancouver",
      dropoff_type: "hospital",
      pickup_at: at(28),
      appointment_at: at(28.5),
      needs: ["wheelchair"],
      payment_type: "paid",
      funding_source_id: "fund_health",
      cost_cap_cents: 4500,
      status: "accepted",
      partner_org_id: "org_cabs",
      consent_at: ago(10),
      created_at: ago(10),
      updated_at: ago(8),
    },
    {
      ...base,
      ...fromBelkin,
      id: "ride_joe_done",
      rider_id: "rider_joe",
      dropoff_name: "Vancouver General Hospital",
      dropoff_address: "920 W 10th Ave, Vancouver",
      dropoff_type: "hospital",
      pickup_at: ago(26),
      appointment_at: ago(25.5),
      needs: ["escort", "walker"],
      status: "completed",
      partner_org_id: "org_hope",
      driver_name: "Ruth",
      driver_phone: "604-555-0155",
      consent_at: ago(50),
      created_at: ago(50),
      updated_at: ago(24),
    },
  ];

  const events: RideEvent[] = [];
  const ev = (ride_id: string, steps: [RideStatus, string, number][]) => {
    let from: RideStatus | null = null;
    for (const [to, actor, hoursAgo] of steps) {
      const kind = actor.startsWith("Driver") ? "driver" : actor.includes("(") ? "partner" : "staff";
      events.push({ id: id("ev"), ride_id, actor_kind: kind, actor_name: actor, from_status: from, to_status: to, note: null, created_at: ago(hoursAgo) });
      from = to;
    }
  };
  ev("ride_tom_court", [["requested", "Dana", 20]]);
  ev("ride_maria_vgh", [["requested", "Dana", 30], ["accepted", "Marcus (Grace Church Care Van)", 26], ["driver_assigned", "Marcus (Grace Church Care Van)", 5]]);
  ev("ride_maria_vgh_return", [["requested", "Dana", 30]]);
  ev("ride_joe_stp", [["requested", "Dana", 48], ["accepted", "Priya (Hope Rides Volunteer Drivers)", 40], ["driver_assigned", "Priya (Hope Rides Volunteer Drivers)", 30], ["picked_up", "Driver Ruth", 1.2]]);
  ev("ride_tom_ugm", [["requested", "Dana", 6], ["accepted", "Priya (Hope Rides Volunteer Drivers)", 5.5], ["driver_assigned", "Priya (Hope Rides Volunteer Drivers)", 5], ["picked_up", "Driver Ruth", 4], ["dropped_off", "Driver Ruth", 3.4]]);
  ev("ride_ana_clinic", [["requested", "Dana", 2]]);
  ev("ride_maria_stp_paid", [["requested", "Alex", 10], ["accepted", "Jordan (Metro Accessible Cabs)", 8]]);
  ev("ride_joe_done", [["requested", "Dana", 50], ["accepted", "Priya (Hope Rides Volunteer Drivers)", 45], ["driver_assigned", "Priya (Hope Rides Volunteer Drivers)", 30], ["picked_up", "Driver Ruth", 26], ["dropped_off", "Driver Ruth", 25.4], ["completed", "Dana", 24]]);

  return { orgs, profiles, places, funding, riders, rides, events, declines: [], messages: [] };
}

export class DemoBackend implements Backend {
  mode = "demo" as const;
  constructor(private s: State = seedState()) {}

  private view(r: Ride): RideView {
    const rider = this.s.riders.find((x) => x.id === r.rider_id);
    const partner = r.partner_org_id ? this.s.orgs.find((o) => o.id === r.partner_org_id) : null;
    const org = this.s.orgs.find((o) => o.id === r.org_id)!;
    return {
      ...r,
      rider: rider ? { id: rider.id, display_name: rider.display_name, language: rider.language } : null,
      partner: partner ? { id: partner.id, name: partner.name, contact_phone: partner.contact_phone } : null,
      requesting_org: { id: org.id, name: org.name },
    };
  }

  private driverView(r: Ride): DriverRide {
    const v = this.view(r);
    return {
      id: r.id,
      leg: r.leg,
      pickup_name: r.pickup_name,
      pickup_address: r.pickup_address,
      dropoff_name: r.dropoff_name,
      dropoff_address: r.dropoff_address,
      pickup_at: r.pickup_at,
      appointment_at: r.appointment_at,
      needs: r.needs,
      driver_notes: r.driver_notes,
      contact_phone: r.contact_phone,
      status: r.status,
      driver_name: r.driver_name,
      rider_display_name: v.rider?.display_name ?? "Rider",
      partner_name: v.partner?.name ?? "",
    };
  }

  private byPickup = (a: Ride, b: Ride) => a.pickup_at.localeCompare(b.pickup_at);

  async getProfile(pid: string) {
    return this.s.profiles.find((p) => p.id === pid) ?? null;
  }
  async listProfiles() {
    return this.s.profiles;
  }
  async getOrg(oid: string) {
    return this.s.orgs.find((o) => o.id === oid) ?? null;
  }
  async listPartnerOrgs() {
    return this.s.orgs.filter((o) => o.type === "partner");
  }
  async listPlaces(orgId: string) {
    return this.s.places.filter((p) => p.org_id === orgId);
  }
  async listFundingSources(orgId: string) {
    return this.s.funding.filter((f) => f.org_id === orgId);
  }
  async listRiders(orgId: string) {
    return this.s.riders.filter((r) => r.org_id === orgId).sort((a, b) => a.display_name.localeCompare(b.display_name));
  }
  async getRider(rid: string) {
    return this.s.riders.find((r) => r.id === rid) ?? null;
  }
  async createRider(input: Omit<Rider, "id" | "created_at">) {
    const rider: Rider = { ...input, id: id("rider"), created_at: new Date().toISOString() };
    this.s.riders.push(rider);
    return rider;
  }

  async insertRide(input: NewRide) {
    const now = new Date().toISOString();
    const ride: Ride = {
      ...input,
      id: id("ride"),
      status: "requested",
      partner_org_id: null,
      driver_name: null,
      driver_phone: null,
      driver_token: null,
      driver_token_expires_at: null,
      created_at: now,
      updated_at: now,
    };
    this.s.rides.push(ride);
    return ride;
  }
  async getRide(rid: string) {
    const r = this.s.rides.find((x) => x.id === rid);
    return r ? this.view(r) : null;
  }
  async listOrgRides(orgId: string) {
    return this.s.rides.filter((r) => r.org_id === orgId).sort(this.byPickup).map((r) => this.view(r));
  }
  async listPartnerRides(partnerOrgId: string) {
    return this.s.rides.filter((r) => r.partner_org_id === partnerOrgId).sort(this.byPickup).map((r) => this.view(r));
  }
  async listOpenRides(partnerOrgId: string) {
    const partner = await this.getOrg(partnerOrgId);
    if (!partner) return [];
    const declined = new Set(this.s.declines.filter((d) => d.partner_org_id === partnerOrgId).map((d) => d.ride_id));
    return this.s.rides
      .filter((r) => r.status === "requested" && !declined.has(r.id) && partnerCanServe(partner, r))
      .sort(this.byPickup)
      .map(
        (r): OpenRide => ({
          id: r.id,
          leg: r.leg,
          pickup_name: r.pickup_name,
          pickup_address: r.pickup_address,
          dropoff_name: r.dropoff_name,
          dropoff_type: r.dropoff_type,
          pickup_at: r.pickup_at,
          appointment_at: r.appointment_at,
          needs: r.needs,
          payment_type: r.payment_type,
          cost_cap_cents: r.cost_cap_cents,
          requesting_org_name: this.s.orgs.find((o) => o.id === r.org_id)!.name,
        }),
      );
  }
  async updateRide(rid: string, expected: RideStatus, patch: RidePatch) {
    const r = this.s.rides.find((x) => x.id === rid);
    if (!r || r.status !== expected) return false;
    Object.assign(r, patch, { updated_at: new Date().toISOString() });
    return true;
  }
  async acceptRide(rid: string, partnerOrgId: string, actorName: string) {
    const r = this.s.rides.find((x) => x.id === rid);
    const partner = await this.getOrg(partnerOrgId);
    if (!r || !partner || r.status !== "requested" || !partnerCanServe(partner, r)) return false;
    Object.assign(r, { status: "accepted", partner_org_id: partnerOrgId, updated_at: new Date().toISOString() });
    await this.addEvent({ ride_id: rid, actor_kind: "partner", actor_name: actorName, from_status: "requested", to_status: "accepted", note: null });
    return true;
  }
  async declineRide(rid: string, partnerOrgId: string, reason: string) {
    this.s.declines.push({ ride_id: rid, partner_org_id: partnerOrgId, reason });
  }
  async releaseRide(rid: string, partnerOrgId: string, actorName: string, reason: string) {
    const r = this.s.rides.find((x) => x.id === rid);
    if (!r || r.partner_org_id !== partnerOrgId || !canTransition(r.status, "requested", "partner")) return false;
    const from = r.status;
    Object.assign(r, {
      status: "requested",
      partner_org_id: null,
      driver_name: null,
      driver_phone: null,
      driver_token: null,
      driver_token_expires_at: null,
      updated_at: new Date().toISOString(),
    });
    await this.addEvent({ ride_id: rid, actor_kind: "partner", actor_name: actorName, from_status: from, to_status: "requested", note: reason || "Handed back to the open pool" });
    await this.declineRide(rid, partnerOrgId, reason);
    return true;
  }

  async addEvent(e: Omit<RideEvent, "id" | "created_at">) {
    this.s.events.push({ ...e, id: id("ev"), created_at: new Date().toISOString() });
  }
  async listEvents(rid: string) {
    return this.s.events.filter((e) => e.ride_id === rid).sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  private byToken(token: string) {
    const r = this.s.rides.find((x) => x.driver_token === token);
    if (!r || !r.driver_token_expires_at || new Date(r.driver_token_expires_at) < new Date()) return null;
    return r;
  }
  async getDriverRide(token: string) {
    const r = this.byToken(token);
    return r ? this.driverView(r) : null;
  }
  async driverSetStatus(token: string, to: RideStatus) {
    const r = this.byToken(token);
    if (!r) return { ok: false as const, error: "This ride link has expired or is no longer active." };
    if (!canTransition(r.status, to, "driver")) return { ok: false as const, error: "That update isn't possible for this ride right now." };
    const from = r.status;
    Object.assign(r, { status: to, updated_at: new Date().toISOString() });
    await this.addEvent({ ride_id: r.id, actor_kind: "driver", actor_name: `Driver ${r.driver_name ?? ""}`.trim(), from_status: from, to_status: to, note: null });
    const org = this.s.orgs.find((o) => o.id === r.org_id);
    return { ok: true as const, ride: this.driverView(r), notify_email: org?.contact_email ?? null };
  }

  async logMessage(m: Omit<Message, "id" | "created_at">) {
    this.s.messages.unshift({ ...m, id: id("msg"), created_at: new Date().toISOString() });
  }
  async listMessages() {
    return this.s.messages;
  }
}

// One store per server process, surviving hot reloads in dev.
const g = globalThis as unknown as { __careride_demo?: DemoBackend };
export function demoBackend(): DemoBackend {
  return (g.__careride_demo ??= new DemoBackend());
}
export function resetDemo(): void {
  g.__careride_demo = new DemoBackend();
}
