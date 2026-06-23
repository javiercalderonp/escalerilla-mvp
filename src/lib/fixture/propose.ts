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
 * Pairing algorithm sorted by internal matchmakingScore (highest first).
 * matchmakingScore does not replace the public ranking; it only makes draw pairings more balanced.
 * Respects maxMatches per player, blocks hard-forbidden pairs supplied by the
 * caller, avoids soft-forbidden pairs when possible, and never proposes the
 * same pair twice.
 *
 * The first pass maximizes player coverage, even when that requires using an
 * extra slot from a player who asked for multiple matches. A greedy-only
 * approach can leave two players unmatched after spending their only valid
 * alternatives elsewhere.
 */
export function proposeFixture(
  players: ProposalPlayer[],
  blockedOpponents: Map<string, Set<string>>,
  avoidedOpponents = new Map<string, Set<string>>(),
): ProposedPair[] {
  const sorted = [...players].sort(
    (a, b) =>
      b.matchmakingScore - a.matchmakingScore ||
      b.points - a.points ||
      a.fullName.localeCompare(b.fullName),
  );
  const remaining = new Map(
    sorted.map((p) => [p.id, Math.max(0, p.maxMatches)]),
  );
  const pairedWith = new Map<string, Set<string>>();
  const pairs: ProposedPair[] = proposeCoveragePairs(
    sorted,
    blockedOpponents,
    avoidedOpponents,
  );

  for (const pair of pairs) {
    remaining.set(pair.player1.id, (remaining.get(pair.player1.id) ?? 0) - 1);
    remaining.set(pair.player2.id, (remaining.get(pair.player2.id) ?? 0) - 1);
    markPaired(pairedWith, pair.player1.id, pair.player2.id);
  }

  let madeProgress = true;
  while (madeProgress) {
    madeProgress = false;

    for (const p1 of sorted) {
      if ((remaining.get(p1.id) ?? 0) <= 0) continue;

      const alreadyPairedIds = pairedWith.get(p1.id) ?? new Set<string>();

      const candidates = sorted.filter(
        (p2) =>
          p2.id !== p1.id &&
          (remaining.get(p2.id) ?? 0) > 0 &&
          canPair(p1.id, p2.id, blockedOpponents, pairedWith) &&
          !alreadyPairedIds.has(p2.id),
      );
      const partner = candidates.reduce<ProposalPlayer | null>(
        (best, candidate) => {
          if (!best) return candidate;

          const bestIsAvoided = isAvoidedOpponent(
            p1.id,
            best.id,
            avoidedOpponents,
          );
          const candidateIsAvoided = isAvoidedOpponent(
            p1.id,
            candidate.id,
            avoidedOpponents,
          );
          if (bestIsAvoided !== candidateIsAvoided) {
            return candidateIsAvoided ? best : candidate;
          }

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
      markPaired(pairedWith, p1.id, partner.id);

      madeProgress = true;
    }
  }

  return pairs;
}

function proposeCoveragePairs(
  players: ProposalPlayer[],
  blockedOpponents: Map<string, Set<string>>,
  avoidedOpponents: Map<string, Set<string>>,
): ProposedPair[] {
  const eligiblePlayers = players.filter((player) => player.maxMatches > 0);
  if (eligiblePlayers.length < 2) return [];

  const remaining = new Map(
    eligiblePlayers.map((player) => [player.id, player.maxMatches]),
  );
  const covered = new Set<string>();
  const skipped = new Set<string>();
  const pairedWith = new Map<string, Set<string>>();
  const currentPairs: ProposedPair[] = [];
  const maxPossiblePairs = Math.floor(
    eligiblePlayers.reduce((total, player) => total + player.maxMatches, 0) / 2,
  );

  let bestPairs: ProposedPair[] = [];
  let bestCoveredCount = 0;
  let bestTotalPairs = 0;
  let bestScore = Number.NEGATIVE_INFINITY;

  function pairScore(p1: ProposalPlayer, p2: ProposalPlayer) {
    const avoidedPenalty = isAvoidedOpponent(p1.id, p2.id, avoidedOpponents)
      ? 10
      : 0;

    return (
      -avoidedPenalty - Math.abs(p1.matchmakingScore - p2.matchmakingScore)
    );
  }

  function rememberBest() {
    const coveredCount = covered.size;
    const totalPairs = currentPairs.length + countGreedyExtraPairs();
    const score = currentPairs.reduce(
      (total, pair) => total + pairScore(pair.player1, pair.player2),
      0,
    );

    if (
      coveredCount > bestCoveredCount ||
      (coveredCount === bestCoveredCount && totalPairs > bestTotalPairs) ||
      (coveredCount === bestCoveredCount &&
        totalPairs === bestTotalPairs &&
        currentPairs.length > bestPairs.length) ||
      (coveredCount === bestCoveredCount &&
        totalPairs === bestTotalPairs &&
        currentPairs.length === bestPairs.length &&
        score > bestScore)
    ) {
      bestCoveredCount = coveredCount;
      bestTotalPairs = totalPairs;
      bestScore = score;
      bestPairs = [...currentPairs];
    }
  }

  function countGreedyExtraPairs() {
    const remainingClone = new Map(remaining);
    const pairedWithClone = new Map(
      [...pairedWith.entries()].map(([playerId, playerIds]) => [
        playerId,
        new Set(playerIds),
      ]),
    );
    let extraPairs = 0;
    let madeProgress = true;

    while (madeProgress) {
      madeProgress = false;

      for (const player of eligiblePlayers) {
        if ((remainingClone.get(player.id) ?? 0) <= 0) continue;

        const partner = eligiblePlayers.find(
          (candidate) =>
            candidate.id !== player.id &&
            (remainingClone.get(candidate.id) ?? 0) > 0 &&
            canPair(player.id, candidate.id, blockedOpponents, pairedWithClone),
        );

        if (!partner) continue;

        remainingClone.set(player.id, (remainingClone.get(player.id) ?? 0) - 1);
        remainingClone.set(
          partner.id,
          (remainingClone.get(partner.id) ?? 0) - 1,
        );
        markPaired(pairedWithClone, player.id, partner.id);
        extraPairs += 1;
        madeProgress = true;
      }
    }

    return extraPairs;
  }

  function candidatesFor(player: ProposalPlayer) {
    return eligiblePlayers
      .filter(
        (candidate) =>
          candidate.id !== player.id &&
          (remaining.get(candidate.id) ?? 0) > 0 &&
          canPair(player.id, candidate.id, blockedOpponents, pairedWith),
      )
      .sort((a, b) => {
        const coverageDelta =
          Number(covered.has(a.id)) - Number(covered.has(b.id));
        if (coverageDelta !== 0) return coverageDelta;

        const avoidedDelta =
          Number(isAvoidedOpponent(player.id, a.id, avoidedOpponents)) -
          Number(isAvoidedOpponent(player.id, b.id, avoidedOpponents));
        if (avoidedDelta !== 0) return avoidedDelta;

        return (
          Math.abs(player.matchmakingScore - a.matchmakingScore) -
            Math.abs(player.matchmakingScore - b.matchmakingScore) ||
          b.points - a.points ||
          a.fullName.localeCompare(b.fullName)
        );
      });
  }

  function selectNextPlayer() {
    let selected: ProposalPlayer | null = null;
    let selectedCandidateCount = Number.POSITIVE_INFINITY;

    for (const player of eligiblePlayers) {
      if (covered.has(player.id) || skipped.has(player.id)) continue;
      if ((remaining.get(player.id) ?? 0) <= 0) continue;

      const candidateCount = candidatesFor(player).length;
      if (
        candidateCount < selectedCandidateCount ||
        (candidateCount === selectedCandidateCount &&
          selected &&
          player.matchmakingScore > selected.matchmakingScore)
      ) {
        selected = player;
        selectedCandidateCount = candidateCount;
      }
    }

    return selected;
  }

  function search() {
    rememberBest();

    if (
      bestCoveredCount === eligiblePlayers.length &&
      bestTotalPairs >= maxPossiblePairs
    ) {
      return;
    }

    const possibleCoveredCount =
      covered.size + eligiblePlayers.length - covered.size - skipped.size;
    if (possibleCoveredCount < bestCoveredCount) return;

    const player = selectNextPlayer();
    if (!player) return;

    for (const partner of candidatesFor(player)) {
      remaining.set(player.id, (remaining.get(player.id) ?? 0) - 1);
      remaining.set(partner.id, (remaining.get(partner.id) ?? 0) - 1);
      markPaired(pairedWith, player.id, partner.id);
      currentPairs.push({ player1: player, player2: partner });

      const playerWasCovered = covered.has(player.id);
      const partnerWasCovered = covered.has(partner.id);
      covered.add(player.id);
      covered.add(partner.id);

      search();

      if (!playerWasCovered) covered.delete(player.id);
      if (!partnerWasCovered) covered.delete(partner.id);
      currentPairs.pop();
      unmarkPaired(pairedWith, player.id, partner.id);
      remaining.set(player.id, (remaining.get(player.id) ?? 0) + 1);
      remaining.set(partner.id, (remaining.get(partner.id) ?? 0) + 1);

      if (
        bestCoveredCount === eligiblePlayers.length &&
        bestTotalPairs >= maxPossiblePairs
      ) {
        return;
      }
    }

    skipped.add(player.id);
    search();
    skipped.delete(player.id);
  }

  search();

  return bestPairs;
}

function canPair(
  player1Id: string,
  player2Id: string,
  blockedOpponents: Map<string, Set<string>>,
  pairedWith: Map<string, Set<string>>,
) {
  const blockedByPlayer1 = blockedOpponents.get(player1Id) ?? new Set<string>();
  const blockedByPlayer2 = blockedOpponents.get(player2Id) ?? new Set<string>();
  const alreadyPairedIds = pairedWith.get(player1Id) ?? new Set<string>();

  return (
    !blockedByPlayer1.has(player2Id) &&
    !blockedByPlayer2.has(player1Id) &&
    !alreadyPairedIds.has(player2Id)
  );
}

function isAvoidedOpponent(
  player1Id: string,
  player2Id: string,
  avoidedOpponents: Map<string, Set<string>>,
) {
  return (
    (avoidedOpponents.get(player1Id) ?? new Set<string>()).has(player2Id) ||
    (avoidedOpponents.get(player2Id) ?? new Set<string>()).has(player1Id)
  );
}

function markPaired(
  pairedWith: Map<string, Set<string>>,
  player1Id: string,
  player2Id: string,
) {
  let p1PairedIds = pairedWith.get(player1Id);
  if (!p1PairedIds) {
    p1PairedIds = new Set();
    pairedWith.set(player1Id, p1PairedIds);
  }

  let p2PairedIds = pairedWith.get(player2Id);
  if (!p2PairedIds) {
    p2PairedIds = new Set();
    pairedWith.set(player2Id, p2PairedIds);
  }

  p1PairedIds.add(player2Id);
  p2PairedIds.add(player1Id);
}

function unmarkPaired(
  pairedWith: Map<string, Set<string>>,
  player1Id: string,
  player2Id: string,
) {
  pairedWith.get(player1Id)?.delete(player2Id);
  pairedWith.get(player2Id)?.delete(player1Id);
}
