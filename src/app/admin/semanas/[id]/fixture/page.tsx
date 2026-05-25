import { and, desc, eq, gte, or, sql } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  availability,
  matches,
  players,
  rankingEvents,
  weeks,
} from "@/lib/db/schema";
import {
  fetchPairHistorySummaries,
  getPairHistoryForPlayers,
} from "@/lib/fixture/head-to-head";
import { buildMatchmakingPlayers, proposeFixture } from "@/lib/fixture/propose";
import { getRanking } from "@/lib/ranking";
import type { SerializedPair } from "./actions";
import { FixtureEditor } from "./editor";

function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

function formatWeekStartLabel(dateStr: string) {
  const [year, month, day] = dateStr.split("-");
  const monthNames: Record<string, string> = {
    "01": "enero",
    "02": "febrero",
    "03": "marzo",
    "04": "abril",
    "05": "mayo",
    "06": "junio",
    "07": "julio",
    "08": "agosto",
    "09": "septiembre",
    "10": "octubre",
    "11": "noviembre",
    "12": "diciembre",
  };

  if (!year || !month || !day) return dateStr;

  return `${Number(day)} de ${monthNames[month] ?? month} de ${year}`;
}

type PlayerRecentResult = "W" | "L" | "E";

function getRecentResultForPlayer(
  match: {
    player1Id: string;
    player2Id: string;
    status: "confirmado" | "wo" | "empate";
    winnerId: string | null;
  },
  playerId: string,
): PlayerRecentResult | null {
  if (match.status === "empate") return "E";
  if (!match.winnerId) return null;
  return match.winnerId === playerId ? "W" : "L";
}

