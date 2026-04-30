import { and, desc, eq, or, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";

import { db } from "@/lib/db";
import { matches, matchSets, players, rankingEvents } from "@/lib/db/schema";
import type { TieBreakDeps } from "@/lib/ranking/tiebreak";
import { createZeroTieBreakDeps, resolveTies } from "@/lib/ranking/tiebreak";

export type RankingCategory = "hombres" | "mujeres";
export type PlayerStatus = "pendiente" | "activo" | "congelado" | "retirado";

export type RankingEntry = {
  id: string;
  position: number;
  fullName: string;
  points: number;
  weeklyDelta: number;
  bestRankingPosition: number | null;
  bestRankingAchievedAt: Date | null;
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  status: PlayerStatus;
  category: RankingCategory;
  recentForm: Array<"W" | "L" | "D">;
};

export type PlayerHistoryEvent = {
  id: string;
  occurredAt: Date;
  delta: number;
  reason: string;
  note: string | null;
};

export type PlayerRankingDetail = {
  player: RankingEntry;
  events: PlayerHistoryEvent[];
};

export type PublicPlayerMatch = {
  id: string;
  playedOn: string | null;
  status: "confirmado" | "wo" | "empate";
  type: "sorteo" | "desafio" | "campeonato";
  format: "mr3" | "set_largo" | null;
  winnerId: string | null;
  player1Id: string;
  player2Id: string;
  player1Name: string;
  player2Name: string;
  sets: Array<{
    setNumber: number;
    gamesP1: number;
    gamesP2: number;
    tiebreakP1: number | null;
    tiebreakP2: number | null;
  }>;
};

export type PublicPlayerProfile = {
  player: RankingEntry;
  recentMatches: PublicPlayerMatch[];
};

type RankingRow = {
  id: string;
  fullName: string;
  points: number;
  weeklyDelta: number;
  bestRankingPosition: number | null;
  bestRankingAchievedAt: Date | null;
  status: PlayerStatus;
  category: RankingCategory;
};

type MatchRow = {
  id: string;
  player1Id: string;
  player2Id: string;
  winnerId: string | null;
  status: "pendiente" | "reportado" | "confirmado" | "wo" | "empate";
};

type MatchSetRow = {
  matchId: string;
  setNumber: number;
  gamesP1: number;
  gamesP2: number;
  tiebreakP1: number | null;
  tiebreakP2: number | null;
};

type RankingMatchStats = {
  played: number;
  won: number;
  lost: number;
};

export const rankingCategoryLabels: Record<RankingCategory, string> = {
  hombres: "Hombres",
  mujeres: "Mujeres",
};

const rankingReasonLabels: Record<string, string> = {
  initial_seed: "Seed inicial",
  match_win: "Partido ganado",
  match_loss_3s: "Partido perdido en 3 sets",
  match_loss_2s: "Partido perdido en 2 sets",
  match_loss_set_largo: "Partido perdido en set largo",
  match_draw: "Empate",
  wo_win: "Victoria por W.O.",
  wo_loss: "Derrota por W.O.",
  championship_bonus: "Bonus campeonato",
  inactivity_month: "Inactividad mensual",
  inactivity_3mo: "Inactividad 3 meses",
  inactivity_6mo: "Inactividad 6 meses",
  inactivity_1y: "Inactividad 1 año",
  manual_adjustment: "Ajuste manual",
  match_correction: "Corrección de partido",
};

export function isRankingCategory(value: string): value is RankingCategory {
  return value === "hombres" || value === "mujeres";
}

export function rankingCategoryFromGender(gender: "M" | "F"): RankingCategory {
  return gender === "M" ? "hombres" : "mujeres";
}

export function rankingGenderFromCategory(category: RankingCategory): "M" | "F" {
  return category === "hombres" ? "M" : "F";
}

// Pre-fetches ALL match + set data in 2 parallel queries.
// Tie-break computations then run entirely in memory — no per-pair DB calls.
async function buildTieBreakDeps(): Promise<TieBreakDeps> {
  if (!db) return createZeroTieBreakDeps();

  const completedFilter = or(
    eq(matches.status, "confirmado"),
    eq(matches.status, "wo"),
  );

  const [allMatches, allSets] = await Promise.all([
    db
      .select({
        id: matches.id,
        player1Id: matches.player1Id,
        player2Id: matches.player2Id,
        winnerId: matches.winnerId,
        status: matches.status,
      })
      .from(matches)
      .where(completedFilter),

    db
      .select({
        matchId: matchSets.matchId,
        setNumber: matchSets.setNumber,
        gamesP1: matchSets.gamesP1,
        gamesP2: matchSets.gamesP2,
        tiebreakP1: matchSets.tiebreakP1,
        tiebreakP2: matchSets.tiebreakP2,
      })
      .from(matchSets)
      .innerJoin(matches, eq(matchSets.matchId, matches.id))
      .where(completedFilter),
  ]);

  return {
    getHeadToHead: async (aId: string, bId: string) => {
      let winsA = 0;
      let winsB = 0;
      for (const m of allMatches) {
        if (
          (m.player1Id === aId && m.player2Id === bId) ||
          (m.player1Id === bId && m.player2Id === aId)
        ) {
          if (m.winnerId === aId) winsA += 1;
          else if (m.winnerId === bId) winsB += 1;
        }
      }
      return { winsA, winsB };
    },

    getSetDifferential: async (playerId: string) => {
      const playerMatches = allMatches.filter(
        (m) => m.player1Id === playerId || m.player2Id === playerId,
      );
      if (!playerMatches.length) return 0;
      const ids = new Set(playerMatches.map((m) => m.id));
      const playerSets = allSets.filter((s) => ids.has(s.matchId));
      return computeSetDifferential(playerId, playerMatches, playerSets);
    },

    getGameDifferential: async (playerId: string) => {
      const playerMatches = allMatches.filter(
        (m) => m.player1Id === playerId || m.player2Id === playerId,
      );
      if (!playerMatches.length) return 0;
      const ids = new Set(playerMatches.map((m) => m.id));
      const playerSets = allSets.filter((s) => ids.has(s.matchId));
      return computeGameDifferential(playerId, playerMatches, playerSets);
    },
  };
}

function computeSetDifferential(
  playerId: string,
  matchRows: MatchRow[],
  setRows: MatchSetRow[],
) {
  const matchesById = new Map(matchRows.map((match) => [match.id, match]));
  let won = 0;
  let lost = 0;

  for (const set of setRows) {
    const match = matchesById.get(set.matchId);
    if (!match) continue;

    const isP1 = match.player1Id === playerId;
    const myGames = isP1 ? set.gamesP1 : set.gamesP2;
    const oppGames = isP1 ? set.gamesP2 : set.gamesP1;

    if (myGames > oppGames) won += 1;
    else if (oppGames > myGames) lost += 1;
  }

  return won - lost;
}

function computeGameDifferential(
  playerId: string,
  matchRows: MatchRow[],
  setRows: MatchSetRow[],
) {
  const matchesById = new Map(matchRows.map((match) => [match.id, match]));
  let won = 0;
  let lost = 0;

  for (const set of setRows) {
    const match = matchesById.get(set.matchId);
    if (!match) continue;

    const isP1 = match.player1Id === playerId;
    won += isP1 ? set.gamesP1 : set.gamesP2;
    lost += isP1 ? set.gamesP2 : set.gamesP1;
  }

  return won - lost;
}

async function mapRowsToEntries(
  category: RankingCategory,
  rows: RankingRow[],
  deps: TieBreakDeps,
  matchStats: Map<string, RankingMatchStats>,
): Promise<RankingEntry[]> {
  const resolved = await resolveTies(
    rows.map((row) => ({
      id: row.id,
      fullName: row.fullName,
      points: Number(row.points ?? 0),
      weeklyDelta: Number(row.weeklyDelta ?? 0),
      bestRankingPosition: row.bestRankingPosition,
      bestRankingAchievedAt: row.bestRankingAchievedAt,
      matchesPlayed: matchStats.get(row.id)?.played ?? 0,
      matchesWon: matchStats.get(row.id)?.won ?? 0,
      matchesLost: matchStats.get(row.id)?.lost ?? 0,
      status: row.status,
      category: row.category,
      recentForm: [] as Array<"W" | "L" | "D">,
    })),
    deps,
  );

  return resolved.map((row) => ({
    id: row.id,
    position: row.position,
    fullName: row.fullName,
    points: row.points,
    weeklyDelta: row.weeklyDelta,
    bestRankingPosition: row.bestRankingPosition,
    bestRankingAchievedAt: row.bestRankingAchievedAt,
    matchesPlayed: row.matchesPlayed,
    matchesWon: row.matchesWon,
    matchesLost: row.matchesLost,
    status: row.status,
    category,
    recentForm: row.recentForm,
  }));
}

async function fetchRankingMatchStats(gender: "M" | "F") {
  const stats = new Map<string, RankingMatchStats>();
  if (!db) return stats;

  const completedMatches = await db
    .select({
      player1Id: matches.player1Id,
      player2Id: matches.player2Id,
      winnerId: matches.winnerId,
      status: matches.status,
    })
    .from(matches)
    .where(
      and(
        eq(matches.category, gender),
        sql`${matches.status} in ('confirmado', 'wo', 'empate')`,
      ),
    );

  const ensureStats = (playerId: string) => {
    const current = stats.get(playerId);
    if (current) return current;
    const next = { played: 0, won: 0, lost: 0 };
    stats.set(playerId, next);
    return next;
  };

  for (const match of completedMatches) {
    const player1Stats = ensureStats(match.player1Id);
    const player2Stats = ensureStats(match.player2Id);

    player1Stats.played += 1;
    player2Stats.played += 1;

    if (match.status === "empate" || !match.winnerId) continue;

    if (match.winnerId === match.player1Id) {
      player1Stats.won += 1;
      player2Stats.lost += 1;
    } else if (match.winnerId === match.player2Id) {
      player2Stats.won += 1;
      player1Stats.lost += 1;
    }
  }

  return stats;
}

async function fetchRankingFromDb(
  category: RankingCategory,
): Promise<RankingEntry[] | null> {
  if (!db) return null;

  const gender = rankingGenderFromCategory(category);
  const weeklyWindow = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [rows, deps, matchStats] = await Promise.all([
    db
      .select({
        id: players.id,
        fullName: players.fullName,
        status: players.status,
        points: sql<number>`coalesce(sum(${rankingEvents.delta}), 0)`,
        category: sql<RankingCategory>`${category}`,
        weeklyDelta: sql<number>`coalesce(sum(case when ${rankingEvents.occurredAt} >= ${weeklyWindow} then ${rankingEvents.delta} else 0 end), 0)`,
        bestRankingPosition: players.bestRankingPosition,
        bestRankingAchievedAt: players.bestRankingAchievedAt,
      })
      .from(players)
      .leftJoin(rankingEvents, eq(rankingEvents.playerId, players.id))
      .where(
        and(
          eq(players.gender, gender),
          or(eq(players.status, "activo"), eq(players.status, "congelado")),
        ),
      )
      .groupBy(players.id),

    buildTieBreakDeps(),
    fetchRankingMatchStats(gender),
  ]);

  return mapRowsToEntries(category, rows as RankingRow[], deps, matchStats);
}

export async function refreshHistoricalBestRanking(gender: "M" | "F") {
  if (!db) return;

  const ranking = await fetchRankingFromDb(rankingCategoryFromGender(gender));
  const achievedAt = new Date();

  for (const entry of ranking ?? []) {
    if (
      entry.bestRankingPosition != null &&
      entry.bestRankingPosition <= entry.position
    ) {
      continue;
    }

    await db
      .update(players)
      .set({
        bestRankingPosition: entry.position,
        bestRankingAchievedAt: achievedAt,
        updatedAt: achievedAt,
      })
      .where(eq(players.id, entry.id));
  }
}

const getCachedRanking = unstable_cache(fetchRankingFromDb, ["ranking"], {
  tags: ["ranking"],
  revalidate: 30,
});

export async function getRanking(
  category: RankingCategory,
): Promise<RankingEntry[]> {
  const fromDb = await getCachedRanking(category);
  return fromDb ?? [];
}

export async function getPlayerRankingDetail(
  category: RankingCategory,
  playerId: string,
): Promise<PlayerRankingDetail | null> {
  const ranking = await getRanking(category);
  const player = ranking.find((entry) => entry.id === playerId);

  if (!player) return null;
  if (!db) return { player, events: [] };

  const events = await db
    .select({
      id: rankingEvents.id,
      occurredAt: rankingEvents.occurredAt,
      delta: rankingEvents.delta,
      reason: rankingEvents.reason,
      note: rankingEvents.note,
    })
    .from(rankingEvents)
    .innerJoin(players, eq(players.id, rankingEvents.playerId))
    .where(
      and(
        eq(rankingEvents.playerId, playerId),
        eq(players.gender, rankingGenderFromCategory(category)),
      ),
    )
    .orderBy(desc(rankingEvents.occurredAt))
    .limit(20);

  return { player, events };
}

export async function getPublicPlayerProfile(
  category: RankingCategory,
  playerId: string,
): Promise<PublicPlayerProfile | null> {
  const ranking = await getRanking(category);
  const player = ranking.find((entry) => entry.id === playerId);

  if (!player) return null;
  if (!db) return { player, recentMatches: [] };

  const recentMatches = (await db
    .select({
      id: matches.id,
      playedOn: matches.playedOn,
      status: matches.status,
      type: matches.type,
      format: matches.format,
      winnerId: matches.winnerId,
      player1Id: matches.player1Id,
      player2Id: matches.player2Id,
      player1Name: players.fullName,
      player2Name: sql<string>`players_p2.full_name`,
    })
    .from(matches)
    .innerJoin(players, eq(matches.player1Id, players.id))
    .innerJoin(
      sql`players as players_p2`,
      sql`${matches.player2Id} = players_p2.id`,
    )
    .where(
      and(
        or(eq(matches.player1Id, playerId), eq(matches.player2Id, playerId)),
        sql`${matches.status} in ('confirmado', 'empate', 'wo')`,
        eq(players.gender, rankingGenderFromCategory(category)),
      ),
    )
    .orderBy(
      desc(matches.playedOn),
      desc(matches.confirmedAt),
      desc(matches.createdAt),
    )
    .limit(10)) as Omit<PublicPlayerMatch, "sets">[];

  const matchIds = recentMatches.map((match) => match.id);
  const setRows = matchIds.length
    ? ((await db
        .select({
          matchId: matchSets.matchId,
          setNumber: matchSets.setNumber,
          gamesP1: matchSets.gamesP1,
          gamesP2: matchSets.gamesP2,
          tiebreakP1: matchSets.tiebreakP1,
          tiebreakP2: matchSets.tiebreakP2,
        })
        .from(matchSets)
        .where(
          sql`${matchSets.matchId} in (${sql.join(
            matchIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        )) as MatchSetRow[])
    : [];

  const setsByMatch = new Map<string, MatchSetRow[]>();
  for (const set of setRows) {
    const existing = setsByMatch.get(set.matchId) ?? [];
    existing.push(set);
    setsByMatch.set(set.matchId, existing);
  }

  return {
    player,
    recentMatches: recentMatches.map((match) => ({
      ...match,
      sets: (setsByMatch.get(match.id) ?? []).sort(
        (a, b) => a.setNumber - b.setNumber,
      ),
    })),
  };
}

export async function getRankingSummary() {
  const [hombres, mujeres] = await Promise.all([
    getRanking("hombres"),
    getRanking("mujeres"),
  ]);

  const categories = (
    [
      { category: "hombres" as RankingCategory, ranking: hombres },
      { category: "mujeres" as RankingCategory, ranking: mujeres },
    ] as const
  ).map(({ category, ranking }) => ({
    category,
    label: rankingCategoryLabels[category],
    leader: ranking[0],
    players: ranking.length,
  }));

  return {
    updatedLabel: db
      ? "Actualizado desde base real"
      : "Base de datos no configurada",
    categories,
  };
}

export function formatDelta(delta: number) {
  if (delta > 0) return `▲ ${delta}`;
  if (delta < 0) return `▼ ${Math.abs(delta)}`;
  return "—";
}

export function formatRankingReason(reason: string) {
  return rankingReasonLabels[reason] ?? reason;
}
