"use server";

import { and, eq, gt, gte, isNull, ne, or, sql } from "drizzle-orm";
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
  weeks,
} from "@/lib/db/schema";
import { notifyFixturePublished } from "@/lib/email/match-draw";
import {
  fetchPairHistorySummaries,
  getPairHistoryForPlayers,
  getPairKey,
  type PairHistoryForPlayers,
} from "@/lib/fixture/head-to-head";
import { buildMatchmakingPlayers, proposeFixture } from "@/lib/fixture/propose";
import { getRanking } from "@/lib/ranking";

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
  isChallenge?: boolean;
  history?: PairHistoryForPlayers;
};

function addBlockedOpponent(
  opponentsByPlayer: Map<string, Set<string>>,
  player1Id: string,
  player2Id: string,
) {
  if (!opponentsByPlayer.has(player1Id)) {
    opponentsByPlayer.set(player1Id, new Set());
  }
  if (!opponentsByPlayer.has(player2Id)) {
    opponentsByPlayer.set(player2Id, new Set());
  }
  opponentsByPlayer.get(player1Id)?.add(player2Id);
  opponentsByPlayer.get(player2Id)?.add(player1Id);
}

function pendingMatchesOutsideWeek(weekId: string) {
  return and(
    eq(matches.status, "pendiente"),
    or(isNull(matches.weekId), ne(matches.weekId, weekId)),
  );
}

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

  const pendingMatchRows = await dbClient
    .select({
      player1Id: matches.player1Id,
      player2Id: matches.player2Id,
    })
    .from(matches)
    .where(pendingMatchesOutsideWeek(weekId));

  const confirmedMatchRows = await dbClient
    .select({
      player1Id: matches.player1Id,
      player2Id: matches.player2Id,
      winnerId: matches.winnerId,
    })
    .from(matches)
    .where(eq(matches.status, "confirmado"));

  const recentOpponents = new Map<string, Set<string>>();
  const pendingOpponents = new Map<string, Set<string>>();
  for (const m of recentMatchRows) {
    addBlockedOpponent(recentOpponents, m.player1Id, m.player2Id);
  }
  for (const m of pendingMatchRows) {
    addBlockedOpponent(pendingOpponents, m.player1Id, m.player2Id);
  }

  const proposalPlayers = buildMatchmakingPlayers(
    availablePlayers.map((p) => ({
      id: p.id,
      fullName: p.fullName,
      points: Number(p.points),
      maxMatches: p.maxMatches,
    })),
    confirmedMatchRows,
  );

  const proposal = proposeFixture(
    proposalPlayers,
    pendingOpponents,
    recentOpponents,
  );
  const historiesByPair = await fetchPairHistorySummaries(
    dbClient,
    proposalPlayers.map((player) => player.id),
  );

  return proposal.map((pair) => ({
    p1Id: pair.player1.id,
    p1Name: pair.player1.fullName,
    p2Id: pair.player2.id,
    p2Name: pair.player2.fullName,
    history: getPairHistoryForPlayers(
      historiesByPair,
      pair.player1.id,
      pair.player2.id,
    ),
  }));
}

const pairSchema = z.object({
  player1Id: z.string().uuid(),
  player2Id: z.string().uuid(),
  category: z.enum(["M", "F"]),
  isChallenge: z.boolean().optional().default(false),
});

export async function publishFixtureAction(
  weekId: string,
  pairs: Array<{
    player1Id: string;
    player2Id: string;
    category: "M" | "F";
    isChallenge?: boolean;
  }>,
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
  const pendingMatchRows = await dbClient
    .select({
      player1Id: matches.player1Id,
      player2Id: matches.player2Id,
    })
    .from(matches)
    .where(pendingMatchesOutsideWeek(weekId));
  const pendingPairKeys = new Set(
    pendingMatchRows.map((match) =>
      getPairKey(match.player1Id, match.player2Id),
    ),
  );
  const [rankingM, rankingF] = await Promise.all([
    getRanking("hombres"),
    getRanking("mujeres"),
  ]);
  const rankingPositionByPlayer = new Map(
    [...rankingM, ...rankingF].map((entry) => [entry.id, entry.position]),
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
        "Todos los jugadores publicados deben estar en la programación de la semana",
      );
    }

    if (p1.gender !== pair.category || p2.gender !== pair.category) {
      throw new Error("La categoría del partido no coincide con sus jugadores");
    }

    if (pendingPairKeys.has(getPairKey(pair.player1Id, pair.player2Id))) {
      throw new Error(
        `${p1.fullName} y ${p2.fullName} ya tienen un partido pendiente sin resultado`,
      );
    }

    const pairKey = `${pair.category}:${[pair.player1Id, pair.player2Id]
      .sort()
      .join(":")}`;

    if (uniquePairs.has(pairKey)) {
      throw new Error("No se puede publicar el mismo cruce dos veces");
    }

    if (pair.isChallenge) {
      const rank1 = rankingPositionByPlayer.get(pair.player1Id);
      const rank2 = rankingPositionByPlayer.get(pair.player2Id);
      const rankDiff =
        rank1 !== undefined && rank2 !== undefined
          ? Math.abs(rank1 - rank2)
          : null;

      if (rankDiff === null || rankDiff > 5) {
        throw new Error(
          "Solo puedes marcar desafío cuando los jugadores están a 5 posiciones o menos en el ranking",
        );
      }
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
        or(eq(matches.type, "sorteo"), eq(matches.type, "desafio")),
        eq(matches.status, "pendiente"),
      ),
    );

  if (validPairs.length > 0) {
    await dbClient.insert(matches).values(
      validPairs.map((pair) => ({
        weekId,
        category: pair.category,
        type: pair.isChallenge ? ("desafio" as const) : ("sorteo" as const),
        player1Id: pair.player1Id,
        player2Id: pair.player2Id,
        status: "pendiente" as const,
      })),
    );
  }

  await dbClient
    .update(weeks)
    .set({
      status: "cerrada",
      availabilityClosesAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(weeks.id, weekId));

  await dbClient.insert(auditLog).values({
    actorId,
    action: "fixture.publish",
    entityType: "week",
    entityId: weekId,
    payload: { pairsCount: validPairs.length },
  });

  try {
    await notifyFixturePublished(weekId);
  } catch (error) {
    console.error(
      "Failed to send fixture published notification emails",
      error,
    );
  }

  revalidatePath(`/admin/semanas/${weekId}/fixture`);
  revalidatePath("/fixture");
}
