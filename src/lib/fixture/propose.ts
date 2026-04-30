export type ProposalPlayer = {
  id: string;
  fullName: string;
  points: number;
  maxMatches: number;
};

export type ProposedPair = {
  player1: ProposalPlayer;
  player2: ProposalPlayer;
};

/**
 * Greedy pairing algorithm sorted by ranking points (highest first).
 * Respects maxMatches per player, blocks pairs that played within 30 days (caller's responsibility
 * to populate recentOpponents), and never proposes the same pair twice.
 */
export function proposeFixture(
  players: ProposalPlayer[],
  recentOpponents: Map<string, Set<string>>,
): ProposedPair[] {
  const sorted = [...players].sort((a, b) => b.points - a.points);
  const remaining = new Map(sorted.map((p) => [p.id, p.maxMatches]));
  const pairedWith = new Map<string, Set<string>>();
  const pairs: ProposedPair[] = [];

  let madeProgress = true;
  while (madeProgress) {
    madeProgress = false;

    for (const p1 of sorted) {
      if ((remaining.get(p1.id) ?? 0) <= 0) continue;

      const blocked = recentOpponents.get(p1.id) ?? new Set<string>();
      const alreadyPairedIds = pairedWith.get(p1.id) ?? new Set<string>();

      const partner = sorted.find(
        (p2) =>
          p2.id !== p1.id &&
          (remaining.get(p2.id) ?? 0) > 0 &&
          !blocked.has(p2.id) &&
          !alreadyPairedIds.has(p2.id),
      );

      if (!partner) continue;

      pairs.push({ player1: p1, player2: partner });
      remaining.set(p1.id, (remaining.get(p1.id) ?? 0) - 1);
      remaining.set(partner.id, (remaining.get(partner.id) ?? 0) - 1);

      if (!pairedWith.has(p1.id)) pairedWith.set(p1.id, new Set());
      if (!pairedWith.has(partner.id)) pairedWith.set(partner.id, new Set());
      pairedWith.get(p1.id)?.add(partner.id);
      pairedWith.get(partner.id)?.add(p1.id);

      madeProgress = true;
    }
  }

  return pairs;
}
