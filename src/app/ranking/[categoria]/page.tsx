import Link from "next/link";
import { notFound } from "next/navigation";

import { PlayerCardModalLink } from "@/components/players/player-card-modal-link";
import { RankingTable } from "@/components/ranking/ranking-table";
import { auth } from "@/lib/auth";
import {
  getPlayerCardData,
  getViewerContext,
} from "@/lib/players/get-player-card-data";
import {
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

export default async function RankingCategoryPage({
  params,
  searchParams,
}: RankingCategoryPageProps) {
  const { categoria } = await params;

  if (!isRankingCategory(categoria)) {
    notFound();
  }

  const session = await auth();
  const query = searchParams ? await searchParams : undefined;
  const entries = await getRanking(categoria);
  const categoryLabel = rankingCategoryLabels[categoria];
  const selectedPlayerId = query?.player;
  const viewer = await getViewerContext(session?.user?.email);

  const playerCardData = selectedPlayerId
    ? await getPlayerCardData(
        categoria,
        selectedPlayerId,
        viewer.viewerRole,
        viewer.viewerPlayerId,
      )
    : null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
      {/* ── Hero header — hidden on mobile ── */}
      <div
        className="relative hidden overflow-hidden rounded-3xl shadow-md sm:block"
        style={{
          background:
            "linear-gradient(140deg, #0b1d4f 0%, #1640a0 55%, #0d2460 100%)",
        }}
      >
        {/* Court grid texture */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <div className="relative flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-300/80">
              Escalerilla · {categoryLabel}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:mt-2 sm:text-3xl">
              Ranking {categoryLabel}
            </h1>
            <p className="mt-1 text-sm text-white/50 sm:mt-2">
              {entries.length} jugadores · Actualizado en tiempo real
            </p>
          </div>

          {/* Category switcher inside hero (desktop) */}
          <div className="inline-flex self-start rounded-full bg-white/10 p-1 text-sm sm:self-auto">
            <Link
              href="/ranking/hombres"
              className={`rounded-full px-5 py-2 font-medium transition ${
                categoria === "hombres"
                  ? "bg-white text-[#0b1d4f]"
                  : "text-white/70 hover:text-white"
              }`}
            >
              Hombres
            </Link>
            <Link
              href="/ranking/mujeres"
              className={`rounded-full px-5 py-2 font-medium transition ${
                categoria === "mujeres"
                  ? "bg-white text-[#0b1d4f]"
                  : "text-white/70 hover:text-white"
              }`}
            >
              Mujeres
            </Link>
          </div>
        </div>
      </div>

      {/* Category switcher — mobile only */}
      <div className="flex sm:hidden rounded-full border border-border bg-card p-1 shadow-sm self-start">
        <Link
          href="/ranking/hombres"
          className={`rounded-full px-5 py-2 text-sm font-medium transition ${
            categoria === "hombres"
              ? "bg-[#0b1d4f] text-white"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Hombres
        </Link>
        <Link
          href="/ranking/mujeres"
          className={`rounded-full px-5 py-2 text-sm font-medium transition ${
            categoria === "mujeres"
              ? "bg-[#0b1d4f] text-white"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Mujeres
        </Link>
      </div>

      <RankingTable category={categoria} entries={entries} />

      <PlayerCardModalLink data={playerCardData} />
    </div>
  );
}
