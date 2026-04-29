import Link from "next/link";
import { notFound } from "next/navigation";

import { RankingTable } from "@/components/ranking/ranking-table";
import {
  formatDelta,
  getPublicPlayerProfile,
  getRanking,
  isRankingCategory,
  rankingCategoryLabels,
} from "@/lib/ranking";

type RankingCategoryPageProps = {
  params: Promise<{
    categoria: string;
  }>;
  searchParams?: Promise<{
    player?: string;
  }>;
};

function formatDate(value: string | null) {
  if (!value) return "Sin fecha";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatMatchTypeLabel(type: "sorteo" | "desafio" | "campeonato") {
  if (type === "desafio") return "Desafío";
  if (type === "campeonato") return "Campeonato";
  return "Sorteo";
}

function formatScore(
  match: NonNullable<Awaited<ReturnType<typeof getPublicPlayerProfile>>>["recentMatches"][number],
) {
  if (match.status === "wo") {
    return "W.O.";
  }

  if (match.sets.length === 0) {
    return match.status === "empate" ? "Empate" : "Resultado confirmado";
  }

  return match.sets
    .map((set) => {
      const base = `${set.gamesP1}-${set.gamesP2}`;
      if (set.tiebreakP1 != null && set.tiebreakP2 != null) {
        return `${base} (${set.tiebreakP1}-${set.tiebreakP2})`;
      }
      return base;
    })
    .join(" · ");
}

function getOutcomeLabel(
  match: NonNullable<Awaited<ReturnType<typeof getPublicPlayerProfile>>>["recentMatches"][number],
  playerId: string,
) {
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

export default async function RankingCategoryPage({
  params,
  searchParams,
}: RankingCategoryPageProps) {
  const { categoria } = await params;

  if (!isRankingCategory(categoria)) {
    notFound();
  }

  const query = searchParams ? await searchParams : undefined;
  const entries = await getRanking(categoria);
  const categoryLabel = rankingCategoryLabels[categoria];
  const selectedPlayerId = query?.player;
  const selectedPlayerProfile = selectedPlayerId
    ? await getPublicPlayerProfile(categoria, selectedPlayerId)
    : null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <div className="w-full rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5">
        <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">
          Ranking · {categoryLabel}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          Ranking público por categoría
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Ranking real por categoría con acceso al perfil público de cada
          jugador y su detalle de puntos.
        </p>
        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <Link
            href="/ranking/hombres"
            className={`rounded-full px-4 py-2 font-medium transition ${
              categoria === "hombres"
                ? "bg-emerald-600 text-white"
                : "border border-slate-300 text-slate-700 hover:border-slate-400"
            }`}
          >
            Hombres
          </Link>
          <Link
            href="/ranking/mujeres"
            className={`rounded-full px-4 py-2 font-medium transition ${
              categoria === "mujeres"
                ? "bg-emerald-600 text-white"
                : "border border-slate-300 text-slate-700 hover:border-slate-400"
            }`}
          >
            Mujeres
          </Link>
        </div>
      </div>

      <RankingTable category={categoria} entries={entries} />
      {selectedPlayerProfile ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <Link
            href={`/ranking/${categoria}`}
            aria-label="Cerrar perfil público"
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
          />

          <section className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/5">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5 sm:px-8">
              <div>
                <p className="text-sm font-medium text-emerald-700">
                  Perfil público
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                  {selectedPlayerProfile.player.fullName}
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Posición #{selectedPlayerProfile.player.position} · {selectedPlayerProfile.player.points} pts · Semana {formatDelta(selectedPlayerProfile.player.weeklyDelta)}
                </p>
              </div>

              <Link
                href={`/ranking/${categoria}`}
                className="inline-flex rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400"
              >
                Cerrar
              </Link>
            </div>

            <div className="overflow-y-auto px-6 py-6 sm:px-8">
              <div>
                <p className="text-sm font-medium text-emerald-700">
                  Últimos partidos registrados
                </p>
              </div>

              {selectedPlayerProfile.recentMatches.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-500">
                  Este jugador todavía no registra partidos confirmados.
                </div>
              ) : (
                <div className="mt-6 space-y-3">
                  {selectedPlayerProfile.recentMatches.map((match) => {
                    const isPlayer1 =
                      match.player1Id === selectedPlayerProfile.player.id;
                    const opponentName = isPlayer1
                      ? match.player2Name
                      : match.player1Name;
                    const outcome = getOutcomeLabel(
                      match,
                      selectedPlayerProfile.player.id,
                    );

                    return (
                      <article
                        key={match.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-sm text-slate-500">
                              {formatDate(match.playedOn)} · {formatMatchTypeLabel(match.type)}
                            </p>
                            <h3 className="mt-1 text-base font-semibold text-slate-950">
                              vs {opponentName}
                            </h3>
                            <p className="mt-2 text-sm text-slate-600">
                              {formatScore(match)}
                            </p>
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
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
