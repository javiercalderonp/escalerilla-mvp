import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PlayerCardModalLink } from "@/components/players/player-card-modal-link";
import { RankingTable } from "@/components/ranking/ranking-table";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { championshipPlacements, championships, players } from "@/lib/db/schema";
import { getPlayerCardData, getViewerContext } from "@/lib/players/get-player-card-data";
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

function formatDate(value: string | null) {
  if (!value) return "Sin fecha";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
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

  const session = await auth();
  const query = searchParams ? await searchParams : undefined;
  const entries = await getRanking(categoria);
  const categoryLabel = rankingCategoryLabels[categoria];
  const selectedPlayerId = query?.player;
  const gender = categoria === "hombres" ? "M" : "F";
  const viewer = await getViewerContext(session?.user?.email);

  const [playerCardData, categoryChampionships] = await Promise.all([
    selectedPlayerId
      ? getPlayerCardData(categoria, selectedPlayerId, viewer.viewerRole, viewer.viewerPlayerId)
      : Promise.resolve(null),
    getCategoryChampionships(gender),
  ]);

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

      {categoryChampionships.length > 0 && (
        <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">
            Hitos de la temporada
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Campeones y finalistas de torneos internos registrados este año.
          </p>
          <div className="mt-4 space-y-4">
            {categoryChampionships.map((c) => (
              <div key={c.id} className="rounded-2xl border border-border/70 p-4">
                <p className="font-medium text-foreground">
                  {c.name}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {formatDate(new Date(c.playedOn + "T00:00:00").toISOString().slice(0, 10))} · {c.type}
                  </span>
                </p>
                <div className="mt-2 space-y-1">
                  {c.placements.map((p) => (
                    <div key={p.position} className="flex items-center gap-2 text-sm">
                      <span>{podiumEmoji[p.position] ?? `#${p.position}`}</span>
                      <span className="font-medium text-foreground">{p.playerName}</span>
                      <span className="text-xs text-grass">+{p.delta} pts</span>
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
