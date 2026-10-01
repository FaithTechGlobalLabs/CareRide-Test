import { describe, expect, test } from "bun:test";
import { formatDay, isoToLocalInput, localInputToIso } from "@/lib/time";

describe("Vancouver time", () => {
  test("datetime-local input is read as Vancouver time", () => {
    expect(localInputToIso("2026-10-02T10:30")).toBe("2026-10-02T17:30:00.000Z"); // PDT, UTC-7
    expect(localInputToIso("2026-02-02T10:30")).toBe("2026-02-02T18:30:00.000Z"); // PST, UTC-8
  });

  test("round-trips", () => {
    for (const v of ["2026-10-02T10:30", "2026-11-01T09:00", "2027-03-14T12:15"]) {
      expect(isoToLocalInput(localInputToIso(v))).toBe(v);
    }
  });

  test("relative day names use Vancouver dates", () => {
    const now = new Date("2026-10-02T06:00:00Z"); // Oct 1, 11pm in Vancouver
    expect(formatDay("2026-10-02T05:30:00Z", now)).toBe("Today");
    expect(formatDay("2026-10-02T16:00:00Z", now)).toBe("Tomorrow");
  });

  test("rejects malformed input", () => {
    expect(() => localInputToIso("tomorrow")).toThrow();
  });
});
