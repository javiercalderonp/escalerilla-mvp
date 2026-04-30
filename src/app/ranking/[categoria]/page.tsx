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
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <div className="w-full rounded-3xl bg-card p-8 shadow-sm ring-1 ring-black/5">
        <p className="text-sm font-medium uppercase tracking-wide text-court">
          Ranking · {categoryLabel}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
          Ranking público por categoría
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Ranking real por categoría con acceso al perfil público de cada
          jugador y su detalle de puntos.
        </p>
        <div className="mt-6 inline-flex rounded-full bg-muted p-1 text-sm">
          <Link
            href="/ranking/hombres"
            className={`rounded-full px-4 py-2 font-medium transition ${
              categoria === "hombres"
                ? "bg-court text-court-foreground"
                : "text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Hombres
          </Link>
          <Link
            href="/ranking/mujeres"
            className={`rounded-full px-4 py-2 font-medium transition ${
              categoria === "mujeres"
                ? "bg-court text-court-foreground"
                : "text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Mujeres
          </Link>
        </div>
      </div>

      <RankingTable category={categoria} entries={entries} />

      <PlayerCardModalLink data={playerCardData} />
    </div>
  );
}
