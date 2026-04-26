import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { players, rankingEvents } from "@/lib/db/schema";

export type RankingCategory = "hombres" | "mujeres";

export type RankingEntry = {
  id: string;
  position: number;
  fullName: string;
  points: number;
  weeklyDelta: number;
  status: "activo" | "congelado";
  category: RankingCategory;
  recentForm: Array<"W" | "L" | "D">;
};

type RankingRow = {
  id: string;
  fullName: string;
  points: number;
  weeklyDelta: number;
  status: "activo" | "congelado";
};

const fallbackRankingData: Record<RankingCategory, RankingEntry[]> = {
  hombres: [
    { id: "h-1", position: 1, fullName: "Juan Pérez", points: 420, weeklyDelta: 60, status: "activo", category: "hombres", recentForm: [] },
    { id: "h-2", position: 2, fullName: "Pedro García", points: 380, weeklyDelta: 0, status: "activo", category: "hombres", recentForm: [] },
    { id: "h-3", position: 3, fullName: "Diego Rojas", points: 350, weeklyDelta: -20, status: "activo", category: "hombres", recentForm: [] },
    { id: "h-4", position: 4, fullName: "Mateo López", points: 300, weeklyDelta: 30, status: "activo", category: "hombres", recentForm: [] },
    { id: "h-5", position: 5, fullName: "Sergio Muñoz", points: 250, weeklyDelta: 0, status: "congelado", category: "hombres", recentForm: [] },
  ],
  mujeres: [
    { id: "m-1", position: 1, fullName: "Ana Silva", points: 410, weeklyDelta: 30, status: "activo", category: "mujeres", recentForm: [] },
    { id: "m-2", position: 2, fullName: "María Torres", points: 385, weeklyDelta: 0, status: "activo", category: "mujeres", recentForm: [] },
    { id: "m-3", position: 3, fullName: "Josefa Ríos", points: 340, weeklyDelta: 60, status: "activo", category: "mujeres", recentForm: [] },
    { id: "m-4", position: 4, fullName: "Catalina Reyes", points: 315, weeklyDelta: -20, status: "activo", category: "mujeres", recentForm: [] },
  ],
};

export const rankingCategoryLabels: Record<RankingCategory, string> = {
  hombres: "Hombres",
  mujeres: "Mujeres",
};

export function isRankingCategory(value: string): value is RankingCategory {
  return value === "hombres" || value === "mujeres";
}

function mapRowsToEntries(category: RankingCategory, rows: RankingRow[]): RankingEntry[] {
  return rows.map((row, index) => ({
    id: row.id,
    position: index + 1,
    fullName: row.fullName,
    points: Number(row.points ?? 0),
    weeklyDelta: Number(row.weeklyDelta ?? 0),
    status: row.status,
    category,
    recentForm: [],
  }));
}

async function fetchRankingFromDb(category: RankingCategory): Promise<RankingEntry[] | null> {
  if (!db) return null;

  const gender = category === "hombres" ? "M" : "F";
  const weeklyWindow = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      id: players.id,
      fullName: players.fullName,
      status: players.status,
      points: sql<number>`coalesce(sum(${rankingEvents.delta}), 0)`,
      weeklyDelta: sql<number>`coalesce(sum(case when ${rankingEvents.occurredAt} >= ${weeklyWindow} then ${rankingEvents.delta} else 0 end), 0)`,
    })
    .from(players)
    .leftJoin(rankingEvents, eq(rankingEvents.playerId, players.id))
    .where(eq(players.gender, gender))
    .groupBy(players.id)
    .orderBy(desc(sql`coalesce(sum(${rankingEvents.delta}), 0)`), players.fullName);

  return mapRowsToEntries(category, rows as RankingRow[]);
}

export async function getRanking(category: RankingCategory): Promise<RankingEntry[]> {
  const fromDb = await fetchRankingFromDb(category);
  return fromDb && fromDb.length > 0 ? fromDb : fallbackRankingData[category];
}

export async function getRankingSummary() {
  const categories = await Promise.all(
    (["hombres", "mujeres"] as RankingCategory[]).map(async (category) => {
      const ranking = await getRanking(category);
      return {
        category,
        label: rankingCategoryLabels[category],
        leader: ranking[0],
        players: ranking.length,
      };
    }),
  );

  return {
    updatedLabel: "Actualizado desde base real",
    categories,
  };
}

export function formatDelta(delta: number) {
  if (delta > 0) return `▲ ${delta}`;
  if (delta < 0) return `▼ ${Math.abs(delta)}`;
  return "—";
}
