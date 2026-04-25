import Link from "next/link";
import { notFound } from "next/navigation";

import { RankingTable } from "@/components/ranking/ranking-table";
import {
  getRanking,
  isRankingCategory,
  rankingCategoryLabels,
} from "@/lib/ranking";

type RankingCategoryPageProps = {
  params: Promise<{
    categoria: string;
  }>;
};

export default async function RankingCategoryPage({ params }: RankingCategoryPageProps) {
  const { categoria } = await params;

  if (!isRankingCategory(categoria)) {
    notFound();
  }

  const entries = getRanking(categoria);
  const categoryLabel = rankingCategoryLabels[categoria];

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
          Este slice ya deja visible el ranking para {categoryLabel.toLowerCase()} y está armado
          para conectar luego el cálculo real desde <code>ranking_events</code>, desempates RN-11
          e historial por jugador.
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
    </div>
  );
}
