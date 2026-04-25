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

const rankingData: Record<RankingCategory, RankingEntry[]> = {
  hombres: [
    {
      id: "h-1",
      position: 1,
      fullName: "Juan Pérez",
      points: 420,
      weeklyDelta: 60,
      status: "activo",
      category: "hombres",
      recentForm: ["W", "W", "L"],
    },
    {
      id: "h-2",
      position: 2,
      fullName: "Pedro García",
      points: 380,
      weeklyDelta: 0,
      status: "activo",
      category: "hombres",
      recentForm: ["L", "W", "W"],
    },
    {
      id: "h-3",
      position: 3,
      fullName: "Diego Rojas",
      points: 350,
      weeklyDelta: -20,
      status: "activo",
      category: "hombres",
      recentForm: ["L", "W", "D"],
    },
    {
      id: "h-4",
      position: 4,
      fullName: "Mateo López",
      points: 300,
      weeklyDelta: 30,
      status: "activo",
      category: "hombres",
      recentForm: ["W", "L", "W"],
    },
    {
      id: "h-5",
      position: 5,
      fullName: "Sergio Muñoz",
      points: 250,
      weeklyDelta: 0,
      status: "congelado",
      category: "hombres",
      recentForm: ["D", "L", "W"],
    },
  ],
  mujeres: [
    {
      id: "m-1",
      position: 1,
      fullName: "Ana Silva",
      points: 410,
      weeklyDelta: 30,
      status: "activo",
      category: "mujeres",
      recentForm: ["W", "W", "W"],
    },
    {
      id: "m-2",
      position: 2,
      fullName: "María Torres",
      points: 385,
      weeklyDelta: 0,
      status: "activo",
      category: "mujeres",
      recentForm: ["L", "W", "W"],
    },
    {
      id: "m-3",
      position: 3,
      fullName: "Josefa Ríos",
      points: 340,
      weeklyDelta: 60,
      status: "activo",
      category: "mujeres",
      recentForm: ["W", "W", "L"],
    },
    {
      id: "m-4",
      position: 4,
      fullName: "Catalina Reyes",
      points: 315,
      weeklyDelta: -20,
      status: "activo",
      category: "mujeres",
      recentForm: ["L", "D", "W"],
    },
  ],
};

export const rankingCategoryLabels: Record<RankingCategory, string> = {
  hombres: "Hombres",
  mujeres: "Mujeres",
};

export function isRankingCategory(value: string): value is RankingCategory {
  return value === "hombres" || value === "mujeres";
}

export function getRanking(category: RankingCategory): RankingEntry[] {
  return rankingData[category];
}

export function getRankingSummary() {
  return {
    updatedLabel: "Actualizado hoy · 21:35",
    categories: (Object.keys(rankingData) as RankingCategory[]).map((category) => ({
      category,
      label: rankingCategoryLabels[category],
      leader: rankingData[category][0],
      players: rankingData[category].length,
    })),
  };
}

export function formatDelta(delta: number) {
  if (delta > 0) return `▲ ${delta}`;
  if (delta < 0) return `▼ ${Math.abs(delta)}`;
  return "—";
}
