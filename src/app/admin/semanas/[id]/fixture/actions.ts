"use server";

import { and, eq, gt, gte, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { ensureAppUser } from "@/lib/auth/ensure-app-user";
import { db } from "@/lib/db";
import {
  auditLog,
  availability,
  matches,
  players,
  rankingEvents,
} from "@/lib/db/schema";
import { proposeFixture } from "@/lib/fixture/propose";

async function requireAdminActor() {
  const session = await auth();

  if (!session?.user?.email || session.user.role !== "admin") {
    throw new Error("No autorizado");
  }

  const dbClient = db;

  if (!dbClient) {
    throw new Error("Base de datos no configurada");
  }

  const actor = await ensureAppUser(session.user);

  return { actorId: actor.id, dbClient };
}

export type SerializedPair = {
  p1Id: string;
  p1Name: string;
  p2Id: string;
  p2Name: string;
};

export async function generateProposalAction(
  weekId: string,
  category: "M" | "F",
): Promise<SerializedPair[]> {
  const { dbClient } = await requireAdminActor();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().slice(0, 10);

  const availablePlayers = await dbClient
    .select({
      id: players.id,
      fullName: players.fullName,
      maxMatches: availability.maxMatches,
      points: sql<number>`coalesce(sum(${rankingEvents.delta}), 0)`,
    })
    .from(availability)
    .innerJoin(players, eq(availability.playerId, players.id))
    .leftJoin(rankingEvents, eq(rankingEvents.playerId, players.id))
    .where(
      and(
        eq(availability.weekId, weekId),
        eq(players.status, "activo"),
        eq(players.gender, category),
        gt(availability.maxMatches, 0),
      ),
    )
    .groupBy(players.id, players.fullName, availability.maxMatches);

  const recentMatchRows = await dbClient
    .select({
      player1Id: matches.player1Id,
      player2Id: matches.player2Id,
    })
    .from(matches)
    .where(
      and(
        or(eq(matches.status, "confirmado"), eq(matches.status, "wo")),
        gte(matches.playedOn, thirtyDaysAgoStr),
      ),
    );

  const recentOpponents = new Map<string, Set<string>>();
  for (const m of recentMatchRows) {
    if (!recentOpponents.has(m.player1Id))
      recentOpponents.set(m.player1Id, new Set());
    if (!recentOpponents.has(m.player2Id))
      recentOpponents.set(m.player2Id, new Set());
    recentOpponents.get(m.player1Id)?.add(m.player2Id);
    recentOpponents.get(m.player2Id)?.add(m.player1Id);
  }

  const proposal = proposeFixture(
    availablePlayers.map((p) => ({
      id: p.id,
      fullName: p.fullName,
      points: Number(p.points),
      maxMatches: p.maxMatches,
    })),
    recentOpponents,
  );

  return proposal.map((pair) => ({
    p1Id: pair.player1.id,
    p1Name: pair.player1.fullName,
    p2Id: pair.player2.id,
    p2Name: pair.player2.fullName,
  }));
}

const pairSchema = z.object({
  player1Id: z.string().uuid(),
  player2Id: z.string().uuid(),
  category: z.enum(["M", "F"]),
});

export async function publishFixtureAction(
  weekId: string,
  pairs: Array<{ player1Id: string; player2Id: string; category: "M" | "F" }>,
): Promise<void> {
  const { actorId, dbClient } = await requireAdminActor();

  z.string().uuid().parse(weekId);
  const validPairs = z.array(pairSchema).parse(pairs);

  const availablePlayers = await dbClient
    .select({
      id: players.id,
      fullName: players.fullName,
      gender: players.gender,
      maxMatches: availability.maxMatches,
    })
    .from(availability)
    .innerJoin(players, eq(availability.playerId, players.id))
    .where(
      and(
        eq(availability.weekId, weekId),
        eq(players.status, "activo"),
        gt(availability.maxMatches, 0),
      ),
    );

  const availableById = new Map(
    availablePlayers.map((player) => [player.id, player]),
  );
  const usageByPlayer = new Map<string, number>();
  const uniquePairs = new Set<string>();

  for (const pair of validPairs) {
    if (pair.player1Id === pair.player2Id) {
      throw new Error("Un partido no puede tener el mismo jugador dos veces");
    }

    const p1 = availableById.get(pair.player1Id);
    const p2 = availableById.get(pair.player2Id);

    if (!p1 || !p2) {
      throw new Error(
        "Todos los jugadores publicados deben tener disponibilidad",
      );
    }

    if (p1.gender !== pair.category || p2.gender !== pair.category) {
      throw new Error("La categoría del partido no coincide con sus jugadores");
    }

    const pairKey = `${pair.category}:${[pair.player1Id, pair.player2Id]
      .sort()
      .join(":")}`;

    if (uniquePairs.has(pairKey)) {
      throw new Error("No se puede publicar el mismo cruce dos veces");
    }

    uniquePairs.add(pairKey);
    usageByPlayer.set(
      pair.player1Id,
      (usageByPlayer.get(pair.player1Id) ?? 0) + 1,
    );
    usageByPlayer.set(
      pair.player2Id,
      (usageByPlayer.get(pair.player2Id) ?? 0) + 1,
    );
  }

  for (const [playerId, used] of usageByPlayer) {
    const player = availableById.get(playerId);
    if (player && used > player.maxMatches) {
      throw new Error(`${player.fullName} excede su máximo de partidos`);
    }
  }

  await dbClient
    .delete(matches)
    .where(
      and(
        eq(matches.weekId, weekId),
        eq(matches.type, "sorteo"),
        eq(matches.status, "pendiente"),
      ),
    );

  if (validPairs.length > 0) {
    await dbClient.insert(matches).values(
      validPairs.map((pair) => ({
        weekId,
        category: pair.category,
        type: "sorteo" as const,
        player1Id: pair.player1Id,
        player2Id: pair.player2Id,
        status: "pendiente" as const,
      })),
    );
  }

  await dbClient.insert(auditLog).values({
    actorId,
    action: "fixture.publish",
    entityType: "week",
    entityId: weekId,
    payload: { pairsCount: validPairs.length },
  });

  revalidatePath(`/admin/semanas/${weekId}/fixture`);
  revalidatePath("/fixture");
}
