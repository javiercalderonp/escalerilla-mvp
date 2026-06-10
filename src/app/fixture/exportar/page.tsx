import { and, asc, desc, gte, inArray, lte, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ExportPageClient } from "@/app/fixture/exportar/export-page-client";
import { db } from "@/lib/db";
import { matches, matchSets, players, weeks } from "@/lib/db/schema";
import { getTodayInSantiago } from "@/lib/date";

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

type ExportMatch = MatchRow & {
  sets: { setNumber: number; gamesP1: number; gamesP2: number }[];
};

function addDays(dateStr: string, days: number) {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDayLabel(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

function formatWeekLabel(startsOn: string, endsOn: string) {
  const [sy, sm, sd] = startsOn.split("-").map(Number);
  const [ey, em, ed] = endsOn.split("-").map(Number);
  const start = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed));
  const startFmt = new Intl.DateTimeFormat("es-CL", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
  }).format(start);
  const endFmt = new Intl.DateTimeFormat("es-CL", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(end);
  return `${startFmt} al ${endFmt}`;
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

function formatGeneratedAt() {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

async function getUpcomingMatches(today: string, todayPlus8: string): Promise<MatchRow[]> {
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
    .innerJoin(weeks, sql`${matches.weekId} = ${weeks.id}`)
    .innerJoin(players, sql`${matches.player1Id} = ${players.id}`)
    .innerJoin(
      sql`players as players_p2`,
      sql`${matches.player2Id} = players_p2.id`,
    )
    .where(
      and(
        inArray(weeks.status, ["abierta"]),
        inArray(matches.status, ["pendiente"]),
        lte(weeks.startsOn, todayPlus8),
        gte(weeks.endsOn, today),
      ),
    )
    .orderBy(asc(weeks.startsOn), matches.category, asc(players.fullName));

  return rows as MatchRow[];
}

async function getRecentResults(todayMinus8: string, today: string): Promise<MatchRow[]> {
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

function buildGroupsForUpcoming(rows: ExportMatch[]): { key: string; label: string; matchesM: ExportMatch[]; matchesF: ExportMatch[] }[] {
  const groupsByWeek = new Map<
    string,
    {
      key: string;
      label: string;
      matchesM: ExportMatch[];
      matchesF: ExportMatch[];
    }
  >();

  for (const match of rows) {
    const key = match.weekStartsOn ?? "sin-semana";
    if (!groupsByWeek.has(key)) {
      const label = match.weekStartsOn
        ? `Semana ${formatWeekLabel(match.weekStartsOn, addDays(match.weekStartsOn, 6))}`
        : "Próximas semanas";
      groupsByWeek.set(key, { key, label, matchesM: [], matchesF: [] });
    }
    const group = groupsByWeek.get(key)!;
    if (match.category === "M") group.matchesM.push(match);
    else group.matchesF.push(match);
  }

  return Array.from(groupsByWeek.values());
}

function buildGroupsForResults(rows: ExportMatch[]): { key: string; label: string; matchesM: ExportMatch[]; matchesF: ExportMatch[] }[] {
  const groupsByDay = new Map<
    string,
    {
      key: string;
      label: string;
      matchesM: ExportMatch[];
      matchesF: ExportMatch[];
    }
  >();

  for (const match of rows) {
    const key = match.playedOn ?? "sin-fecha";
    if (!groupsByDay.has(key)) {
      const label = match.playedOn
        ? formatDayLabel(match.playedOn)
        : "Sin fecha";
      groupsByDay.set(key, { key, label, matchesM: [], matchesF: [] });
    }
    const group = groupsByDay.get(key)!;
    if (match.category === "M") group.matchesM.push(match);
    else group.matchesF.push(match);
  }

  return Array.from(groupsByDay.values());
}

export default async function ExportPage({ searchParams }: ExportPageProps) {
  if (!db) notFound();

  const query = searchParams ? await searchParams : undefined;
  const rawType = query?.type;
  const exportType: ExportType =
    rawType === "resultados" ? "resultados" : "proximos";

  const today = getTodayInSantiago();
  const todayPlus8 = addDays(today, 8);
  const todayMinus8 = addDays(today, -8);

  const rawMatches =
    exportType === "proximos"
      ? await getUpcomingMatches(today, todayPlus8)
      : await getRecentResults(todayMinus8, today);

  const matchIds = rawMatches.map((m) => m.id);
  const allSets = await getSetsForMatches(matchIds);

  const setsByMatch = new Map<
    string,
    { setNumber: number; gamesP1: number; gamesP2: number }[]
  >();
  for (const set of allSets) {
    const current = setsByMatch.get(set.matchId) ?? [];
    current.push(set);
    setsByMatch.set(set.matchId, current);
  }

  const enrichedMatches: ExportMatch[] = rawMatches.map((m) => ({
    ...m,
    sets: setsByMatch.get(m.id) ?? [],
  }));

  const groups =
    exportType === "proximos"
      ? buildGroupsForUpcoming(enrichedMatches)
      : buildGroupsForResults(enrichedMatches);

  const title =
    exportType === "proximos" ? "Próximos Partidos" : "Resultados Recientes";

  const subtitle =
    exportType === "proximos"
      ? formatDateRange(today, todayPlus8)
      : formatDateRange(todayMinus8, today);

  const dateRange =
    exportType === "proximos"
      ? `${today} → ${todayPlus8}`
      : `${todayMinus8} → ${today}`;

  return (
    <ExportPageClient
      type={exportType}
      title={title}
      subtitle={subtitle}
      dateRange={dateRange}
      groups={groups}
      generatedAt={formatGeneratedAt()}
    />
  );
}
