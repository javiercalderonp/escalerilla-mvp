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
import { proposeFixture } from "@/lib/fixture/propose";
import { AddPlayersDialog } from "../add-players-dialog";
import type { SerializedPair } from "./actions";
import { FixtureEditor } from "./editor";

function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
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

  const allActiveM = allPlayersRaw
    .filter((p) => p.gender === "M")
    .map((p) => ({
      id: p.id,
      fullName: p.fullName,
      points: Number(p.points),
      maxMatches: p.maxMatches ?? 0,
    }));

  const allActiveF = allPlayersRaw
    .filter((p) => p.gender === "F")
    .map((p) => ({
      id: p.id,
      fullName: p.fullName,
      points: Number(p.points),
      maxMatches: p.maxMatches ?? 0,
    }));

  const availableM = allPlayersRaw
    .filter((p) => p.gender === "M" && (p.maxMatches ?? 0) > 0)
    .map((p) => ({
      id: p.id,
      fullName: p.fullName,
      points: Number(p.points),
      maxMatches: p.maxMatches ?? 0,
    }));

  const availableF = allPlayersRaw
    .filter((p) => p.gender === "F" && (p.maxMatches ?? 0) > 0)
    .map((p) => ({
      id: p.id,
      fullName: p.fullName,
      points: Number(p.points),
      maxMatches: p.maxMatches ?? 0,
    }));

  // Build addable player lists for the dialog
  const addedPlayerIds = new Set(
    allPlayersRaw
      .filter((p) => (p.maxMatches ?? 0) > 0)
      .map((p) => p.id),
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
    .map((p) => ({ id: p.id, fullName: p.fullName, isAdded: addedPlayerIds.has(p.id) }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  const addableWomen = allPlayersRaw
    .filter((p) => p.gender === "F")
    .map((p) => ({ id: p.id, fullName: p.fullName, isAdded: addedPlayerIds.has(p.id) }))
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

  const initialPairsM: SerializedPair[] =
    existingM.length > 0
      ? existingM.map((m) => ({
          p1Id: m.player1Id,
          p1Name: m.player1Name,
          p2Id: m.player2Id,
          p2Name: m.player2Name,
        }))
      : proposeFixture(availableM, recentOpponentsMap).map((pair) => ({
          p1Id: pair.player1.id,
          p1Name: pair.player1.fullName,
          p2Id: pair.player2.id,
          p2Name: pair.player2.fullName,
        }));

  const initialPairsF: SerializedPair[] =
    existingF.length > 0
      ? existingF.map((m) => ({
          p1Id: m.player1Id,
          p1Name: m.player1Name,
          p2Id: m.player2Id,
          p2Name: m.player2Name,
        }))
      : proposeFixture(availableF, recentOpponentsMap).map((pair) => ({
          p1Id: pair.player1.id,
          p1Name: pair.player1.fullName,
          p2Id: pair.player2.id,
          p2Name: pair.player2.fullName,
        }));

  const weekLabel = `${formatDate(week.startsOn)}–${formatDate(week.endsOn)}`;
  const hasPublishedMatches = existingMatchRows.length > 0;

  // Players sorted by name for the selected list
  const selectedPlayersM = availableM.slice().sort((a, b) => a.fullName.localeCompare(b.fullName));
  const selectedPlayersF = availableF.slice().sort((a, b) => a.fullName.localeCompare(b.fullName));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <section className="rounded-lg bg-white p-8 shadow-sm ring-1 ring-black/5">
        <p className="text-sm font-medium text-emerald-700">
          <Link
            href="/admin/semanas"
            className="transition hover:text-emerald-900"
          >
            Admin › Programación
          </Link>{" "}
          › Cruces
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Semana {weekLabel}
        </h1>
        {hasPublishedMatches && (
          <p className="mt-3 text-sm text-slate-600">
            Ya hay cruces publicados para esta semana. Podés editarlos y
            republicar la programación.
          </p>
        )}
      </section>

      {/* Player management */}
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Jugadores de la semana
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {addedPlayerIds.size === 0
                ? "Seleccioná los jugadores que participan esta semana."
                : `${addedPlayerIds.size} jugador${addedPlayerIds.size !== 1 ? "es" : ""} seleccionado${addedPlayerIds.size !== 1 ? "s" : ""}`}
            </p>
          </div>
          <AddPlayersDialog
            weekId={weekId}
            label="la semana"
            players={addablePlayers}
            defaultOpen={query.agregarJugadores === "1"}
            triggerLabel="Agregar jugadores"
          />
        </div>

        {addedPlayerIds.size > 0 && (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {selectedPlayersM.length > 0 && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Hombres · {selectedPlayersM.length}
                  </p>
                  <AddPlayersDialog
                    weekId={weekId}
                    label="Hombres"
                    players={addableMen}
                  />
                </div>
                <ul className="space-y-1">
                  {selectedPlayersM.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-slate-900">{p.fullName}</span>
                      <span className="text-xs text-slate-500">
                        {p.maxMatches} partido{p.maxMatches !== 1 ? "s" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {selectedPlayersF.length > 0 && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Mujeres · {selectedPlayersF.length}
                  </p>
                  <AddPlayersDialog
                    weekId={weekId}
                    label="Mujeres"
                    players={addableWomen}
                  />
                </div>
                <ul className="space-y-1">
                  {selectedPlayersF.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-slate-900">{p.fullName}</span>
                      <span className="text-xs text-slate-500">
                        {p.maxMatches} partido{p.maxMatches !== 1 ? "s" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      <FixtureEditor
        weekId={weekId}
        weekLabel={weekLabel}
        allActivePlayersM={allActiveM}
        allActivePlayersF={allActiveF}
        availableCountM={availableM.length}
        availableCountF={availableF.length}
        recentOpponentMap={recentOpponentMap}
        initialPairsM={initialPairsM}
        initialPairsF={initialPairsF}
        hasPublishedMatches={hasPublishedMatches}
      />
    </div>
  );
}
