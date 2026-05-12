import { describe, expect, it } from "vitest";

import {
  buildMatchmakingPlayers,
  type ProposalPlayer,
  proposeFixture,
} from "../propose";

function player(
  id: string,
  points: number,
  maxMatches: number,
  matchmakingScore = points,
): ProposalPlayer {
  return {
    id,
    fullName: id,
    points,
    maxMatches,
    matchmakingScore,
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

  it("chooses the valid partner with the closest matchmaking score", () => {
    const pairs = proposeFixture(
      [
        player("A", 950, 2, 0.95),
        player("B", 940, 1, 0.94),
        player("C", 800, 1, 0.8),
        player("D", 790, 1, 0.79),
      ],
      new Map(),
    );

    const pairKeys = pairs.map((pair) =>
      [pair.player1.id, pair.player2.id].sort().join(":"),
    );

    expect(pairKeys).toEqual(["A:B", "C:D"]);
  });
});

describe("buildMatchmakingPlayers", () => {
  it("keeps public points intact while adding an internal matchmaking score", () => {
    const [top, bottom] = buildMatchmakingPlayers(
      [
        { id: "A", fullName: "A", points: 300, maxMatches: 1 },
        { id: "B", fullName: "B", points: 100, maxMatches: 1 },
      ],
      [
        { player1Id: "A", player2Id: "B", winnerId: "B" },
        { player1Id: "A", player2Id: "B", winnerId: "B" },
      ],
    );

    expect(top.points).toBe(300);
    expect(bottom.points).toBe(100);
    expect(top.matchmakingScore).toBeGreaterThan(0);
    expect(bottom.matchmakingScore).toBeGreaterThan(0);
    expect(top.matchmakingScore).not.toBe(top.points);
  });
});
