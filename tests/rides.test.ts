import { beforeEach, describe, expect, test } from "bun:test";
import { BELKIN, DemoBackend, seedState } from "@/lib/backend/demo";
import { assignDriver, createRide, driverUpdate, partnerAccept, partnerRelease, RideError, staffSetStatus, type Actor } from "@/lib/rides";

const BASE = "http://localhost:3000";
const dana: Actor = { id: "user_dana", name: "Dana", role: "staff", org_id: BELKIN, org: { name: "Belkin House (demo)" } };
const marcus: Actor = { id: "user_marcus", name: "Marcus", role: "partner", org_id: "org_carevan", org: { name: "Grace Church Care Van" } };
const priya: Actor = { id: "user_priya", name: "Priya", role: "partner", org_id: "org_hope", org: { name: "Hope Rides Volunteer Drivers" } };
const jordan: Actor = { id: "user_jordan", name: "Jordan", role: "partner", org_id: "org_cabs", org: { name: "Metro Accessible Cabs" } };

let b: DemoBackend;
beforeEach(() => {
  b = new DemoBackend(seedState());
});

const inHours = (h: number) => new Date(Date.now() + h * 3600e3).toISOString();

async function requestWheelchairRide(withReturn = false) {
  return createRide(
    b,
    dana,
    {
      rider: { display_name: "Lee W.", language: "English" },
      needs: ["wheelchair"],
      pickup: { name: "Belkin House front desk", address: "555 Homer St" },
      dropoff: { name: "VGH", address: "920 W 10th Ave", type: "hospital" },
      pickup_at: inHours(30),
      appointment_at: inHours(30.5),
      return_pickup_at: withReturn ? inHours(33) : null,
      payment_type: "free",
      funding_source_id: null,
      cost_cap_cents: null,
      driver_notes: "",
      contact_phone: "604-555-0100",
    },
    BASE,
  );
}

describe("ride lifecycle", () => {
  test("request → accept → assign driver → picked up → dropped off → arrived", async () => {
    const ride = await requestWheelchairRide();

    // Only the wheelchair-capable free partner sees it.
    expect((await b.listOpenRides("org_carevan")).map((r) => r.id)).toContain(ride.id);
    expect((await b.listOpenRides("org_hope")).map((r) => r.id)).not.toContain(ride.id);
    expect((await b.listOpenRides("org_cabs")).map((r) => r.id)).not.toContain(ride.id);

    await partnerAccept(b, marcus, ride.id, BASE);
    expect((await b.listOpenRides("org_carevan")).map((r) => r.id)).not.toContain(ride.id);

    const token = await assignDriver(b, marcus, ride.id, { name: "Sam", phone: "604-555-0177" }, BASE);
    expect((await b.getDriverRide(token))?.rider_display_name).toBe("Lee W.");

    await driverUpdate(b, token, "picked_up");
    await driverUpdate(b, token, "dropped_off");
    await staffSetStatus(b, dana, ride.id, "completed", null);

    const done = await b.getRide(ride.id);
    expect(done?.status).toBe("completed");
    expect((await b.listEvents(ride.id)).map((e) => e.to_status)).toEqual([
      "requested",
      "accepted",
      "driver_assigned",
      "picked_up",
      "dropped_off",
      "completed",
    ]);
  });

  test("open requests don't reveal who the rider is", async () => {
    const ride = await requestWheelchairRide();
    const open = (await b.listOpenRides("org_carevan")).find((r) => r.id === ride.id)!;
    expect(JSON.stringify(open)).not.toContain("Lee W.");
    expect(open).not.toHaveProperty("driver_notes");
  });

  test("a return trip is its own ride going the other way", async () => {
    const ride = await requestWheelchairRide(true);
    const rides = await b.listOrgRides(BELKIN);
    const ret = rides.find((r) => r.parent_id === ride.id)!;
    expect(ret.leg).toBe("return");
    expect(ret.pickup_name).toBe("VGH");
    expect(ret.dropoff_name).toBe("Belkin House front desk");
  });

  test("partners are notified, without the rider's name", async () => {
    await requestWheelchairRide();
    const msgs = await b.listMessages();
    expect(msgs.some((m) => m.to === "carevan@gracechurch.example")).toBe(true);
    expect(msgs.some((m) => m.to === "dispatch@hoperides.example")).toBe(false);
    expect(msgs.every((m) => !m.body.includes("Lee W."))).toBe(true);
  });
});

describe("guards", () => {
  test("a partner can't accept a ride they can't serve", async () => {
    const ride = await requestWheelchairRide();
    expect(partnerAccept(b, priya, ride.id, BASE)).rejects.toThrow(RideError);
    expect(partnerAccept(b, jordan, ride.id, BASE)).rejects.toThrow(RideError);
  });

  test("two partners can't both take the same ride", async () => {
    const ride = await requestWheelchairRide();
    await b.acceptRide(ride.id, "org_carevan", "Marcus");
    expect(await b.acceptRide(ride.id, "org_carevan", "Marcus")).toBe(false);
  });

  test("drivers can't skip pickup", async () => {
    const ride = await requestWheelchairRide();
    await partnerAccept(b, marcus, ride.id, BASE);
    const token = await assignDriver(b, marcus, ride.id, { name: "Sam", phone: "604-555-0177" }, BASE);
    expect(driverUpdate(b, token, "dropped_off")).rejects.toThrow(RideError);
  });

  test("released rides go back to the pool and the old driver link stops working", async () => {
    const ride = await requestWheelchairRide();
    await partnerAccept(b, marcus, ride.id, BASE);
    const token = await assignDriver(b, marcus, ride.id, { name: "Sam", phone: "604-555-0177" }, BASE);
    await partnerRelease(b, marcus, ride.id, "Van broke down", BASE);
    expect((await b.getRide(ride.id))?.status).toBe("requested");
    expect(await b.getDriverRide(token)).toBeNull();
  });

  test("partners can't request rides and staff can't accept them", async () => {
    const ride = await requestWheelchairRide();
    expect(partnerAccept(b, dana, ride.id, BASE)).rejects.toThrow(RideError);
    expect(staffSetStatus(b, marcus, ride.id, "cancelled", null)).rejects.toThrow(RideError);
  });

  test("paid rides need a funding source", async () => {
    expect(
      createRide(
        b,
        dana,
        {
          rider: { id: "rider_ana" },
          needs: [],
          pickup: { name: "A", address: "a" },
          dropoff: { name: "B", address: "b", type: "clinic" },
          pickup_at: inHours(5),
          appointment_at: null,
          return_pickup_at: null,
          payment_type: "paid",
          funding_source_id: null,
          cost_cap_cents: 3000,
          driver_notes: "",
          contact_phone: "604-555-0100",
        },
        BASE,
      ),
    ).rejects.toThrow(/fund/);
  });
});

describe("driver updates", () => {
  test("staff are emailed when a driver drops someone off or can't find them", async () => {
    const ride = await requestWheelchairRide();
    await partnerAccept(b, marcus, ride.id, BASE);
    const token = await assignDriver(b, marcus, ride.id, { name: "Sam", phone: "604-555-0177" }, BASE);
    await driverUpdate(b, token, "no_show");
    const [latest] = await b.listMessages();
    expect(latest.to).toBe("frontdesk@belkin.example");
    expect(latest.subject).toContain("couldn't find Lee W.");
  });
});
