import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ExportPageClient } from "@/app/fixture/exportar/export-page-client";
import { getTodayInSantiago } from "@/lib/date";
import { db } from "@/lib/db";
import {
  matches,
  matchSets,
  players,
  rankingEvents,
  weeks,
} from "@/lib/db/schema";
import { getRanking } from "@/lib/ranking";

// How many recent weeks with pending matches to include in the "próximos" export
const UPCOMING_WEEKS_LIMIT = 2;

type ExportPageProps = {
  searchParams?: Promise<{ type?: string }>;
};

type ExportType = "proximos" | "resultados";

type MatchRow = {
  id: string;
  category: "M" | "F";
  player1Name: string;
  player2Name: string;
  player1Id: string;
  player2Id: string;
  winnerId: string | null;
  status: string;
  type: "sorteo" | "desafio" | "campeonato";
  playedOn: string | null;
  weekStartsOn: string | null;
};

export type ExportMatch = MatchRow & {
  sets: { setNumber: number; gamesP1: number; gamesP2: number }[];
  player1RankingPosition: number | null;
  player2RankingPosition: number | null;
  player1Points: number | null;
  player2Points: number | null;
};

export type DayGroup = {
  key: string;
  label: string;
  matches: ExportMatch[];
  matchesM: ExportMatch[];
  matchesF: ExportMatch[];
};

