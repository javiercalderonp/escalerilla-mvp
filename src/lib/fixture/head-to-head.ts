import { and, desc, inArray, or, sql } from "drizzle-orm";

import type { db } from "@/lib/db";
import { matches, matchSets } from "@/lib/db/schema";

type DbClient = NonNullable<typeof db>;

type CompletedMatchStatus = "confirmado" | "empate" | "wo";

export type PairHistorySummary = {
  player1Id: string;
  player2Id: string;
  winsByPlayer: Record<string, number>;
  draws: number;
  totalMatches: number;
  lastMatch: {
    playedOn: string | null;
    status: CompletedMatchStatus;
    winnerId: string | null;
    score: string | null;
  } | null;
};

export type PairHistoryForPlayers = {
  p1Wins: number;
  p2Wins: number;
  draws: number;
  totalMatches: number;
  lastPlayedOn: string | null;
  lastStatus: CompletedMatchStatus | null;
  lastWinnerId: string | null;
  lastScore: string | null;
};

export function getPairKey(player1Id: string, player2Id: string) {
  return [player1Id, player2Id].sort().join(":");
}

export function getPairHistoryForPlayers(
  historiesByPair: Record<string, PairHistorySummary>,
  player1Id: string,
  player2Id: string,
): PairHistoryForPlayers {
  const history = historiesByPair[getPairKey(player1Id, player2Id)];

  return {
    p1Wins: history?.winsByPlayer[player1Id] ?? 0,
    p2Wins: history?.winsByPlayer[player2Id] ?? 0,
    draws: history?.draws ?? 0,
    totalMatches: history?.totalMatches ?? 0,
    lastPlayedOn: history?.lastMatch?.playedOn ?? null,
    lastStatus: history?.lastMatch?.status ?? null,
    lastWinnerId: history?.lastMatch?.winnerId ?? null,
    lastScore: history?.lastMatch?.score ?? null,
  };
}

function formatSetScore(set: {
  gamesP1: number;
  gamesP2: number;
  tiebreakP1: number | null;
  tiebreakP2: number | null;
}) {
  const base = `${set.gamesP1}-${set.gamesP2}`;
  if (set.tiebreakP1 == null || set.tiebreakP2 == null) return base;
  return `${base} (${set.tiebreakP1}-${set.tiebreakP2})`;
}

export async function fetchPairHistorySummaries(
  dbClient: DbClient,
  playerIds: string[],
): Promise<Record<string, PairHistorySummary>> {
  const uniquePlayerIds = [...new Set(playerIds)];
  if (uniquePlayerIds.length < 2) return {};

  const completedMatches = await dbClient
    .select({
      id: matches.id,
      player1Id: matches.player1Id,
      player2Id: matches.player2Id,
      winnerId: matches.winnerId,
      status: matches.status,
      playedOn: matches.playedOn,
      confirmedAt: matches.confirmedAt,
      createdAt: matches.createdAt,
    })
    .from(matches)
    .where(
      and(
        or(
          inArray(matches.player1Id, uniquePlayerIds),
          inArray(matches.player2Id, uniquePlayerIds),
        ),
        sql`${matches.status} in ('confirmado', 'empate', 'wo')`,
      ),
    )
    .orderBy(
      desc(matches.playedOn),
      desc(matches.confirmedAt),
      desc(matches.createdAt),
    );

  const matchIds = completedMatches.map((match) => match.id);
  const setRows =
    matchIds.length > 0
      ? await dbClient
          .select({
            matchId: matchSets.matchId,
            setNumber: matchSets.setNumber,
            gamesP1: matchSets.gamesP1,
            gamesP2: matchSets.gamesP2,
            tiebreakP1: matchSets.tiebreakP1,
            tiebreakP2: matchSets.tiebreakP2,
          })
          .from(matchSets)
          .where(inArray(matchSets.matchId, matchIds))
          .orderBy(matchSets.matchId, matchSets.setNumber)
      : [];

  const scoresByMatch = new Map<string, string>();
  for (const set of setRows) {
    const currentScore = scoresByMatch.get(set.matchId);
    const setScore = formatSetScore(set);
    scoresByMatch.set(
      set.matchId,
      currentScore ? `${currentScore} ${setScore}` : setScore,
    );
  }

  const playerIdSet = new Set(uniquePlayerIds);
  const historiesByPair: Record<string, PairHistorySummary> = {};

  for (const match of completedMatches) {
    if (
      !playerIdSet.has(match.player1Id) ||
      !playerIdSet.has(match.player2Id)
    ) {
      continue;
    }

    const pairKey = getPairKey(match.player1Id, match.player2Id);
    const history =
      historiesByPair[pairKey] ??
      ({
        player1Id: match.player1Id,
        player2Id: match.player2Id,
        winsByPlayer: {},
        draws: 0,
        totalMatches: 0,
        lastMatch: null,
      } satisfies PairHistorySummary);

    history.totalMatches += 1;

    if (match.status === "empate" || !match.winnerId) {
      history.draws += 1;
    } else {
      history.winsByPlayer[match.winnerId] =
        (history.winsByPlayer[match.winnerId] ?? 0) + 1;
    }

    if (!history.lastMatch) {
      history.lastMatch = {
        playedOn: match.playedOn,
        status: match.status as CompletedMatchStatus,
        winnerId: match.winnerId,
        score:
          scoresByMatch.get(match.id) ??
          (match.status === "wo" ? "W.O." : null),
      };
    }

    historiesByPair[pairKey] = history;
  }

  return historiesByPair;
}
