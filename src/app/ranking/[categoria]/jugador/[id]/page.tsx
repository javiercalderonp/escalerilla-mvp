import Link from "next/link";
import { notFound } from "next/navigation";

import {
  formatDelta,
  getPublicPlayerProfile,
  isRankingCategory,
  rankingCategoryLabels,
} from "@/lib/ranking";

type PublicPlayerPageProps = {
  params: Promise<{
    categoria: string;
    id: string;
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

function formatScore(match: NonNullable<Awaited<ReturnType<typeof getPublicPlayerProfile>>>["recentMatches"][number]) {
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

export default async function PublicPlayerPage({ params }: PublicPlayerPageProps) {
  const { categoria, id } = await params;

  if (!isRankingCategory(categoria)) {
    notFound();
  }

  const profile = await getPublicPlayerProfile(categoria, id);

  if (!profile) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">
              Ranking · {rankingCategoryLabels[categoria]}
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              {profile.player.fullName}
            </h1>
            <p className="mt-3 text-sm text-slate-600">
              Posición #{profile.player.position} · {profile.player.points} pts · Semana {formatDelta(profile.player.weeklyDelta)}
            </p>
          </div>
          <Link
            href={`/ranking/${categoria}`}
            className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400"
          >
            Volver al ranking
          </Link>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <p className="text-sm font-medium text-emerald-700">Perfil público</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">
            Últimos partidos registrados
          </h2>
        </div>

        {profile.recentMatches.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-500">
            Este jugador todavía no registra partidos confirmados.
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {profile.recentMatches.map((match) => {
              const isPlayer1 = match.player1Id === profile.player.id;
              const opponentName = isPlayer1 ? match.player2Name : match.player1Name;
              const outcome = getOutcomeLabel(match, profile.player.id);

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
                      <p className="mt-2 text-sm text-slate-600">{formatScore(match)}</p>
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
      </section>
    </div>
  );
}
