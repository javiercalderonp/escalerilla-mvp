import Link from "next/link";
import { notFound } from "next/navigation";

import { RankingTable } from "@/components/ranking/ranking-table";
import {
  formatDelta,
  formatRankingReason,
  getPlayerRankingDetail,
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

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
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
  const playerDetail = selectedPlayerId
    ? await getPlayerRankingDetail(categoria, selectedPlayerId)
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

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        {entries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-500">
            Aún no hay jugadores cargados en esta categoría.
          </div>
        ) : playerDetail ? (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-700">
                  Detalle del jugador
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                  {playerDetail.player.fullName}
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Posición #{playerDetail.player.position} ·{" "}
                  {playerDetail.player.points} pts · Semana{" "}
                  {formatDelta(playerDetail.player.weeklyDelta)}
                </p>
              </div>
              <Link
                href={`/ranking/${categoria}`}
                className="text-sm font-medium text-emerald-700 transition hover:text-emerald-800"
              >
                Limpiar selección
              </Link>
            </div>

            {playerDetail.events.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-500">
                Todavía no registra movimientos de puntos esta temporada.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="grid grid-cols-[120px_120px_1fr] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:px-6">
                  <span>Fecha</span>
                  <span>Delta</span>
                  <span>Motivo</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {playerDetail.events.map((event) => (
                    <div
                      key={event.id}
                      className="grid grid-cols-[120px_120px_1fr] gap-3 px-4 py-4 sm:px-6"
                    >
                      <span className="text-sm text-slate-600">
                        {formatDate(event.occurredAt)}
                      </span>
                      <span
                        className={`text-sm font-semibold ${
                          event.delta > 0
                            ? "text-emerald-700"
                            : event.delta < 0
                              ? "text-rose-700"
                              : "text-slate-500"
                        }`}
                      >
                        {formatDelta(event.delta)}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-slate-950">
                          {formatRankingReason(event.reason)}
                        </p>
                        {event.note ? (
                          <p className="mt-1 text-xs text-slate-500">
                            {event.note}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-500">
            Puedes abrir el perfil público de un jugador desde la tabla de ranking.
          </div>
        )}
      </section>
    </div>
  );
}
