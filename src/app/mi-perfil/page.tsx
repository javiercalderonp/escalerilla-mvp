import { and, desc, eq, or, sql } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { requireCompleteProfile } from "@/lib/auth/require-complete-profile";
import { db } from "@/lib/db";
import { matches, matchSets, players } from "@/lib/db/schema";
import {
  getRanking,
  type RankingCategory,
  rankingCategoryLabels,
} from "@/lib/ranking";

type ResolvedStatus = "confirmado" | "wo" | "empate";

type MatchHistoryRow = {
  id: string;
  playedOn: string | null;
  status: ResolvedStatus;
  type: "sorteo" | "desafio" | "campeonato";
  format: "mr3" | "set_largo" | null;
  winnerId: string | null;
  player1Id: string;
  player2Id: string;
  player1Name: string;
  player2Name: string;
};

type MatchSetRow = {
  matchId: string;
  setNumber: number;
  gamesP1: number;
  gamesP2: number;
  tiebreakP1: number | null;
  tiebreakP2: number | null;
};

function getTodayInSantiago() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDays(dateStr: string, days: number) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getMonthStart(dateStr: string) {
  return `${dateStr.slice(0, 7)}-01`;
}

function getWeekStart(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const jsDay = date.getUTCDay();
  const diff = jsDay === 0 ? -6 : 1 - jsDay;
  return addDays(dateStr, diff);
}

function getWeekEnd(weekStart: string) {
  return addDays(weekStart, 6);
}

function getMatchWeekGroup(match: MatchHistoryRow) {
  if (!match.playedOn) {
    return {
      key: "sin-fecha",
      label: "Sin semana asignada",
    };
  }

  const startsOn = getWeekStart(match.playedOn);
  const endsOn = getWeekEnd(startsOn);

  return {
    key: startsOn,
    label: `Semana ${formatDate(startsOn)} al ${formatDate(endsOn)}`,
  };
}

