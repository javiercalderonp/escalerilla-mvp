import { describe, expect, it } from "vitest";

import { checkChallengeEligibility } from "../challenge";

describe("checkChallengeEligibility (RN-06 + RN-03)", () => {
  it("permite desafío dentro de 5 posiciones sin historial reciente", () => {
    expect(checkChallengeEligibility(6, 1, null)).toEqual([]);
    expect(checkChallengeEligibility(1, 6, null)).toEqual([]);
    expect(checkChallengeEligibility(3, 3, null)).toEqual([]);
  });

  it("permite desafío con exactamente 5 posiciones de diferencia", () => {
    expect(checkChallengeEligibility(6, 1, null)).toEqual([]);
  });

  it("viola RN-06 cuando la diferencia supera 5", () => {
    const result = checkChallengeEligibility(8, 1, null);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ code: "RN-06", rankDiff: 7 });
  });

  it("viola RN-03 cuando jugaron hace menos de 30 días", () => {
    const result = checkChallengeEligibility(2, 1, 15);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ code: "RN-03" });
  });

  it("permite desafío cuando el último partido fue hace exactamente 30 días", () => {
    expect(checkChallengeEligibility(2, 1, 30)).toEqual([]);
  });

  it("permite desafío cuando el último partido fue hace más de 30 días", () => {
    expect(checkChallengeEligibility(2, 1, 45)).toEqual([]);
  });

  it("acumula ambas violaciones cuando aplican", () => {
    const result = checkChallengeEligibility(10, 1, 5);
    expect(result).toHaveLength(2);
    expect(result.map((v) => v.code)).toContain("RN-06");
    expect(result.map((v) => v.code)).toContain("RN-03");
  });

  it("no viola RN-03 cuando nunca jugaron (null)", () => {
    const result = checkChallengeEligibility(10, 1, null);
    expect(result.map((v) => v.code)).not.toContain("RN-03");
  });
});
