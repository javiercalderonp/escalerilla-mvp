import Link from "next/link";

import {
  formatDelta,
  type RankingCategory,
  type RankingEntry,
} from "@/lib/ranking";

type RankingTableProps = {
  category: RankingCategory;
  entries: RankingEntry[];
};

export function RankingTable({ category, entries }: RankingTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="grid grid-cols-[56px_1fr_92px_92px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:px-6">
        <span>#</span>
        <span>Jugador</span>
        <span>Puntos</span>
        <span>Δ semana</span>
      </div>

      <div className="divide-y divide-slate-100">
        {entries.map((entry) => (
          <Link
            key={entry.id}
            href={`/ranking/${category}?player=${entry.id}`}
            className="grid grid-cols-[56px_1fr_92px_92px] gap-3 px-4 py-4 transition hover:bg-slate-50 sm:px-6"
          >
            <span className="text-sm font-semibold text-slate-500">
              {entry.position}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-950">
                  {entry.fullName}
                </span>
                {entry.status === "congelado" ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                    Congelado
                  </span>
                ) : null}
                {entry.status === "retirado" ? (
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                    Retirado
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {entry.recentForm.length > 0
                  ? `Forma reciente: ${entry.recentForm.join(" · ")}`
                  : "Click para ver historial de puntos"}
              </p>
            </div>
            <span className="text-sm font-semibold text-slate-950">
              {entry.points}
            </span>
            <span
              className={`text-sm font-semibold ${
                entry.weeklyDelta > 0
                  ? "text-emerald-700"
                  : entry.weeklyDelta < 0
                    ? "text-rose-700"
                    : "text-slate-500"
              }`}
            >
              {formatDelta(entry.weeklyDelta)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
