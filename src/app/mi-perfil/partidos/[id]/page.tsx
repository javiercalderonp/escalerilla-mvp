import { and, eq, or, sql } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { matches, matchSets, players, weeks } from "@/lib/db/schema";

type MatchDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

type MatchDetailRow = {
  id: string;
  playedOn: string | null;
  status: "confirmado" | "wo" | "empate";
  type: "sorteo" | "desafio" | "campeonato";
  format: "mr3" | "set_largo" | null;
  winnerId: string | null;
  woLoserId: string | null;
  weekStartsOn: string | null;
  weekEndsOn: string | null;
  player1Id: string;
  player2Id: string;
  player1Name: string;
  player2Name: string;
};

type MatchSetRow = {
  setNumber: number;
  gamesP1: number;
  gamesP2: number;
  tiebreakP1: number | null;
  tiebreakP2: number | null;
};

function formatDate(value: string | null) {
  if (!value) return "Sin fecha";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatWeekLabel(start: string | null, end: string | null) {
  if (!start || !end) return "Sin semana asociada";
  return `${formatDate(start)} – ${formatDate(end)}`;
}

function formatTypeLabel(type: MatchDetailRow["type"]) {
  if (type === "desafio") return "Desafío";
  if (type === "campeonato") return "Partido";
  return "Sorteo";
}

function formatStatusLabel(match: MatchDetailRow, playerId: string) {
  if (match.status === "empate") {
    return { label: "Empate", tone: "bg-blue-50 text-blue-700" };
  }

  if (match.winnerId === playerId) {
    return {
      label: match.status === "wo" ? "Ganado por W.O." : "Ganado",
      tone: "bg-emerald-50 text-emerald-700",
    };
  }

  return {
    label: match.status === "wo" ? "Perdido por W.O." : "Perdido",
    tone: "bg-rose-50 text-rose-700",
  };
}

export default async function MatchDetailPage({
  params,
}: MatchDetailPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!db) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
          Base de datos no configurada.
        </div>
      </main>
    );
  }

  const userEmail = session.user.email?.toLowerCase();

  if (!userEmail) {
    redirect("/login");
  }

  const [player] = await db
    .select({ id: players.id })
    .from(players)
    .where(eq(players.email, userEmail))
    .limit(1);

  if (!player?.id) {
    redirect("/mi-perfil");
  }

  const playerId = player.id;

  const { id } = await params;

  const [match] = (await db
    .select({
      id: matches.id,
      playedOn: matches.playedOn,
      status: matches.status,
      type: matches.type,
      format: matches.format,
      winnerId: matches.winnerId,
      woLoserId: matches.woLoserId,
      weekStartsOn: weeks.startsOn,
      weekEndsOn: weeks.endsOn,
      player1Id: matches.player1Id,
      player2Id: matches.player2Id,
      player1Name: players.fullName,
      player2Name: sql<string>`players_p2.full_name`,
    })
    .from(matches)
    .leftJoin(weeks, eq(matches.weekId, weeks.id))
    .innerJoin(players, eq(matches.player1Id, players.id))
    .innerJoin(
      sql`players as players_p2`,
      sql`${matches.player2Id} = players_p2.id`,
    )
    .where(
      and(
        eq(matches.id, id),
        or(eq(matches.player1Id, playerId), eq(matches.player2Id, playerId)),
        sql`${matches.status} in ('confirmado', 'empate', 'wo')`,
      ),
    )
    .limit(1)) as MatchDetailRow[];

  if (!match) {
    notFound();
  }

  const sets = (await db
    .select({
      setNumber: matchSets.setNumber,
      gamesP1: matchSets.gamesP1,
      gamesP2: matchSets.gamesP2,
      tiebreakP1: matchSets.tiebreakP1,
      tiebreakP2: matchSets.tiebreakP2,
    })
    .from(matchSets)
    .where(eq(matchSets.matchId, match.id))) as MatchSetRow[];

  const outcome = formatStatusLabel(match, playerId);
  const opponentName =
    match.player1Id === playerId ? match.player2Name : match.player1Name;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-700">
              Mi perfil · Partido
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              vs {opponentName}
            </h1>
            <p className="mt-3 text-sm text-slate-600">
              {formatTypeLabel(match.type)} · {match.format ?? "sin formato"} ·
              Semana {formatWeekLabel(match.weekStartsOn, match.weekEndsOn)}
            </p>
          </div>
          <span
            className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${outcome.tone}`}
          >
            {outcome.label}
          </span>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 p-4">
            <p className="text-sm text-slate-500">Fecha jugada</p>
            <p className="mt-2 text-lg font-semibold text-slate-950">
              {formatDate(match.playedOn)}
            </p>
          </article>
          <article className="rounded-2xl border border-slate-200 p-4">
            <p className="text-sm text-slate-500">Cruce</p>
            <p className="mt-2 text-lg font-semibold text-slate-950">
              {match.player1Name} vs {match.player2Name}
            </p>
          </article>
        </div>

        {match.status === "wo" ? (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            W.O. registrado. Ganador:{" "}
            {match.winnerId === match.player1Id
              ? match.player1Name
              : match.player2Name}
            . Perdedor por W.O.:{" "}
            {match.woLoserId === match.player1Id
              ? match.player1Name
              : match.player2Name}
            .
          </div>
        ) : sets.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 px-6 py-8 text-center text-sm text-slate-500">
            No hay sets guardados para este partido.
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {sets
              .sort((a, b) => a.setNumber - b.setNumber)
              .map((set) => (
                <article
                  key={set.setNumber}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <p className="text-sm text-slate-500">Set {set.setNumber}</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">
                    {match.player1Name} {set.gamesP1} — {set.gamesP2}{" "}
                    {match.player2Name}
                  </p>
                  {set.tiebreakP1 != null && set.tiebreakP2 != null ? (
                    <p className="mt-2 text-sm text-slate-600">
                      Tie-break: {set.tiebreakP1} — {set.tiebreakP2}
                    </p>
                  ) : null}
                </article>
              ))}
          </div>
        )}

        <div className="mt-6">
          <Link
            href="/mi-perfil"
            className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400"
          >
            Volver a mi perfil
          </Link>
        </div>
      </section>
    </main>
  );
}
