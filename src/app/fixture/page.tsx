import { and, asc, desc, eq, gt, inArray, lt, or, sql } from "drizzle-orm";
import { Check } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { WeekStepper } from "@/components/ui/week-stepper";
import { auth } from "@/lib/auth";
import { requireCompleteProfile } from "@/lib/auth/require-complete-profile";
import { db } from "@/lib/db";
import {
  matches,
  matchSets,
  players,
  rankingEvents,
  weeks,
} from "@/lib/db/schema";

type FixturePageProps = {
  searchParams?: Promise<{
    week?: string;
  }>;
};

function getInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

function formatPoints(points: number) {
  if (points > 0) return `+${points} pts`;
  if (points < 0) return `${points} pts`;
  return "0 pts";
}

function getTypeLabel(type: "sorteo" | "desafio" | "campeonato") {
  if (type === "desafio") return "Desafío";
  if (type === "campeonato") return "Campeonato";
  return " ";
}

function MatchStatusBadge({
  status,
  winnerName,
}: {
  status: string;
  winnerName: string | null;
}) {
  if (status === "confirmado") {
    const first = winnerName ? winnerName.split(" ")[0] : null;
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-grass">
      </span>
    );
  }
  const map: Record<string, { label: string; cls: string }> = {
    pendiente: { label: "Pendiente", cls: "text-white/40" },
    reportado: { label: "Reportado", cls: "text-clay" },
    wo: { label: "W.O.", cls: "text-destructive" },
    empate: { label: "Empate", cls: "text-white/55" },
  };
  const conf = map[status] ?? { label: status, cls: "text-white/40" };
  return (
    <span className={`text-xs font-medium ${conf.cls}`}>{conf.label}</span>
  );
}

type SetRow = {
  matchId: string;
  setNumber: number;
  gamesP1: number;
  gamesP2: number;
  tiebreakP1: number | null;
  tiebreakP2: number | null;
};

