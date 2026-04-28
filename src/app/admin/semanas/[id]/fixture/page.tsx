import { and, desc, eq, gt, gte, or, sql } from "drizzle-orm";
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
import { FixtureEditor } from "./editor";
import type { SerializedPair } from "./actions";

function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

export default async function FixturePage({
  params,
}: {
  params: Promise<{ id: string }>;
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
    .map((p) => ({ id: p.id, fullName: p.fullName, points: Number(p.points) }));

  const allActiveF = allPlayersRaw
    .filter((p) => p.gender === "F")
    .map((p) => ({ id: p.id, fullName: p.fullName, points: Number(p.points) }));

  const availableM = allPlayersRaw
    .filter((p) => p.gender === "M" && (p.maxMatches ?? 0) > 0)
    .map((p) => ({
      id: p.id,
      fullName: p.fullName,
      points: Number(p.points),
      maxMatches: p.maxMatches!,
    }));

  const availableF = allPlayersRaw
    .filter((p) => p.gender === "F" && (p.maxMatches ?? 0) > 0)
    .map((p) => ({
      id: p.id,
      fullName: p.fullName,
      points: Number(p.points),
      maxMatches: p.maxMatches!,
    }));

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
    recentOpponentsMap.get(m.player1Id)!.add(m.player2Id);
    recentOpponentsMap.get(m.player2Id)!.add(m.player1Id);
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

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5">
        <p className="text-sm font-medium text-emerald-700">
          <Link
            href="/admin/semanas"
            className="transition hover:text-emerald-900"
          >
            Admin › Semanas
          </Link>{" "}
          ›{" "}
          <Link
            href={`/admin/semanas/${weekId}`}
            className="transition hover:text-emerald-900"
          >
            {weekLabel}
          </Link>{" "}
          › Fixture
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Fixture — semana {weekLabel}
        </h1>
        {hasPublishedMatches && (
          <p className="mt-3 text-sm text-slate-600">
            Ya hay un fixture publicado para esta semana. Podés editarlo y
            republicar (solo reemplaza los partidos pendientes).
          </p>
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
