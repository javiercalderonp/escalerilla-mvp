import { describe, expect, it } from "vitest";

import {
  getStalePendingMatchCutoff,
  STALE_PENDING_MATCH_DAYS,
} from "../stale-pending";

describe("getStalePendingMatchCutoff", () => {
  it("returns the timestamp exactly three weeks before the execution time", () => {
    const now = new Date("2026-06-01T14:35:20.000Z");

    expect(STALE_PENDING_MATCH_DAYS).toBe(21);
    expect(getStalePendingMatchCutoff(now).toISOString()).toBe(
      "2026-05-11T14:35:20.000Z",
    );
  });
});