function addDays(dateStr: string, days: number) {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatShortDate(dateStr: string) {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

function formatWeekShortDate(startsOn: string) {
  const endsOn = addDays(startsOn, 6);
  return `${formatShortDate(startsOn)} – ${formatShortDate(endsOn)}`;
}

function formatDateRange(from: string, to: string) {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const fromDate = new Date(Date.UTC(fy, fm - 1, fd));
  const toDate = new Date(Date.UTC(ty, tm - 1, td));
  const fromFmt = new Intl.DateTimeFormat("es-CL", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
  }).format(fromDate);
  const toFmt = new Intl.DateTimeFormat("es-CL", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(toDate);
  return `${fromFmt} – ${toFmt}`;
}

function formatWeekLabel(startsOn: string) {
  const [year, month, day] = startsOn.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const formatted = new Intl.DateTimeFormat("es-CL", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
  }).format(date);
  return `Semana ${formatted}`;
}

async function getUpcomingMatches(): Promise<{
  rows: MatchRow[];
  weekDateRange: string | null;
}> {
  if (!db) return { rows: [], weekDateRange: null };

  // Find the N most recent weeks that still have pending matches
  const recentWeeks = await db
    .selectDistinct({
      id: weeks.id,
      startsOn: weeks.startsOn,
      endsOn: weeks.endsOn,
    })
    .from(weeks)
    .innerJoin(
      matches,
      and(eq(matches.weekId, weeks.id), eq(matches.status, "pendiente")),
    )
    .orderBy(desc(weeks.startsOn))
    .limit(UPCOMING_WEEKS_LIMIT);

  if (recentWeeks.length === 0) return { rows: [], weekDateRange: null };

  const weekIds = recentWeeks.map((w) => w.id);

  // Compute the date range covered (oldest startsOn → newest endsOn)
  const sortedWeeks = [...recentWeeks].sort((a, b) =>
    a.startsOn < b.startsOn ? -1 : 1,
  );
  const rangeFrom = sortedWeeks[0].startsOn;
  const rangeTo = sortedWeeks[sortedWeeks.length - 1].endsOn;
  const weekDateRange = formatDateRange(rangeFrom, rangeTo);

  const rows = await db
    .select({
      id: matches.id,
      category: matches.category,
      player1Id: matches.player1Id,
      player2Id: matches.player2Id,
      player1Name: players.fullName,
      player2Name: sql<string>`players_p2.full_name`,
      status: matches.status,
      winnerId: matches.winnerId,
      type: matches.type,
      playedOn: matches.playedOn,
      weekStartsOn: weeks.startsOn,
    })
    .from(matches)
    .innerJoin(weeks, sql`${matches.weekId} = ${weeks.id}`)
    .innerJoin(players, sql`${matches.player1Id} = ${players.id}`)
    .innerJoin(
      sql`players as players_p2`,
      sql`${matches.player2Id} = players_p2.id`,
    )
    .where(
      and(inArray(matches.weekId, weekIds), eq(matches.status, "pendiente")),
    )
    .orderBy(asc(weeks.startsOn), matches.category, asc(players.fullName));

  return { rows: rows as MatchRow[], weekDateRange };
}

async function getRecentResults(
  todayMinus8: string,
  today: string,
): Promise<MatchRow[]> {
  if (!db) return [];

  const rows = await db
    .select({
      id: matches.id,
      category: matches.category,
      player1Id: matches.player1Id,
      player2Id: matches.player2Id,
      player1Name: players.fullName,
      player2Name: sql<string>`players_p2.full_name`,
      status: matches.status,
      winnerId: matches.winnerId,
      type: matches.type,
      playedOn: matches.playedOn,
      weekStartsOn: weeks.startsOn,
    })
    .from(matches)
    .leftJoin(weeks, sql`${matches.weekId} = ${weeks.id}`)
    .innerJoin(players, sql`${matches.player1Id} = ${players.id}`)
    .innerJoin(
      sql`players as players_p2`,
      sql`${matches.player2Id} = players_p2.id`,
    )
    .where(
      and(
        inArray(matches.status, ["confirmado", "wo", "empate"]),
        gte(matches.playedOn, todayMinus8),
        lte(matches.playedOn, today),
      ),
    )
    .orderBy(desc(matches.playedOn), matches.category, asc(players.fullName));

  return rows as MatchRow[];
}

async function getSetsForMatches(matchIds: string[]) {
  if (!db || matchIds.length === 0) return [];

  return db
    .select({
      matchId: matchSets.matchId,
      setNumber: matchSets.setNumber,
      gamesP1: matchSets.gamesP1,
      gamesP2: matchSets.gamesP2,
    })
    .from(matchSets)
    .where(
      sql`${matchSets.matchId} in (${sql.join(
        matchIds.map((id) => sql`${id}`),
        sql`, `,
      )})`,
    )
    .orderBy(matchSets.matchId, matchSets.setNumber);
}

async function getPointsForMatches(matchIds: string[]) {
  if (!db || matchIds.length === 0) return [];

  return db
    .select({
      matchId: rankingEvents.refId,
      playerId: rankingEvents.playerId,
      points: sql<number>`coalesce(sum(${rankingEvents.delta}), 0)`,
    })
    .from(rankingEvents)
    .where(
      and(
        eq(rankingEvents.refType, "match"),
        sql`${rankingEvents.refId} in (${sql.join(
          matchIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      ),
    )
    .groupBy(rankingEvents.refId, rankingEvents.playerId);
}

function buildGroupsForUpcoming(rows: ExportMatch[]): DayGroup[] {
  const groupsByWeek = new Map<string, DayGroup>();

  for (const match of rows) {
    const key = match.weekStartsOn ?? "sin-semana";
    if (!groupsByWeek.has(key)) {
      const label = match.weekStartsOn
        ? `Semana ${formatWeekShortDate(match.weekStartsOn)}`
        : "Próximas semanas";
      groupsByWeek.set(key, {
        key,
        label,
        matches: [],
        matchesM: [],
        matchesF: [],
      });
    }
    const group = groupsByWeek.get(key)!;
    group.matches.push(match);
    if (match.category === "M") group.matchesM.push(match);
    else group.matchesF.push(match);
  }

  return Array.from(groupsByWeek.values());
}

function buildGroupsForResults(rows: ExportMatch[]): DayGroup[] {
  return [
    {
      key: "resultados",
      label: "Resultados",
      matches: rows,
      matchesM: rows.filter((match) => match.category === "M"),
      matchesF: rows.filter((match) => match.category === "F"),
    },
  ];
}

export default async function ExportPage({ searchParams }: ExportPageProps) {
  if (!db) notFound();

  const query = searchParams ? await searchParams : undefined;
  const rawType = query?.type;
  const exportType: ExportType =
    rawType === "resultados" ? "resultados" : "proximos";

  const today = getTodayInSantiago();
  const todayMinus8 = addDays(today, -8);

  let rawMatches: MatchRow[];
  let subtitle: string;
  let dateRange: string;

  if (exportType === "proximos") {
    const { rows, weekDateRange } = await getUpcomingMatches();
    rawMatches = rows;
    subtitle = weekDateRange ?? "Sin semanas con partidos pendientes";
    dateRange = weekDateRange ?? "";
  } else {
    rawMatches = await getRecentResults(todayMinus8, today);
    subtitle = formatWeekLabel(todayMinus8);
    dateRange = subtitle;
  }

  const matchIds = rawMatches.map((m) => m.id);

  const categories = [...new Set(rawMatches.map((m) => m.category))];
  const [allSets, pointRows, rankingM, rankingF] = await Promise.all([
    getSetsForMatches(matchIds),
    getPointsForMatches(matchIds),
    categories.includes("M") ? getRanking("hombres") : Promise.resolve([]),
    categories.includes("F") ? getRanking("mujeres") : Promise.resolve([]),
  ]);

  const setsByMatch = new Map<
    string,
    { setNumber: number; gamesP1: number; gamesP2: number }[]
  >();
  for (const set of allSets) {
    const current = setsByMatch.get(set.matchId) ?? [];
    current.push(set);
    setsByMatch.set(set.matchId, current);
  }

  const pointsByMatchPlayer = new Map<string, number>();
  for (const row of pointRows) {
    if (!row.matchId) continue;
    pointsByMatchPlayer.set(`${row.matchId}:${row.playerId}`, row.points);
  }

  const rankingByPlayer = new Map<string, number>();
  for (const entry of [...rankingM, ...rankingF]) {
    rankingByPlayer.set(entry.id, entry.position);
  }

  const enrichedMatches: ExportMatch[] = rawMatches.map((m) => ({
    ...m,
    sets: setsByMatch.get(m.id) ?? [],
    player1RankingPosition: rankingByPlayer.get(m.player1Id) ?? null,
    player2RankingPosition: rankingByPlayer.get(m.player2Id) ?? null,
    player1Points: pointsByMatchPlayer.get(`${m.id}:${m.player1Id}`) ?? null,
    player2Points: pointsByMatchPlayer.get(`${m.id}:${m.player2Id}`) ?? null,
  }));

  const groups =
    exportType === "proximos"
      ? buildGroupsForUpcoming(enrichedMatches)
      : buildGroupsForResults(enrichedMatches);

  const title =
    exportType === "proximos" ? "Próximos Partidos" : "Resultados Recientes";

  return (
    <ExportPageClient
      type={exportType}
      title={title}
      subtitle={subtitle}
      dateRange={dateRange}
      groups={groups}
    />
  );
}