function formatDate(value: string | null) {
  if (!value) return "Sin fecha";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function getCounterTone(current: number, target: number) {
  const ratio = target <= 0 ? 0 : current / target;

  if (ratio >= 1) {
    return "text-rose-700 bg-rose-50 border-rose-200";
  }

  if (ratio >= 0.7) {
    return "text-amber-700 bg-amber-50 border-amber-200";
  }

  return "text-emerald-700 bg-emerald-50 border-emerald-200";
}

function formatScore(
  match: MatchHistoryRow,
  playerId: string,
  sets: MatchSetRow[],
) {
  if (match.status === "wo") {
    return "W.O.";
  }

  const orderedSets = [...sets].sort((a, b) => a.setNumber - b.setNumber);

  if (orderedSets.length === 0) {
    return match.status === "empate" ? "Empate" : "Resultado confirmado";
  }

  return orderedSets
    .map((set) => {
      const isPlayer1 = match.player1Id === playerId;
      const playerGames = isPlayer1 ? set.gamesP1 : set.gamesP2;
      const opponentGames = isPlayer1 ? set.gamesP2 : set.gamesP1;
      const base = `${playerGames}-${opponentGames}`;
      if (set.tiebreakP1 != null && set.tiebreakP2 != null) {
        const playerTiebreak = isPlayer1 ? set.tiebreakP1 : set.tiebreakP2;
        const opponentTiebreak = isPlayer1 ? set.tiebreakP2 : set.tiebreakP1;
        return `${base} (${playerTiebreak}-${opponentTiebreak})`;
      }
      return base;
    })
    .join(" · ");
}

function getOutcomeLabel(match: MatchHistoryRow, playerId: string) {
  if (match.status === "empate") {
    return { label: "Empatado", tone: "text-blue-700 bg-blue-50" };
  }

  if (match.winnerId === playerId) {
    return {
      label: match.status === "wo" ? "Ganado por W.O." : "Ganado",
      tone: "text-emerald-700 bg-emerald-50",
    };
  }

  return {
    label: match.status === "wo" ? "Perdido por W.O." : "Perdido",
    tone: "text-rose-700 bg-rose-50",
  };
}

export default async function MiPerfilPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  await requireCompleteProfile();

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
    .select({
      id: players.id,
      fullName: players.fullName,
      gender: players.gender,
      status: players.status,
    })
    .from(players)
    .where(eq(players.email, userEmail))
    .limit(1);

  if (!player) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
        <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5">
          <h1 className="text-2xl font-semibold text-slate-950">Mi perfil</h1>
          <p className="mt-3 text-sm text-slate-600">
            Tu cuenta ({session.user.email}) no está vinculada a ningún jugador.
            Pídele al administrador que te agregue con este email.
          </p>
        </section>
      </main>
    );
  }

  const category: RankingCategory =
    player.gender === "M" ? "hombres" : "mujeres";

  const today = getTodayInSantiago();
  const weekStart = getWeekStart(today);
  const weekEnd = getWeekEnd(weekStart);
  const monthStart = getMonthStart(today);

  const [
    ranking,
    [weekCountRow],
    [monthCountRow],
    [challengeMonthRow],
    historyRows,
  ] = await Promise.all([
    getRanking(category),
    db
      .select({ value: sql<number>`count(*)` })
      .from(matches)
      .where(
        and(
          or(
            eq(matches.player1Id, player.id),
            eq(matches.player2Id, player.id),
          ),
          sql`${matches.status} in ('confirmado', 'empate', 'wo')`,
          sql`${matches.playedOn} is not null`,
          sql`${matches.playedOn} between ${weekStart} and ${weekEnd}`,
          sql`${matches.type} <> 'campeonato'`,
        ),
      ),
    db
      .select({ value: sql<number>`count(*)` })
      .from(matches)
      .where(
        and(
          or(
            eq(matches.player1Id, player.id),
            eq(matches.player2Id, player.id),
          ),
          sql`${matches.status} in ('confirmado', 'empate', 'wo')`,
          sql`${matches.playedOn} is not null`,
          sql`${matches.playedOn} between ${monthStart} and ${today}`,
          sql`${matches.type} <> 'campeonato'`,
        ),
      ),
    db
      .select({ value: sql<number>`count(*)` })
      .from(matches)
      .where(
        and(
          or(
            eq(matches.player1Id, player.id),
            eq(matches.player2Id, player.id),
          ),
          eq(matches.type, "desafio"),
          sql`${matches.status} in ('confirmado', 'empate', 'wo')`,
          sql`${matches.playedOn} is not null`,
          sql`${matches.playedOn} between ${monthStart} and ${today}`,
        ),
      ),
    db
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
          or(
            eq(matches.player1Id, player.id),
            eq(matches.player2Id, player.id),
          ),
          sql`${matches.status} in ('confirmado', 'empate', 'wo')`,
        ),
      )
      .orderBy(
        desc(matches.playedOn),
        desc(matches.confirmedAt),
        desc(matches.createdAt),
      )
      .limit(10) as Promise<MatchHistoryRow[]>,
  ]);

  const rankingEntry = ranking.find((entry) => entry.id === player.id) ?? null;

  const matchIds = historyRows.map((row) => row.id);
  const allSets = matchIds.length
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
  for (const set of allSets) {
    const existing = setsByMatch.get(set.matchId) ?? [];
    existing.push(set);
    setsByMatch.set(set.matchId, existing);
  }

  const historyGroups = historyRows.reduce<
    Array<{ key: string; label: string; matches: MatchHistoryRow[] }>
  >((groups, match) => {
    const week = getMatchWeekGroup(match);
    const current = groups.at(-1);

    if (current?.key === week.key) {
      current.matches.push(match);
    } else {
      groups.push({ ...week, matches: [match] });
    }

    return groups;
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-700">Mi perfil</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              {player.fullName}
            </h1>
            <p className="mt-3 text-sm text-slate-600">
              Categoría {rankingCategoryLabels[category]} · Estado{" "}
              {player.status}
              {rankingEntry
                ? ` · #${rankingEntry.position} · ${rankingEntry.points} pts`
                : ""}
            </p>
          </div>
          <Link
            href="/disponibilidad"
            className="inline-flex rounded-full bg-emerald-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            Gestionar disponibilidad
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Partidos esta semana</p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-3xl font-semibold text-slate-950">
              {weekCountRow?.value ?? 0} / 3
            </p>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-medium ${getCounterTone(weekCountRow?.value ?? 0, 3)}`}
            >
              límite semanal
            </span>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Semana actual: {formatDate(weekStart)} al {formatDate(weekEnd)}
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Partidos este mes</p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-3xl font-semibold text-slate-950">
              {monthCountRow?.value ?? 0} / 4
            </p>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-medium ${getCounterTone(monthCountRow?.value ?? 0, 4)}`}
            >
              límite mensual
            </span>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Conteo informativo según las reglas de la escalerilla.
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Desafíos aceptados este mes</p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-3xl font-semibold text-slate-950">
              {challengeMonthRow?.value ?? 0} / 2
            </p>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-medium ${getCounterTone(challengeMonthRow?.value ?? 0, 2)}`}
            >
              mínimo sugerido
            </span>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Conteo informativo basado en partidos tipo desafío ya registrados.
          </p>
        </article>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-700">Mis partidos</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">
              Últimos resultados registrados
            </h2>
          </div>
          <div className="text-sm text-slate-500">
            También puedes revisar tu detalle de puntos en{" "}
            <Link
              href={`/ranking/${category}?player=${player.id}`}
              className="font-medium text-emerald-700 hover:text-emerald-800"
            >
              el ranking
            </Link>
            .
          </div>
        </div>

        {historyRows.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-500">
            Todavía no registras partidos esta temporada.
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {historyGroups.map((group) => (
              <div key={group.key} className="space-y-3">
                <div className="flex items-center gap-3">
                  <h3 className="shrink-0 text-sm font-semibold uppercase tracking-wide text-slate-500">
                    {group.label}
                  </h3>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>

                {group.matches.map((match) => {
                  const isPlayer1 = match.player1Id === player.id;
                  const opponentName = isPlayer1
                    ? match.player2Name
                    : match.player1Name;
                  const outcome = getOutcomeLabel(match, player.id);
                  const score = formatScore(
                    match,
                    player.id,
                    setsByMatch.get(match.id) ?? [],
                  );
                  const typeLabel =
                    match.type === "desafio"
                      ? "Desafío"
                      : match.type === "campeonato"
                        ? "Partido"
                        : "Sorteo";

                  return (
                    <article
                      key={match.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-sm text-slate-500">
                            {formatDate(match.playedOn)} · {typeLabel}
                          </p>
                          <h4 className="mt-1 text-base font-semibold text-slate-950">
                            vs {opponentName}
                          </h4>
                          <p className="mt-2 text-sm text-slate-600">
                            {score}
                          </p>
                          <Link
                            href={`/mi-perfil/partidos/${match.id}`}
                            className="mt-3 inline-flex text-sm font-medium text-emerald-700 transition hover:text-emerald-800"
                          >
                            Ver detalle →
                          </Link>
                        </div>
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${outcome.tone}`}
                        >
                          {outcome.label}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
