import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import Link from "next/link";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground shadow-sm">
        Aún no hay jugadores cargados en esta categoría.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="grid grid-cols-[40px_minmax(0,1fr)_54px_38px_38px_38px] gap-2 border-b border-border bg-muted/40 px-3 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground sm:grid-cols-[56px_minmax(0,1fr)_72px_56px_56px_56px] sm:px-6 lg:grid-cols-[56px_minmax(0,1fr)_92px_72px_72px_72px_72px_120px]">
        <span>#</span>
        <span>Jugador</span>
        <span className="text-right">Pts</span>
        <span className="text-center">PJ</span>
        <span className="text-center">PG</span>
        <span className="text-center">PP</span>
        <span className="hidden text-center lg:block">Mejor</span>
        <span className="hidden lg:block">Δ semana</span>
      </div>

      <div className="divide-y divide-border/60">
        {entries.map((entry) => {
          const [firstName, ...rest] = entry.fullName.split(" ");
          const isTop3 = entry.position <= 3;

          const borderTone =
            entry.position === 1
              ? "border-l-[3px] border-l-gold"
              : entry.position === 2
                ? "border-l-[3px] border-l-silver"
                : entry.position === 3
                  ? "border-l-[3px] border-l-bronze"
                  : "border-l-[3px] border-l-transparent";

          const positionColor =
            entry.position === 1
              ? "text-gold font-bold"
              : entry.position === 2
                ? "text-silver font-bold"
                : entry.position === 3
                  ? "text-bronze font-bold"
                  : "text-muted-foreground font-semibold";

          return (
            <Link
              key={entry.id}
              href={`/ranking/${category}?player=${entry.id}`}
              scroll={false}
              className={`grid h-14 grid-cols-[40px_minmax(0,1fr)_54px_38px_38px_38px] items-center gap-2 px-3 py-3 transition hover:bg-muted/40 sm:h-12 sm:grid-cols-[56px_minmax(0,1fr)_72px_56px_56px_56px] sm:px-6 lg:grid-cols-[56px_minmax(0,1fr)_92px_72px_72px_72px_72px_120px] ${borderTone} ${isTop3 ? "bg-muted/20" : ""}`}
            >
              <span className={`text-sm tabular-nums ${positionColor}`}>
                {entry.position}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Avatar
                    firstName={firstName}
                    lastName={rest.join(" ")}
                    size="sm"
                  />
                  <span className="truncate text-sm font-medium text-foreground">
                    {entry.fullName}
                  </span>
                  {entry.status === "congelado" ? (
                    <Badge variant="warning" size="sm">
                      Congelado
                    </Badge>
                  ) : null}
                  {entry.status === "retirado" ? (
                    <Badge variant="muted" size="sm">
                      Retirado
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground sm:hidden">
                  {entry.recentForm.length > 0
                    ? entry.recentForm.join(" · ")
                    : "Ver perfil"}
                </p>
              </div>
              <span className="text-right text-sm font-bold text-foreground tabular-nums">
                {entry.points}
              </span>
              <span className="text-center text-sm text-muted-foreground tabular-nums">
                {entry.matchesPlayed}
              </span>
              <span className="text-center text-sm font-semibold text-grass tabular-nums">
                {entry.matchesWon}
              </span>
              <span className="text-center text-sm font-semibold text-destructive tabular-nums">
                {entry.matchesLost}
              </span>
              <span className="hidden text-center text-sm text-muted-foreground tabular-nums lg:block">
                {entry.bestRankingPosition != null
                  ? `#${entry.bestRankingPosition}`
                  : "—"}
              </span>
              <span className="hidden items-center gap-1 text-sm font-semibold tabular-nums lg:inline-flex">
                {entry.weeklyDelta > 0 ? (
                  <>
                    <TrendingUpIcon className="size-4 text-grass" />
                    <span className="text-grass">
                      {formatDelta(entry.weeklyDelta)}
                    </span>
                  </>
                ) : entry.weeklyDelta < 0 ? (
                  <>
                    <TrendingDownIcon className="size-4 text-destructive" />
                    <span className="text-destructive">
                      {formatDelta(entry.weeklyDelta)}
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
