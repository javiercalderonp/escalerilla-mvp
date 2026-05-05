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

function getPositionColor(position: number) {
  if (position === 1) return "text-gold font-bold";
  if (position === 2) return "text-silver font-bold";
  if (position === 3) return "text-bronze font-bold";
  return "text-muted-foreground font-semibold";
}

function getBorderTone(position: number) {
  if (position === 1) return "border-l-[3px] border-l-gold";
  if (position === 2) return "border-l-[3px] border-l-silver";
  if (position === 3) return "border-l-[3px] border-l-bronze";
  return "border-l-[3px] border-l-transparent";
}

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
      {/* ─── Mobile card list (hidden on md+) ─── */}
      <div className="divide-y divide-border/60 md:hidden">
        {entries.map((entry) => {
          const [firstName, ...rest] = entry.fullName.split(" ");

          return (
            <Link
              key={entry.id}
              href={`/ranking/${category}?player=${entry.id}`}
              scroll={false}
              className={`flex items-start gap-3 px-4 py-3 transition active:bg-muted/40 ${getBorderTone(entry.position)} ${entry.position <= 3 ? "bg-muted/20" : ""}`}
            >
              {/* Position */}
              <span
                className={`mt-0.5 w-6 shrink-0 text-center text-sm tabular-nums ${getPositionColor(entry.position)}`}
              >
                {entry.position}
              </span>

              {/* Avatar */}
              <div className="mt-0.5 shrink-0">
                <Avatar
                  firstName={firstName}
                  lastName={rest.join(" ")}
                  size="sm"
                />
              </div>

              {/* Name + stats row */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-1.5">
                  <p className="text-sm font-semibold leading-tight text-foreground">
                    {entry.fullName}
                  </p>
                  {entry.status === "congelado" && (
                    <Badge variant="warning" size="sm">
                      Congelado
                    </Badge>
                  )}
                  {entry.status === "retirado" && (
                    <Badge variant="muted" size="sm">
                      Retirado
                    </Badge>
                  )}
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    PJ {entry.matchesPlayed}
                    <span className="mx-1 opacity-40">·</span>
                    PG{" "}
                    <span className="font-semibold text-grass">
                      {entry.matchesWon}
                    </span>
                    <span className="mx-1 opacity-40">·</span>
                    PP{" "}
                    <span className="font-semibold text-destructive">
                      {entry.matchesLost}
                    </span>
                  </p>
                </div>
              </div>

              {/* Points */}
              <div className="shrink-0 text-right">
                <p className="text-sm font-bold tabular-nums text-foreground">
                  {entry.points}
                </p>
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  pts
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* ─── Desktop table (hidden below md) ─── */}
      <div className="hidden md:block">
        <div className="grid grid-cols-[56px_minmax(0,1fr)_72px_56px_56px_56px] gap-2 border-b border-border bg-muted/40 px-6 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground lg:grid-cols-[56px_minmax(0,1fr)_92px_72px_72px_72px_72px_120px]">
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

            return (
              <Link
                key={entry.id}
                href={`/ranking/${category}?player=${entry.id}`}
                scroll={false}
                className={`grid h-12 grid-cols-[56px_minmax(0,1fr)_72px_56px_56px_56px] items-center gap-2 px-6 py-3 transition hover:bg-muted/40 lg:grid-cols-[56px_minmax(0,1fr)_92px_72px_72px_72px_72px_120px] ${getBorderTone(entry.position)} ${entry.position <= 3 ? "bg-muted/20" : ""}`}
              >
                <span
                  className={`text-sm tabular-nums ${getPositionColor(entry.position)}`}
                >
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
    </div>
  );
}
