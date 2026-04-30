"use server";

import { eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";

import { auth } from "@/lib/auth";
import { ensureAppUser } from "@/lib/auth/ensure-app-user";
import { db } from "@/lib/db";
import {
  auditLog,
  championshipPlacements,
  championships,
  players,
  rankingEvents,
  seasons,
} from "@/lib/db/schema";
import { refreshHistoricalBestRanking } from "@/lib/ranking";

const POSITION_DELTAS: Record<number, number> = {
  1: 150,
  2: 75,
  3: 40,
};

const POSITION_LABELS: Record<number, string> = {
  1: "Campeón",
  2: "Finalista",
  3: "Tercer lugar",
};

export async function createChampionshipAction(formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Sin permisos");
  }
  if (!db) throw new Error("DB no configurada");

  const name = (formData.get("name") as string)?.trim();
  const category = formData.get("category") as "M" | "F";
  const type = formData.get("type") as "regular" | "clausura" | "especial";
  const playedOn = formData.get("playedOn") as string;
  const player1Id = formData.get("player1Id") as string;
  const player2Id = formData.get("player2Id") as string;
  const player3IdRaw = formData.get("player3Id") as string | null;
  const player3Id = player3IdRaw && player3IdRaw !== "" ? player3IdRaw : null;

  if (!name) throw new Error("El nombre es requerido");
  if (!playedOn) throw new Error("La fecha es requerida");
  if (!player1Id) throw new Error("El campeón es requerido");
  if (!player2Id) throw new Error("El finalista es requerido");
  if (player1Id === player2Id) throw new Error("El campeón y el finalista deben ser distintos");
  if (player3Id && [player1Id, player2Id].includes(player3Id)) {
    throw new Error("El tercer lugar debe ser un jugador distinto");
  }

  const [season] = await db
    .select({ id: seasons.id })
    .from(seasons)
    .where(eq(seasons.status, "activa"))
    .limit(1);
  if (!season) throw new Error("No hay temporada activa");

  const actor = await ensureAppUser(session.user);
  const userId = actor.id;

  const placements = [
    { position: 1, playerId: player1Id },
    { position: 2, playerId: player2Id },
    ...(player3Id ? [{ position: 3, playerId: player3Id }] : []),
  ];

  await db.transaction(async (tx) => {
    const [champ] = await tx
      .insert(championships)
      .values({ seasonId: season.id, name, category, type, playedOn, createdById: userId })
      .returning({ id: championships.id });

    for (const { position, playerId } of placements) {
      const delta = POSITION_DELTAS[position];
      await tx.insert(championshipPlacements).values({
        championshipId: champ.id,
        playerId,
        position,
        delta,
      });
      await tx.insert(rankingEvents).values({
        playerId,
        delta,
        reason: "championship_bonus",
        refType: "championship",
        refId: champ.id,
        note: `${name} — ${POSITION_LABELS[position]}`,
        registeredById: userId,
      });
    }

    await tx.insert(auditLog).values({
      actorId: userId,
      action: "championship.create",
      entityType: "championship",
      entityId: champ.id,
      payload: { name, category, type, playedOn, placements: placements.map((p) => p.playerId) },
    });
  });

  await refreshHistoricalBestRanking(category);
  revalidateTag("ranking", "max");
  revalidatePath("/admin/campeonatos");
  revalidatePath("/ranking/hombres");
  revalidatePath("/ranking/mujeres");
}

export async function getChampionshipsWithPlacements(category: "M" | "F") {
  if (!db) return [];

  const rows = await db
    .select({
      id: championships.id,
      name: championships.name,
      type: championships.type,
      playedOn: championships.playedOn,
      placementId: championshipPlacements.id,
      position: championshipPlacements.position,
      delta: championshipPlacements.delta,
      playerId: players.id,
      playerName: players.fullName,
    })
    .from(championships)
    .leftJoin(championshipPlacements, eq(championshipPlacements.championshipId, championships.id))
    .leftJoin(players, eq(players.id, championshipPlacements.playerId))
    .where(eq(championships.category, category))
    .orderBy(championships.playedOn);

  const byId = new Map<string, {
    id: string;
    name: string;
    type: string;
    playedOn: string;
    placements: { position: number; delta: number; playerName: string }[];
  }>();

  for (const row of rows) {
    if (!byId.has(row.id)) {
      byId.set(row.id, { id: row.id, name: row.name, type: row.type, playedOn: row.playedOn, placements: [] });
    }
    if (row.position !== null && row.playerName) {
      byId.get(row.id)!.placements.push({
        position: row.position,
        delta: row.delta ?? 0,
        playerName: row.playerName,
      });
    }
  }

  return [...byId.values()].map((c) => ({
    ...c,
    placements: c.placements.sort((a, b) => a.position - b.position),
  }));
}