export default async function FixturePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ agregarJugadores?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") redirect("/");

  if (!db) {
    return (
      <div className="p-10 text-center text-sm text-slate-600">
        Base de datos no configurada.
      </div>
    );
  }

  const { id: weekId } = await params;
  const query = searchParams ? await searchParams : {};

  const [week] = await db
    .select()
    .from(weeks)
    .where(eq(weeks.id, weekId))
    .limit(1);

  if (!week) notFound();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().slice(0, 10);

  // All active players with ranking points + availability for this week
  const allPlayersRaw = await db
    .select({
      id: players.id,
      fullName: players.fullName,
      gender: players.gender,
      maxMatches: availability.maxMatches,
      points: sql<number>`coalesce(sum(${rankingEvents.delta}), 0)`,
    })
    .from(players)
    .leftJoin(
      availability,
      and(
        eq(availability.playerId, players.id),
        eq(availability.weekId, weekId),
      ),
    )
    .leftJoin(rankingEvents, eq(rankingEvents.playerId, players.id))
    .where(eq(players.status, "activo"))
    .groupBy(
      players.id,
      players.fullName,
      players.gender,
      availability.maxMatches,
    )
    .orderBy(desc(sql<number>`coalesce(sum(${rankingEvents.delta}), 0)`));

  const confirmedMatchRows = await db
    .select({
      player1Id: matches.player1Id,
      player2Id: matches.player2Id,
      winnerId: matches.winnerId,
    })
    .from(matches)
    .where(eq(matches.status, "confirmado"));

  const recentResultRows = await db
    .select({
      player1Id: matches.player1Id,
      player2Id: matches.player2Id,
      status: matches.status,
      winnerId: matches.winnerId,
      playedOn: matches.playedOn,
      confirmedAt: matches.confirmedAt,
      createdAt: matches.createdAt,
    })
    .from(matches)
    .where(
      or(
        eq(matches.status, "confirmado"),
        eq(matches.status, "wo"),
        eq(matches.status, "empate"),
      ),
    )
    .orderBy(
      desc(
        sql`coalesce(${matches.playedOn}, ${matches.confirmedAt}::date, ${matches.createdAt}::date)`,
      ),
    );

  const recentResultsByPlayer = new Map<string, PlayerRecentResult[]>();
  for (const match of recentResultRows) {
    for (const playerId of [match.player1Id, match.player2Id]) {
      const currentResults = recentResultsByPlayer.get(playerId) ?? [];
      if (currentResults.length >= 5) continue;

      const result = getRecentResultForPlayer(
        {
          player1Id: match.player1Id,
          player2Id: match.player2Id,
          status: match.status as "confirmado" | "wo" | "empate",
          winnerId: match.winnerId,
        },
        playerId,
      );

      if (result) {
        currentResults.push(result);
        recentResultsByPlayer.set(playerId, currentResults);
      }
    }
  }

  const [rankingM, rankingF] = await Promise.all([
    getRanking("hombres"),
    getRanking("mujeres"),
  ]);
  const rankingPositionByPlayer = new Map(
    [...rankingM, ...rankingF].map((entry) => [entry.id, entry.position]),
  );

  const allActiveM = allPlayersRaw
    .filter((p) => p.gender === "M")
    .map((p) => ({
      id: p.id,
      fullName: p.fullName,
      points: Number(p.points),
      maxMatches: p.maxMatches ?? 0,
      rankingPosition: rankingPositionByPlayer.get(p.id) ?? null,
      recentResults: recentResultsByPlayer.get(p.id) ?? [],
    }));

  const allActiveF = allPlayersRaw
    .filter((p) => p.gender === "F")
    .map((p) => ({
      id: p.id,
      fullName: p.fullName,
      points: Number(p.points),
      maxMatches: p.maxMatches ?? 0,
      rankingPosition: rankingPositionByPlayer.get(p.id) ?? null,
      recentResults: recentResultsByPlayer.get(p.id) ?? [],
    }));

  const availableM = buildMatchmakingPlayers(
    allPlayersRaw
      .filter((p) => p.gender === "M" && (p.maxMatches ?? 0) > 0)
      .map((p) => ({
        id: p.id,
        fullName: p.fullName,
        points: Number(p.points),
        maxMatches: p.maxMatches ?? 0,
      })),
    confirmedMatchRows,
  );

  const availableF = buildMatchmakingPlayers(
    allPlayersRaw
      .filter((p) => p.gender === "F" && (p.maxMatches ?? 0) > 0)
      .map((p) => ({
        id: p.id,
        fullName: p.fullName,
        points: Number(p.points),
        maxMatches: p.maxMatches ?? 0,
      })),
    confirmedMatchRows,
  );

  // Build addable player lists for the dialog
  const addedPlayerIds = new Set(
    allPlayersRaw.filter((p) => (p.maxMatches ?? 0) > 0).map((p) => p.id),
  );

  const addablePlayers = allPlayersRaw
    .map((p) => ({
      id: p.id,
      fullName: `${p.fullName} · ${p.gender === "M" ? "Hombres" : "Mujeres"}`,
      isAdded: addedPlayerIds.has(p.id),
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  const addableMen = allPlayersRaw
    .filter((p) => p.gender === "M")
    .map((p) => ({
      id: p.id,
      fullName: p.fullName,
      isAdded: addedPlayerIds.has(p.id),
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  const addableWomen = allPlayersRaw
    .filter((p) => p.gender === "F")
    .map((p) => ({
      id: p.id,
      fullName: p.fullName,
      isAdded: addedPlayerIds.has(p.id),
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  // Recent opponents (last 30 days) for RN-03 validation
  const recentMatchRows = await db
    .select({
      player1Id: matches.player1Id,
      player2Id: matches.player2Id,
    })
    .from(matches)
    .where(
      and(
        or(eq(matches.status, "confirmado"), eq(matches.status, "wo")),
        gte(matches.playedOn, thirtyDaysAgoStr),
      ),
    );

  const recentOpponentsMap = new Map<string, Set<string>>();
  for (const m of recentMatchRows) {
    if (!recentOpponentsMap.has(m.player1Id))
      recentOpponentsMap.set(m.player1Id, new Set());
    if (!recentOpponentsMap.has(m.player2Id))
      recentOpponentsMap.set(m.player2Id, new Set());
    recentOpponentsMap.get(m.player1Id)?.add(m.player2Id);
    recentOpponentsMap.get(m.player2Id)?.add(m.player1Id);
  }

  const recentOpponentMap: Record<string, string[]> = {};
  for (const [id, opponents] of recentOpponentsMap.entries()) {
    recentOpponentMap[id] = [...opponents];
  }

  // Existing matches for this week
  const existingMatchRows = await db
    .select({
      category: matches.category,
      player1Id: matches.player1Id,
      player2Id: matches.player2Id,
      player1Name: players.fullName,
      player2Name: sql<string>`players_p2.full_name`,
      type: matches.type,
    })
    .from(matches)
    .innerJoin(players, eq(matches.player1Id, players.id))
    .innerJoin(
      sql`players as players_p2`,
      sql`${matches.player2Id} = players_p2.id`,
    )
    .where(eq(matches.weekId, weekId));

  const existingM = existingMatchRows.filter((m) => m.category === "M");
  const existingF = existingMatchRows.filter((m) => m.category === "F");
  const pairHistoriesByPair = await fetchPairHistorySummaries(
    db,
    allPlayersRaw.map((player) => player.id),
  );

  const initialPairsM: SerializedPair[] =
    existingM.length > 0
      ? existingM.map((m) => ({
          p1Id: m.player1Id,
          p1Name: m.player1Name,
          p2Id: m.player2Id,
          p2Name: m.player2Name,
          isChallenge: m.type === "desafio",
          history: getPairHistoryForPlayers(
            pairHistoriesByPair,
            m.player1Id,
            m.player2Id,
          ),
        }))
      : proposeFixture(availableM, recentOpponentsMap).map((pair) => ({
          p1Id: pair.player1.id,
          p1Name: pair.player1.fullName,
          p2Id: pair.player2.id,
          p2Name: pair.player2.fullName,
          isChallenge: false,
          history: getPairHistoryForPlayers(
            pairHistoriesByPair,
            pair.player1.id,
            pair.player2.id,
          ),
        }));

  const initialPairsF: SerializedPair[] =
    existingF.length > 0
      ? existingF.map((m) => ({
          p1Id: m.player1Id,
          p1Name: m.player1Name,
          p2Id: m.player2Id,
          p2Name: m.player2Name,
          isChallenge: m.type === "desafio",
          history: getPairHistoryForPlayers(
            pairHistoriesByPair,
            m.player1Id,
            m.player2Id,
          ),
        }))
      : proposeFixture(availableF, recentOpponentsMap).map((pair) => ({
          p1Id: pair.player1.id,
          p1Name: pair.player1.fullName,
          p2Id: pair.player2.id,
          p2Name: pair.player2.fullName,
          isChallenge: false,
          history: getPairHistoryForPlayers(
            pairHistoriesByPair,
            pair.player1.id,
            pair.player2.id,
          ),
        }));

  const weekLabel = `${formatDate(week.startsOn)}–${formatDate(week.endsOn)}`;
  const weekStartLabel = formatWeekStartLabel(week.startsOn);
  const hasPublishedMatches = existingMatchRows.length > 0;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <section className="overflow-hidden rounded-lg border border-court/10 bg-card shadow-sm">
        <div className="p-8">
          <p className="text-sm font-medium text-clay">
            <Link
              href="/admin/semanas"
              className="transition hover:text-clay/80"
            >
              Admin › Programación
            </Link>{" "}
            › Cruces
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Semana {weekStartLabel}
          </h1>
          {hasPublishedMatches && (
            <p className="mt-3 text-sm text-slate-600">
              Ya hay cruces publicados para esta semana. Puedes editarlos y
              republicar la programación.
            </p>
          )}
        </div>
      </section>

      <FixtureEditor
        weekId={weekId}
        weekLabel={weekLabel}
        allActivePlayersM={allActiveM}
        allActivePlayersF={allActiveF}
        initialPairsM={initialPairsM}
        initialPairsF={initialPairsF}
        pairHistoriesByPair={pairHistoriesByPair}
        hasPublishedMatches={hasPublishedMatches}
        addablePlayers={addablePlayers}
        addableMen={addableMen}
        addableWomen={addableWomen}
        defaultAddPlayersOpen={query.agregarJugadores === "1"}
      />
    </div>
  );
}