function PlayerScoreLine({
  name,
  isWinner,
  hasWinner,
  points,
  sets,
  playerIndex,
}: {
  name: string;
  isWinner: boolean;
  hasWinner: boolean;
  points: number | null;
  sets: SetRow[];
  playerIndex: 1 | 2;
}) {
  const isLoser = hasWinner && !isWinner;

  return (
    <div className="flex items-center gap-2.5">
      {/* Status dot */}
      <div
        className={`size-2 shrink-0 rounded-full ${
          isWinner ? "bg-foreground" : "bg-border"
        }`}
      />

      {/* Avatar circle */}
      <span
        className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
          isWinner
            ? "bg-foreground text-background"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {getInitials(name)}
      </span>

      {/* Name + points */}
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm leading-tight ${
            isLoser
              ? "text-muted-foreground"
              : "font-semibold text-foreground"
          }`}
        >
          {name}
        </p>
        {points !== null && (
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
        )}
      </div>

      {/* Winner check / spacer */}
      {isWinner ? (
        <Check className="size-3.5 shrink-0 text-grass" />
      ) : hasWinner ? (
        <span className="size-3.5 shrink-0" />
      ) : null}

      {/* Set scores */}
      <div className="flex gap-3 pl-1">
        {sets.length > 0 ? (
          sets.map((set) => (
            <span
              key={set.setNumber}
              className={`w-4 text-center text-sm tabular-nums ${
                isLoser
                  ? "text-muted-foreground"
                  : "font-bold text-foreground"
              }`}
            >
              {playerIndex === 1 ? set.gamesP1 : set.gamesP2}
            </span>
          ))
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </div>
    </div>
  );
}

export default async function FixturePage({ searchParams }: FixturePageProps) {
  const session = await auth();
  const query = searchParams ? await searchParams : undefined;
  const requestedWeekId = query?.week;

  if (session?.user?.role !== "admin" && session?.user) {
    await requireCompleteProfile();
  }

  if (!db) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <div className="w-full rounded-3xl bg-card p-8 shadow-sm ring-1 ring-black/5">
          <p className="text-sm text-muted-foreground">
            Base de datos no configurada.
          </p>
        </div>
      </div>
    );
  }

  const allowedStatuses =
    session?.user?.role === "admin"
      ? (["borrador", "abierta", "cerrada"] as const)
      : (["cerrada"] as const);

  const isHistoryView = !requestedWeekId;
  const currentWeekRows = requestedWeekId
    ? await db
        .selectDistinct({
          id: weeks.id,
          seasonId: weeks.seasonId,
          startsOn: weeks.startsOn,
          endsOn: weeks.endsOn,
          status: weeks.status,
        })
        .from(weeks)
        .innerJoin(matches, eq(matches.weekId, weeks.id))
        .where(
          and(
            eq(weeks.id, requestedWeekId),
            inArray(weeks.status, allowedStatuses),
          ),
        )
        .limit(1)
    : [];

  const currentWeek = currentWeekRows[0] ?? null;

  if (!isHistoryView && !currentWeek) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <EmptyState
          title="Sin partidos"
          description="Esta semana no tiene partidos publicados."
        />
      </div>
    );
  }

  const [prevWeekRows, nextWeekRows] = currentWeek
    ? await Promise.all([
        db
          .select({ id: weeks.id })
          .from(weeks)
          .where(
            and(
              eq(weeks.seasonId, currentWeek.seasonId),
              lt(weeks.startsOn, currentWeek.startsOn),
              inArray(weeks.status, allowedStatuses),
            ),
          )
          .orderBy(desc(weeks.startsOn))
          .limit(1),
        db
          .select({ id: weeks.id })
          .from(weeks)
          .where(
            and(
              eq(weeks.seasonId, currentWeek.seasonId),
              gt(weeks.startsOn, currentWeek.startsOn),
              inArray(weeks.status, allowedStatuses),
            ),
          )
          .orderBy(asc(weeks.startsOn))
          .limit(1),
      ])
    : [[], []];

  let myPlayerId: string | null = null;
  if (session?.user?.email) {
    const [myPlayer] = await db
      .select({ id: players.id })
      .from(players)
      .where(eq(players.email, session.user.email.toLowerCase()))
      .limit(1);
    myPlayerId = myPlayer?.id ?? null;
  }

  const matchVisibilityCondition = currentWeek
    ? eq(matches.weekId, currentWeek.id)
    : session?.user?.role === "admin"
      ? undefined
      : or(
          sql`${matches.status} in ('confirmado', 'empate', 'wo')`,
          eq(weeks.status, "cerrada"),
        );

  const weekMatches = await db
    .select({
      id: matches.id,
      category: matches.category,
      player1Id: matches.player1Id,
      player2Id: matches.player2Id,
      player1Name: players.fullName,
      player2Name: sql<string>`players_p2.full_name`,
      status: matches.status,
      winnerId: matches.winnerId,
      winnerName: sql<string | null>`players_winner.full_name`,
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
    .leftJoin(
      sql`players as players_winner`,
      sql`${matches.winnerId} = players_winner.id`,
    )
    .where(matchVisibilityCondition)
    .orderBy(
      matches.category,
      desc(sql`coalesce(${matches.playedOn}, ${weeks.startsOn})`),
      desc(matches.confirmedAt),
      desc(matches.createdAt),
      players.fullName,
    );

  const matchesM = weekMatches.filter((m) => m.category === "M");
  const matchesF = weekMatches.filter((m) => m.category === "F");
  const matchIds = weekMatches.map((m) => m.id);

  const [allSets, pointRows] = matchIds.length
    ? await Promise.all([
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
      ])
    : [[], []];

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

  const weekLabel = currentWeek
    ? `${formatDate(currentWeek.startsOn)}–${formatDate(currentWeek.endsOn)}`
    : null;
  const isClosedWeek = currentWeek?.status === "cerrada";

  return (
    <div className="flex w-full flex-1 bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6">

        {/* ── Hero header ── */}
        <div
          className="relative overflow-hidden rounded-3xl shadow-md"
          style={{
            background:
              "linear-gradient(140deg, #0b1d4f 0%, #1640a0 55%, #0d2460 100%)",
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
          <div className="relative flex flex-col gap-5 p-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-300/80">
                Escalerilla · Partidos
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
                {weekLabel ? `Semana ${weekLabel}` : "Historial de partidos"}
              </h1>
              <p className="mt-1.5 text-sm text-white/50">
                {isHistoryView
                  ? "Todos los partidos registrados, ordenados desde el más reciente."
                  : isClosedWeek
                    ? "Estás viendo una semana cerrada en modo solo lectura."
                    : myPlayerId
                      ? "Tus partidos están resaltados."
                      : !session?.user
                        ? null
                        : null}
              </p>
              {!session?.user && !isHistoryView && (
                <p className="mt-1.5 text-sm text-white/50">
                  <Link
                    href="/login"
                    className="text-blue-300 hover:underline"
                  >
                    Ingresá
                  </Link>{" "}
                  para ver tus partidos resaltados.
                </p>
              )}
            </div>
            {weekLabel && (
              <WeekStepper
                label={weekLabel}
                previousHref={
                  prevWeekRows[0]
                    ? `/fixture?week=${prevWeekRows[0].id}`
                    : null
                }
                nextHref={
                  nextWeekRows[0]
                    ? `/fixture?week=${nextWeekRows[0].id}`
                    : null
                }
              />
            )}
          </div>
        </div>

        {/* ── Category sections ── */}
        {(
          [
            { cat: "M", label: "Hombres", rows: matchesM },
            { cat: "F", label: "Mujeres", rows: matchesF },
          ] as const
        ).map(({ cat, label, rows }) => (
          <section
            key={cat}
            className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm ring-1 ring-court/5"
          >
            {/* Section header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="flex size-7 items-center justify-center rounded-full bg-court text-xs font-bold text-court-foreground">
                  {cat}
                </span>
                <h2 className="font-semibold text-foreground">{label}</h2>
              </div>
              {rows.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {rows.length}{" "}
                  {rows.length === 1 ? "partido" : "partidos"}
                </span>
              )}
            </div>

            <div className="p-6">
              {rows.length === 0 ? (
                <EmptyState
                  title="Sin partidos"
                  description={
                    isHistoryView
                      ? "Todavía no hay partidos registrados."
                      : "Esta semana no tiene partidos publicados."
                  }
                />
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {rows.map((match) => {
                    const isMyMatch =
                      myPlayerId !== null &&
                      (match.player1Id === myPlayerId ||
                        match.player2Id === myPlayerId);
                    const sets = setsByMatch.get(match.id) ?? [];
                    const hasWinner = match.winnerId !== null;

                    const typeColor =
                      match.type === "desafio"
                        ? "text-clay"
                        : match.type === "campeonato"
                          ? "text-gold"
                          : "text-white/50";

                    const dateLabel = match.playedOn
                      ? formatDate(match.playedOn)
                      : match.weekStartsOn && match.weekEndsOn
                        ? `${formatDate(match.weekStartsOn)}–${formatDate(match.weekEndsOn)}`
                        : "Sin fecha";

                    return (
                      <div
                        key={match.id}
                        className={`overflow-hidden rounded-2xl border shadow-sm ${
                          isMyMatch
                            ? "border-clay/40 ring-1 ring-clay/15"
                            : "border-border"
                        }`}
                      >
                        {/* Dark card header */}
                        <div className="flex items-center justify-between bg-court px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-xs font-semibold ${typeColor}`}
                            >
                              {getTypeLabel(match.type)}
                            </span>
                            <span className="text-white/20">·</span>
                            <span className="text-xs text-white/40">
                              {dateLabel}
                            </span>
                          </div>
                          <MatchStatusBadge
                            status={match.status}
                            winnerName={match.winnerName}
                          />
                        </div>

                        {/* Players */}
                        <div className="space-y-1 bg-card px-4 py-3">
                          <PlayerScoreLine
                            name={match.player1Name}
                            isWinner={match.winnerId === match.player1Id}
                            hasWinner={hasWinner}
                            points={
                              pointsByMatchPlayer.get(
                                `${match.id}:${match.player1Id}`,
                              ) ?? null
                            }
                            sets={sets}
                            playerIndex={1}
                          />
                          <div className="border-t border-border/50 my-0.5" />
                          <PlayerScoreLine
                            name={match.player2Name}
                            isWinner={match.winnerId === match.player2Id}
                            hasWinner={hasWinner}
                            points={
                              pointsByMatchPlayer.get(
                                `${match.id}:${match.player2Id}`,
                              ) ?? null
                            }
                            sets={sets}
                            playerIndex={2}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
