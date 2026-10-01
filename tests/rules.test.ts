import { describe, expect, test } from "bun:test";
import { canTransition, needsAttention, nextStatuses, partnerCanServe } from "@/lib/rules";

describe("canTransition", () => {
  test("partners accept, drivers move the ride, staff confirm arrival", () => {
    expect(canTransition("requested", "accepted", "partner")).toBe(true);
    expect(canTransition("driver_assigned", "picked_up", "driver")).toBe(true);
    expect(canTransition("picked_up", "dropped_off", "driver")).toBe(true);
    expect(canTransition("dropped_off", "completed", "staff")).toBe(true);
  });

  test("blocks skipping steps and the wrong actor", () => {
    expect(canTransition("requested", "picked_up", "driver")).toBe(false);
    expect(canTransition("requested", "accepted", "staff")).toBe(false);
    expect(canTransition("dropped_off", "completed", "driver")).toBe(false);
    expect(canTransition("picked_up", "cancelled", "staff")).toBe(false);
  });

  test("finished rides are final", () => {
    for (const s of ["completed", "cancelled", "no_show"] as const) {
      expect(nextStatuses(s, "staff")).toEqual([]);
      expect(nextStatuses(s, "partner")).toEqual([]);
    }
  });
});

describe("partnerCanServe", () => {
  const vanFree = { type: "partner" as const, capabilities: ["wheelchair" as const], offers_free: true, offers_paid: false };

  test("needs must be covered and payment type offered", () => {
    expect(partnerCanServe(vanFree, { needs: ["wheelchair"], payment_type: "free" })).toBe(true);
    expect(partnerCanServe(vanFree, { needs: ["escort"], payment_type: "free" })).toBe(false);
    expect(partnerCanServe(vanFree, { needs: [], payment_type: "paid" })).toBe(false);
  });

  test("walker, extra time and service animals don't need special vehicles", () => {
    expect(partnerCanServe(vanFree, { needs: ["walker", "extra_time", "service_animal"], payment_type: "free" })).toBe(true);
  });

  test("Salvation Army sites are never partners", () => {
    expect(partnerCanServe({ ...vanFree, type: "salvation_army" }, { needs: [], payment_type: "free" })).toBe(false);
  });
});

describe("needsAttention", () => {
  const now = new Date("2026-10-02T17:00:00Z");
  const at = (h: number) => new Date(now.getTime() + h * 3600e3).toISOString();
  const ride = (status: Parameters<typeof needsAttention>[0]["status"], pickupH: number, apptH: number | null = null, updatedH = -1) => ({
    status,
    pickup_at: at(pickupH),
    appointment_at: apptH == null ? null : at(apptH),
    updated_at: at(updatedH),
  });

  test("open requests escalate as pickup approaches", () => {
    expect(needsAttention(ride("requested", 48), now)).toBeNull();
    expect(needsAttention(ride("requested", 20), now)?.level).toBe("warning");
    expect(needsAttention(ride("requested", 3), now)?.level).toBe("urgent");
    expect(needsAttention(ride("requested", -1), now)?.reason).toMatch(/passed/);
  });

  test("accepted without a driver close to pickup", () => {
    expect(needsAttention(ride("accepted", 5), now)).toBeNull();
    expect(needsAttention(ride("accepted", 1), now)?.level).toBe("urgent");
  });

  test("picked up but not dropped off long after the appointment", () => {
    expect(needsAttention(ride("picked_up", -1, -0.25), now)).toBeNull();
    expect(needsAttention(ride("picked_up", -1.5, -0.75), now)?.level).toBe("urgent");
  });

  test("dropped off rides ask staff to confirm arrival", () => {
    expect(needsAttention(ride("dropped_off", -4, -3, -0.5), now)).toBeNull();
    expect(needsAttention(ride("dropped_off", -4, -3, -3), now)?.level).toBe("warning");
  });

  test("finished rides never need attention", () => {
    expect(needsAttention(ride("completed", -48), now)).toBeNull();
    expect(needsAttention(ride("cancelled", -1), now)).toBeNull();
  });
});
