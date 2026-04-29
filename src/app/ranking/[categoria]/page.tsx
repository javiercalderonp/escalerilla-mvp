import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

import { RankingTable } from "@/components/ranking/ranking-table";
import { db } from "@/lib/db";
import { championshipPlacements, championships, players } from "@/lib/db/schema";
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

async function getCategoryChampionships(category: "M" | "F") {
  if (!db) return [];

  const rows = await db
    .select({
      id: championships.id,
      name: championships.name,
      type: championships.type,
      playedOn: championships.playedOn,
      position: championshipPlacements.position,
      delta: championshipPlacements.delta,
      playerName: players.fullName,
    })
    .from(championships)
    .leftJoin(championshipPlacements, eq(championshipPlacements.championshipId, championships.id))
    .leftJoin(players, eq(players.id, championshipPlacements.playerId))
    .where(eq(championships.category, category))
    .orderBy(championships.playedOn);

  const byId = new Map<string, {
    id: string; name: string; type: string; playedOn: string;
    placements: { position: number; playerName: string; delta: number }[];
  }>();

  for (const row of rows) {
    if (!byId.has(row.id)) {
      byId.set(row.id, { id: row.id, name: row.name, type: row.type, playedOn: row.playedOn, placements: [] });
    }
    if (row.position !== null && row.playerName) {
      byId.get(row.id)!.placements.push({ position: row.position, playerName: row.playerName, delta: row.delta ?? 0 });
    }
  }

  return [...byId.values()].map((c) => ({
    ...c,
    placements: c.placements.sort((a, b) => a.position - b.position),
  }));
}

const podiumEmoji: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

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
  const gender = categoria === "hombres" ? "M" : "F";

  const [playerDetail, categoryChampionships] = await Promise.all([
    selectedPlayerId ? getPlayerRankingDetail(categoria, selectedPlayerId) : Promise.resolve(null),
    getCategoryChampionships(gender),
  ]);

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
          Ranking real por categoría con detalle de puntos por jugador. El
          siguiente salto aquí será sumar desempates RN-11 y luego el historial
          de partidos.
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
        {playerDetail ? (
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
            Haz click en un jugador del ranking para ver su historial de puntos.
          </div>
        )}
      </section>

      {categoryChampionships.length > 0 && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">
            Hitos de la temporada
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Campeones y finalistas de torneos internos registrados este año.
          </p>
          <div className="mt-4 space-y-4">
            {categoryChampionships.map((c) => (
              <div key={c.id} className="rounded-2xl border border-slate-100 p-4">
                <p className="font-medium text-slate-950">
                  {c.name}
                  <span className="ml-2 text-xs font-normal text-slate-400">
                    {formatDate(new Date(c.playedOn + "T00:00:00"))} · {c.type}
                  </span>
                </p>
                <div className="mt-2 space-y-1">
                  {c.placements.map((p) => (
                    <div key={p.position} className="flex items-center gap-2 text-sm">
                      <span>{podiumEmoji[p.position] ?? `#${p.position}`}</span>
                      <span className="font-medium text-slate-800">{p.playerName}</span>
                      <span className="text-xs text-emerald-700">+{p.delta} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
