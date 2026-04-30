"use server";

import { and, eq, gte, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { ensureAppUser } from "@/lib/auth/ensure-app-user";
import { db } from "@/lib/db";
import { auditLog, matches, players, rankingEvents } from "@/lib/db/schema";

const schema = z.object({
  player1Id: z.string().uuid(),
  player2Id: z.string().uuid(),
  category: z.enum(["M", "F"]),
  overrideNote: z.string().max(500).optional(),
});

async function requireAdminActor() {
  const session = await auth();
  if (!session?.user?.email || session.user.role !== "admin") {
    throw new Error("No autorizado");
  }
  if (!db) throw new Error("Base de datos no configurada");
  const actor = await ensureAppUser(session.user);
  return { actorId: actor.id, dbClient: db };
}

type RankedPlayer = { id: string; points: number; rank: number };

async function getRankedPlayers(
  dbClient: NonNullable<typeof db>,
  category: "M" | "F",
): Promise<RankedPlayer[]> {
  const rows = await dbClient
    .select({
      id: players.id,
      points: sql<number>`coalesce(sum(${rankingEvents.delta}), 0)`,
    })
    .from(players)
    .leftJoin(rankingEvents, eq(rankingEvents.playerId, players.id))
    .where(and(eq(players.status, "activo"), eq(players.gender, category)))
    .groupBy(players.id)
    .orderBy(sql`coalesce(sum(${rankingEvents.delta}), 0) desc`);

  return rows.map((p, i) => ({ id: p.id, points: Number(p.points), rank: i + 1 }));
}

export async function createChallengeAction(formData: FormData) {
  const { actorId, dbClient } = await requireAdminActor();

  const parsed = schema.safeParse({
    player1Id: formData.get("player1Id"),
    player2Id: formData.get("player2Id"),
    category: formData.get("category"),
    overrideNote: formData.get("overrideNote") || undefined,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const { player1Id, player2Id, category, overrideNote } = parsed.data;

  if (player1Id === player2Id) {
    throw new Error("Los jugadores deben ser distintos");
  }

  // Verify both players exist and are active
  const [p1, p2] = await Promise.all([
    dbClient.select({ id: players.id }).from(players).where(and(eq(players.id, player1Id), eq(players.status, "activo"))).limit(1),
    dbClient.select({ id: players.id }).from(players).where(and(eq(players.id, player2Id), eq(players.status, "activo"))).limit(1),
  ]);
  if (!p1[0] || !p2[0]) throw new Error("Jugador no encontrado o inactivo");

  const rankedPlayers = await getRankedPlayers(dbClient, category);
  const rank1 = rankedPlayers.find((p) => p.id === player1Id);
  const rank2 = rankedPlayers.find((p) => p.id === player2Id);

  const violations: string[] = [];

  // RN-06: rank diff <= 5 (challenger challenges someone above them on ladder)
  if (rank1 && rank2) {
    const diff = Math.abs(rank1.rank - rank2.rank);
    if (diff > 5) {
      violations.push(`RN-06: diferencia de posición ${diff} supera el límite de 5`);
    }
  }

  // RN-03: no match in last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoff = thirtyDaysAgo.toISOString().slice(0, 10);

  const recentMatch = await dbClient
    .select({ id: matches.id })
    .from(matches)
    .where(
      and(
        or(
          and(eq(matches.player1Id, player1Id), eq(matches.player2Id, player2Id)),
          and(eq(matches.player1Id, player2Id), eq(matches.player2Id, player1Id)),
        ),
        or(eq(matches.status, "confirmado"), eq(matches.status, "wo"), eq(matches.status, "empate")),
        gte(matches.playedOn, cutoff),
      ),
    )
    .limit(1);

  if (recentMatch[0]) {
    violations.push("RN-03: estos jugadores ya se enfrentaron en los últimos 30 días");
  }

  if (violations.length > 0 && !overrideNote?.trim()) {
    throw new Error(
      `${violations.join(". ")}. Para proceder de todas formas, completá el campo "Justificación de override".`,
    );
  }

  const [match] = await dbClient
    .insert(matches)
    .values({
      player1Id,
      player2Id,
      category,
      type: "desafio",
      status: "pendiente",
    })
    .returning({ id: matches.id });

  await dbClient.insert(auditLog).values({
    actorId,
    action: "match.create_challenge",
    entityType: "match",
    entityId: match.id,
    payload: {
      player1Id,
      player2Id,
      category,
      violations,
      overrideNote: overrideNote ?? null,
    },
  });

  revalidatePath("/admin/desafios");
  revalidatePath("/admin/partidos");
}
