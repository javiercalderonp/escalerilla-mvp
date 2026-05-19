import { describe, expect, it } from "vitest";

import { getClosestMondayInSantiago } from "../date";

describe("getClosestMondayInSantiago", () => {
  it("uses the previous Monday on Tuesday", () => {
    expect(getClosestMondayInSantiago(new Date("2026-05-19T12:00:00Z"))).toBe(
      "2026-05-18",
    );
  });

  it("uses the next Monday on Saturday", () => {
    expect(getClosestMondayInSantiago(new Date("2026-05-23T12:00:00Z"))).toBe(
      "2026-05-25",
    );
  });

  it("keeps Monday as-is", () => {
    expect(getClosestMondayInSantiago(new Date("2026-05-18T12:00:00Z"))).toBe(
      "2026-05-18",
    );
  });

  it("chooses the nearest Monday around the middle of the week", () => {
    expect(getClosestMondayInSantiago(new Date("2026-05-21T12:00:00Z"))).toBe(
      "2026-05-18",
    );
    expect(getClosestMondayInSantiago(new Date("2026-05-22T12:00:00Z"))).toBe(
      "2026-05-25",
    );
  });
});
