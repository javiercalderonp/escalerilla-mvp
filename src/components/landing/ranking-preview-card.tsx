"use client";

import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import type { RankingEntry } from "@/lib/ranking";

type PreviewEntry = Pick<
  RankingEntry,
  "id" | "position" | "fullName" | "points"
>;

export function RankingPreviewCard({
  hombres,
  mujeres,
}: {
  hombres: PreviewEntry[];
  mujeres: PreviewEntry[];
}) {
  const [category, setCategory] = useState<"hombres" | "mujeres">("hombres");
  const entries = category === "hombres" ? hombres : mujeres;

  const positionStyle = (pos: number) => {
    if (pos === 1) return "text-clay font-bold";
    if (pos === 2) return "text-silver font-bold";
    if (pos === 3) return "text-bronze font-bold";
    return "text-white/40";
  };

  return (
    <div className="flex h-full flex-col rounded-xl bg-[#0f1e30] shadow-xl ring-1 ring-white/10">
      {/* Header */}
      <div className="border-b border-white/10 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-clay">
          Club La Dehesa
        </p>
        <p className="mt-0.5 text-sm font-bold tracking-tight text-white">
          Rankings en vivo
        </p>
      </div>

      {/* Category tabs + ver todo */}
      <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-1.5">
        <div className="flex gap-1">
          {(["hombres", "mujeres"] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize transition ${
                category === cat
                  ? "bg-clay/20 text-clay"
                  : "text-white/50 hover:text-white"
              }`}
            >
              {cat === "hombres" ? "Hombres" : "Mujeres"}
            </button>
          ))}
        </div>
        <Link
          href={`/ranking/${category}`}
          className="flex items-center gap-1 text-xs font-semibold text-clay transition hover:underline"
        >
          Ver todo <ArrowRightIcon className="size-3" />
        </Link>
      </div>

      {/* Player list */}
      <div className="flex-1 divide-y divide-white/10 overflow-hidden">
        {entries.map((entry) => {
          const [firstName, ...rest] = entry.fullName.split(" ");
          return (
            <div
              key={entry.id}
              className="flex items-center gap-2.5 px-4 py-1.5 transition hover:bg-white/5"
            >
              <span
                className={`w-5 shrink-0 text-right text-xs tabular-nums ${positionStyle(entry.position)}`}
              >
                {entry.position}
              </span>
              <Avatar
                firstName={firstName}
                lastName={rest.join(" ")}
                size="sm"
                className="shrink-0"
              />
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-white">
                {entry.fullName}
              </span>
              <span className="shrink-0 text-xs font-bold text-white tabular-nums">
                {entry.points}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
