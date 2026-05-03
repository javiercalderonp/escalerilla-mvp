import { describe, expect, it } from "vitest";

import { type ProposalPlayer, proposeFixture } from "../propose";

function player(
  id: string,
  points: number,
  maxMatches: number,
): ProposalPlayer {
  return {
    id,
    fullName: id,
    points,
    maxMatches,
  };
}

function usageByPlayer(pairs: ReturnType<typeof proposeFixture>) {
  const usage = new Map<string, number>();

  for (const pair of pairs) {
    usage.set(pair.player1.id, (usage.get(pair.player1.id) ?? 0) + 1);
    usage.set(pair.player2.id, (usage.get(pair.player2.id) ?? 0) + 1);
  }

  return usage;
}

describe("proposeFixture", () => {
  it("uses an extra player slot when the available player count is odd", () => {
    const pairs = proposeFixture(
      [player("A", 300, 2), player("B", 200, 1), player("C", 100, 1)],
      new Map(),
    );

    expect(pairs).toHaveLength(2);
    expect(usageByPlayer(pairs).get("A")).toBe(2);
    expect(usageByPlayer(pairs).get("B")).toBe(1);
    expect(usageByPlayer(pairs).get("C")).toBe(1);
  });

  it("respects multiple players who asked to play more than once", () => {
    const pairs = proposeFixture(
      [
        player("A", 400, 2),
        player("B", 300, 2),
        player("C", 200, 1),
        player("D", 100, 1),
      ],
      new Map(),
    );

    expect(pairs).toHaveLength(3);
    expect(usageByPlayer(pairs)).toEqual(
      new Map([
        ["A", 2],
        ["B", 2],
        ["C", 1],
        ["D", 1],
      ]),
    );
  });

  it("never proposes the same pair twice while filling extra slots", () => {
    const pairs = proposeFixture(
      [player("A", 300, 3), player("B", 200, 2), player("C", 100, 1)],
      new Map(),
    );

    const pairKeys = pairs.map((pair) =>
      [pair.player1.id, pair.player2.id].sort().join(":"),
    );

    expect(pairKeys).toHaveLength(new Set(pairKeys).size);
  });
});
