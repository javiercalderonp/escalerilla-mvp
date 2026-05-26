import { and, asc, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { AutoPrint, PrintNowButton } from "@/app/fixture/imprimir/auto-print";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  matches,
  matchSets,
  players,
  rankingEvents,
  weeks,
} from "@/lib/db/schema";
import { getRanking } from "@/lib/ranking";

type FixturePrintPageProps = {
  searchParams?: Promise<{
    week?: string;
    scope?: string;
  }>;
};

type PrintScope = "matches" | "previous-results" | "both";

type PrintMatch = {
  id: string;
  category: "M" | "F";
  player1Id: string;
  player2Id: string;
  player1Name: string;
  player2Name: string;
  status: string;
  winnerId: string | null;
  playedOn: string | null;
  weekStartsOn: string | null;
  weekEndsOn: string | null;
  type: "sorteo" | "desafio" | "campeonato";
};

type SetRow = {
  matchId: string;
  setNumber: number;
  gamesP1: number;
  gamesP2: number;
};

function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

function formatWeekLabel(start: string, end: string) {
  return `${formatDate(start)}–${formatDate(end)}`;
}

function formatPrintedAt(date: Date) {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatPoints(points: number) {
  if (points > 0) return `+${points} pts`;
  if (points < 0) return `${points} pts`;
  return "0 pts";
}

function getTypeLabel(type: PrintMatch["type"]) {
  if (type === "desafio") return "Desafío";
  if (type === "campeonato") return "Campeonato";
  return "Sorteo";
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pendiente: "Pendiente",
    reportado: "Reportado",
    confirmado: "Confirmado",
    wo: "W.O.",
    empate: "Empate",
  };
  return labels[status] ?? status;
}

function getInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

async function getWeek(weekId: string) {
  if (!db) return null;

  const [week] = await db
    .select({
      id: weeks.id,
      seasonId: weeks.seasonId,
      startsOn: weeks.startsOn,
      endsOn: weeks.endsOn,
      status: weeks.status,
    })
    .from(weeks)
    .where(eq(weeks.id, weekId))
    .limit(1);

  return week ?? null;
}

async function getPreviousWeek(
  currentWeek: Awaited<ReturnType<typeof getWeek>>,
) {
  if (!db || !currentWeek) return null;

  const [week] = await db
    .select({
      id: weeks.id,
      seasonId: weeks.seasonId,
      startsOn: weeks.startsOn,
      endsOn: weeks.endsOn,
      status: weeks.status,
    })
    .from(weeks)
    .where(
      and(
        eq(weeks.seasonId, currentWeek.seasonId),
        lt(weeks.startsOn, currentWeek.startsOn),
      ),
    )
    .orderBy(desc(weeks.startsOn))
    .limit(1);

  return week ?? null;
}

async function getMatchesForWeek(weekId: string, resultsOnly: boolean) {
  if (!db) return [];

  const statusCondition = resultsOnly
    ? inArray(matches.status, ["confirmado", "wo", "empate"])
    : undefined;

  return db
    .select({
      id: matches.id,
      category: matches.category,
      player1Id: matches.player1Id,
      player2Id: matches.player2Id,
      player1Name: players.fullName,
      player2Name: sql<string>`players_p2.full_name`,
      status: matches.status,
      winnerId: matches.winnerId,
      playedOn: matches.playedOn,
      weekStartsOn: weeks.startsOn,
      weekEndsOn: weeks.endsOn,
      type: matches.type,
    })
    .from(matches)
    .leftJoin(weeks, eq(matches.weekId, weeks.id))
    .innerJoin(players, eq(matches.player1Id, players.id))
    .innerJoin(
      sql`players as players_p2`,
      sql`${matches.player2Id} = players_p2.id`,
    )
    .where(and(eq(matches.weekId, weekId), statusCondition))
    .orderBy(matches.category, asc(players.fullName));
}

