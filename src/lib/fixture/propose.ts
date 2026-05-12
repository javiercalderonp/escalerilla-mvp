export type ProposalPlayer = {
  id: string;
  fullName: string;
  points: number;
  maxMatches: number;
  matchmakingScore: number;
};

export type ProposedPair = {
  player1: ProposalPlayer;
  player2: ProposalPlayer;
};

export type ProposalPlayerRankingInput = Omit<
  ProposalPlayer,
  "matchmakingScore"
>;

export type ConfirmedMatchRecord = {
  player1Id: string;
  player2Id: string;
  winnerId: string | null;
};

export function buildMatchmakingPlayers(
  players: ProposalPlayerRankingInput[],
  confirmedMatches: ConfirmedMatchRecord[],
): ProposalPlayer[] {
  if (players.length === 0) return [];

  const playerIds = new Set(players.map((player) => player.id));
  const wins = new Map<string, number>();
  const losses = new Map<string, number>();
  const points = players.map((player) => player.points);
  const minPoints = Math.min(...points);
  const maxPoints = Math.max(...points);
  const pointsRange = maxPoints - minPoints;

  for (const match of confirmedMatches) {
    if (!match.winnerId || !playerIds.has(match.winnerId)) continue;

    const loserId =
      match.winnerId === match.player1Id ? match.player2Id : match.player1Id;

    if (!playerIds.has(loserId)) continue;

    wins.set(match.winnerId, (wins.get(match.winnerId) ?? 0) + 1);
    losses.set(loserId, (losses.get(loserId) ?? 0) + 1);
  }

  return players.map((player) => {
    const playerWins = wins.get(player.id) ?? 0;
    const playerLosses = losses.get(player.id) ?? 0;
    const matchesPlayed = playerWins + playerLosses;
    const adjustedWinRate = (playerWins + 1) / (matchesPlayed + 2);
    const confidence = Math.min(matchesPlayed / 8, 1);
    const performanceScore =
      adjustedWinRate * confidence + 0.5 * (1 - confidence);
    const rankingScoreNormalized =
      pointsRange === 0 ? 0.5 : (player.points - minPoints) / pointsRange;

    // Internal-only score for balanced fixture proposals. The public ranking
    // remains based on accumulated points and is not replaced by this value.
    const matchmakingScore =
      0.65 * rankingScoreNormalized + 0.35 * performanceScore;

    return {
      ...player,
      matchmakingScore,
    };
  });
}

/**
 * Greedy pairing algorithm sorted by internal matchmakingScore (highest first).
 * matchmakingScore does not replace the public ranking; it only makes draw pairings more balanced.
 * Respects maxMatches per player, blocks pairs that played within 30 days (caller's responsibility
 * to populate recentOpponents), and never proposes the same pair twice.
 */
export function proposeFixture(
  players: ProposalPlayer[],
  recentOpponents: Map<string, Set<string>>,
): ProposedPair[] {
  const sorted = [...players].sort(
    (a, b) =>
      b.matchmakingScore - a.matchmakingScore ||
      b.points - a.points ||
      a.fullName.localeCompare(b.fullName),
  );
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

      const candidates = sorted.filter(
        (p2) =>
          p2.id !== p1.id &&
          (remaining.get(p2.id) ?? 0) > 0 &&
          !blocked.has(p2.id) &&
          !alreadyPairedIds.has(p2.id),
      );
      const partner = candidates.reduce<ProposalPlayer | null>(
        (best, candidate) => {
          if (!best) return candidate;

          const bestDelta = Math.abs(
            p1.matchmakingScore - best.matchmakingScore,
          );
          const candidateDelta = Math.abs(
            p1.matchmakingScore - candidate.matchmakingScore,
          );

          return candidateDelta < bestDelta ? candidate : best;
        },
        null,
      );

      if (!partner) continue;

      pairs.push({ player1: p1, player2: partner });
      remaining.set(p1.id, (remaining.get(p1.id) ?? 0) - 1);
      remaining.set(partner.id, (remaining.get(partner.id) ?? 0) - 1);

      let p1PairedIds = pairedWith.get(p1.id);
      if (!p1PairedIds) {
        p1PairedIds = new Set();
        pairedWith.set(p1.id, p1PairedIds);
      }

      let partnerPairedIds = pairedWith.get(partner.id);
      if (!partnerPairedIds) {
        partnerPairedIds = new Set();
        pairedWith.set(partner.id, partnerPairedIds);
      }

      p1PairedIds.add(partner.id);
      partnerPairedIds.add(p1.id);

      madeProgress = true;
    }
  }

  return pairs;
}
