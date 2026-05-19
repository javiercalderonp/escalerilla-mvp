import { and, desc, inArray, or, sql } from "drizzle-orm";

import type { db } from "@/lib/db";
import { matches } from "@/lib/db/schema";

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
  };
}

export async function fetchPairHistorySummaries(
  dbClient: DbClient,
  playerIds: string[],
): Promise<Record<string, PairHistorySummary>> {
  const uniquePlayerIds = [...new Set(playerIds)];
  if (uniquePlayerIds.length < 2) return {};

  const completedMatches = await dbClient
    .select({
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
      };
    }

    historiesByPair[pairKey] = history;
  }

  return historiesByPair;
}