async function getMatchDetails(rows: PrintMatch[]) {
  if (!db) {
    return {
      setsByMatch: new Map<string, SetRow[]>(),
      pointsByMatchPlayer: new Map<string, number>(),
      rankingByPlayer: new Map<string, number>(),
    };
  }

  const matchIds = rows.map((match) => match.id);

  const [allSets, pointRows, rankingM, rankingF] = matchIds.length
    ? await Promise.all([
        db
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
          .orderBy(matchSets.matchId, matchSets.setNumber),
        db
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
          .groupBy(rankingEvents.refId, rankingEvents.playerId),
        getRanking("hombres"),
        getRanking("mujeres"),
      ])
    : [[], [], await getRanking("hombres"), await getRanking("mujeres")];

  const setsByMatch = new Map<string, SetRow[]>();
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

  return { setsByMatch, pointsByMatchPlayer, rankingByPlayer };
}

function PlayerPrintLine({
  match,
  name,
  playerId,
  playerIndex,
  sets,
  points,
  rankingPosition,
}: {
  match: PrintMatch;
  name: string;
  playerId: string;
  playerIndex: 1 | 2;
  sets: SetRow[];
  points: number | null;
  rankingPosition: number | null;
}) {
  const isWinner = match.winnerId === playerId;
  const hasWinner = match.winnerId !== null;
  const isLoser = hasWinner && !isWinner;

  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`size-2 shrink-0 rounded-full ${
          isWinner ? "bg-court" : "bg-border"
        }`}
      />
      <span className="w-7 shrink-0 text-center text-xs font-semibold tabular-nums text-muted-foreground">
        {rankingPosition ? `#${rankingPosition}` : "—"}
      </span>
      <span
        className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
          isWinner
            ? "bg-court text-court-foreground"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {getInitials(name)}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm leading-tight ${
            isLoser ? "text-muted-foreground" : "font-semibold text-foreground"
          }`}
        >
          {name}
        </p>
        {points !== null ? (
          <p
            className={`text-xs font-medium leading-tight ${
              points > 0
                ? "text-grass"
                : points < 0
                  ? "text-destructive"
                  : "text-muted-foreground"
            }`}
          >
            {formatPoints(points)}
          </p>
        ) : null}
      </div>
      <div className="flex gap-3 pl-1">
        {sets.length > 0 ? (
          sets.map((set) => {
            const playerGames = playerIndex === 1 ? set.gamesP1 : set.gamesP2;
            const opponentGames = playerIndex === 1 ? set.gamesP2 : set.gamesP1;
            const wonSet = playerGames > opponentGames;

            return (
              <span
                key={set.setNumber}
                className={`w-4 text-center text-sm tabular-nums ${
                  wonSet
                    ? "font-bold text-foreground"
                    : "font-normal text-muted-foreground"
                }`}
              >
                {playerGames}
              </span>
            );
          })
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </div>
    </div>
  );
}

function PrintMatchesSection({
  title,
  subtitle,
  matchesList,
  setsByMatch,
  pointsByMatchPlayer,
  rankingByPlayer,
}: {
  title: string;
  subtitle: string;
  matchesList: PrintMatch[];
  setsByMatch: Map<string, SetRow[]>;
  pointsByMatchPlayer: Map<string, number>;
  rankingByPlayer: Map<string, number>;
}) {
  const groups = [
    { category: "M" as const, label: "Hombres" },
    { category: "F" as const, label: "Mujeres" },
  ];

  return (
    <section className="space-y-5">
      <div className="overflow-hidden rounded-2xl bg-court px-6 py-5 text-court-foreground">
        <p className="text-xs font-semibold uppercase tracking-widest text-court-foreground/60">
          Escalerilla · Partidos
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-court-foreground/70">{subtitle}</p>
      </div>

      {groups.map((group) => {
        const rows = matchesList.filter(
          (match) => match.category === group.category,
        );

        return (
          <div key={group.category} className="space-y-3">
            <div className="flex items-center gap-3">
              <h2 className="shrink-0 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {group.label}
              </h2>
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">
                {rows.length} {rows.length === 1 ? "partido" : "partidos"}
              </span>
            </div>

            {rows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-5 text-sm text-muted-foreground">
                Sin partidos para imprimir.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {rows.map((match) => {
                  const sets = setsByMatch.get(match.id) ?? [];
                  const dateLabel = match.playedOn
                    ? formatDate(match.playedOn)
                    : null;

                  return (
                    <article
                      key={match.id}
                      className="break-inside-avoid overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
                    >
                      <div className="flex items-center justify-between bg-court px-4 py-2.5 text-court-foreground">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-court-foreground/80">
                            {getTypeLabel(match.type)}
                          </span>
                          {dateLabel ? (
                            <>
                              <span className="text-court-foreground/30">
                                ·
                              </span>
                              <span className="text-xs font-medium">
                                {dateLabel}
                              </span>
                            </>
                          ) : null}
                        </div>
                        <span className="text-xs font-medium text-court-foreground/70">
                          {getStatusLabel(match.status)}
                        </span>
                      </div>
                      <div className="space-y-1 bg-card px-4 py-3">
                        <PlayerPrintLine
                          match={match}
                          name={match.player1Name}
                          playerId={match.player1Id}
                          playerIndex={1}
                          sets={sets}
                          points={
                            pointsByMatchPlayer.get(
                              `${match.id}:${match.player1Id}`,
                            ) ?? null
                          }
                          rankingPosition={
                            rankingByPlayer.get(match.player1Id) ?? null
                          }
                        />
                        <div className="my-0.5 border-t border-border/50" />
                        <PlayerPrintLine
                          match={match}
                          name={match.player2Name}
                          playerId={match.player2Id}
                          playerIndex={2}
                          sets={sets}
                          points={
                            pointsByMatchPlayer.get(
                              `${match.id}:${match.player2Id}`,
                            ) ?? null
                          }
                          rankingPosition={
                            rankingByPlayer.get(match.player2Id) ?? null
                          }
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

export default async function FixturePrintPage({
  searchParams,
}: FixturePrintPageProps) {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/");
  if (!db) notFound();

  const query = searchParams ? await searchParams : undefined;
  const weekId = query?.week;
  const scope = (
    query?.scope === "previous-results" ||
    query?.scope === "both" ||
    query?.scope === "matches"
      ? query.scope
      : "matches"
  ) as PrintScope;

  if (!weekId) notFound();

  const currentWeek = await getWeek(weekId);
  if (!currentWeek) notFound();

  const previousWeek =
    scope === "previous-results" || scope === "both"
      ? await getPreviousWeek(currentWeek)
      : null;

  const [currentMatches, previousMatches] = await Promise.all([
    scope === "matches" || scope === "both"
      ? getMatchesForWeek(currentWeek.id, false)
      : Promise.resolve([]),
    previousWeek && (scope === "previous-results" || scope === "both")
      ? getMatchesForWeek(previousWeek.id, true)
      : Promise.resolve([]),
  ]);

  const allMatches = [...currentMatches, ...previousMatches];
  const { setsByMatch, pointsByMatchPlayer, rankingByPlayer } =
    await getMatchDetails(allMatches);
  const printedAt = formatPrintedAt(new Date());

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground print:bg-white print:px-0 print:py-0">
      <AutoPrint />
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-sm print:hidden">
          <div>
            <p className="text-sm font-semibold">Documento de impresión</p>
            <p className="text-xs text-muted-foreground">
              Si el diálogo no se abre automáticamente, usa el botón.
            </p>
          </div>
          <PrintNowButton />
        </div>

        {(scope === "matches" || scope === "both") && (
          <PrintMatchesSection
            title={`Partidos semana ${formatWeekLabel(
              currentWeek.startsOn,
              currentWeek.endsOn,
            )}`}
            subtitle={`Actualizado ${printedAt}`}
            matchesList={currentMatches}
            setsByMatch={setsByMatch}
            pointsByMatchPlayer={pointsByMatchPlayer}
            rankingByPlayer={rankingByPlayer}
          />
        )}

        {(scope === "previous-results" || scope === "both") && (
          <PrintMatchesSection
            title={
              previousWeek
                ? `Resultados semana ${formatWeekLabel(
                    previousWeek.startsOn,
                    previousWeek.endsOn,
                  )}`
                : "Resultados semana anterior"
            }
            subtitle={
              previousWeek
                ? `Actualizado ${printedAt}`
                : "No hay una semana anterior registrada."
            }
            matchesList={previousMatches}
            setsByMatch={setsByMatch}
            pointsByMatchPlayer={pointsByMatchPlayer}
            rankingByPlayer={rankingByPlayer}
          />
        )}
      </div>
    </main>
  );
}
