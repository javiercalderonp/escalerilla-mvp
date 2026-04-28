"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  auditLog,
  matches,
  matchSets,
  rankingEvents,
  users,
} from "@/lib/db/schema";
import {
  calculateWinLossPoints,
  getLoserReason,
  isValidMatchScore,
} from "@/lib/rules/scoring";

const createMatchSchema = z.object({
  player1Id: z.string().uuid(),
  player2Id: z.string().uuid(),
  category: z.enum(["M", "F"]),
  type: z.enum(["sorteo", "desafio", "campeonato"]).default("sorteo"),
});

const resultSchema = z.object({
  matchId: z.string().uuid(),
  format: z.enum(["mr3", "set_largo"]),
  playedOn: z.string().optional(),
  set1p1: z.coerce.number().int().min(0).max(20),
  set1p2: z.coerce.number().int().min(0).max(20),
  set2p1: z.coerce.number().int().min(0).max(20).optional(),
  set2p2: z.coerce.number().int().min(0).max(20).optional(),
  set3p1: z.coerce.number().int().min(0).max(20).optional(),
  set3p2: z.coerce.number().int().min(0).max(20).optional(),
});

const walkoverSchema = z.object({
  matchId: z.string().uuid(),
  playedOn: z.string().optional(),
  winnerId: z.string().uuid(),
});

type ParsedSet = { setNumber: number; gamesP1: number; gamesP2: number };

async function requireAdminActor() {
  const session = await auth();

  if (!session?.user?.email || session.user.role !== "admin") {
    throw new Error("No autorizado");
  }

  const dbClient = db;

  if (!dbClient) {
    throw new Error("Base de datos no configurada");
  }

  const [actor] = await dbClient
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, session.user.email.toLowerCase()))
    .limit(1);

  return { actorId: actor?.id ?? null, dbClient };
}

function parseSets(parsed: z.infer<typeof resultSchema>) {
  const sets: ParsedSet[] = [
    { setNumber: 1, gamesP1: parsed.set1p1, gamesP2: parsed.set1p2 },
  ];

  if (parsed.format === "set_largo") {
    return sets;
  }

  if (parsed.set2p1 == null || parsed.set2p2 == null) {
    throw new Error("Falta completar el set 2");
  }

  sets.push({ setNumber: 2, gamesP1: parsed.set2p1, gamesP2: parsed.set2p2 });

  if (parsed.set3p1 != null && parsed.set3p2 != null) {
    sets.push({ setNumber: 3, gamesP1: parsed.set3p1, gamesP2: parsed.set3p2 });
  }

  return sets;
}

async function getPendingMatchOrThrow(matchId: string) {
  const dbClient = db;

  if (!dbClient) {
    throw new Error("Base de datos no configurada");
  }

  const [match] = await dbClient
    .select({
      id: matches.id,
      player1Id: matches.player1Id,
      player2Id: matches.player2Id,
      status: matches.status,
    })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);

  if (!match) {
    throw new Error("Partido no encontrado");
  }

  if (match.status !== "pendiente" && match.status !== "reportado") {
    throw new Error("Este partido ya fue resuelto");
  }

  return match;
}

function resolveWinner(sets: ParsedSet[], format: "mr3" | "set_largo") {
  const validation = isValidMatchScore(sets, format, false);

  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  if (validation.winnerIndex == null) {
    throw new Error("El resultado no deja un ganador claro");
  }

  return validation.winnerIndex;
}

function revalidateMatchSurfaces() {
  revalidatePath("/admin/partidos");
  revalidatePath("/ranking/hombres");
  revalidatePath("/ranking/mujeres");
}

export async function createMatchAction(formData: FormData) {
  const { actorId, dbClient } = await requireAdminActor();
  const parsed = createMatchSchema.safeParse({
    player1Id: formData.get("player1Id"),
    player2Id: formData.get("player2Id"),
    category: formData.get("category"),
    type: formData.get("type") ?? "sorteo",
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  if (parsed.data.player1Id === parsed.data.player2Id) {
    throw new Error(
      "No puedes crear un partido con el mismo jugador dos veces",
    );
  }

  const [match] = await dbClient
    .insert(matches)
    .values({
      player1Id: parsed.data.player1Id,
      player2Id: parsed.data.player2Id,
      category: parsed.data.category,
      type: parsed.data.type,
      status: "pendiente",
    })
    .returning({ id: matches.id });

  await dbClient.insert(auditLog).values({
    actorId,
    action: "match.create",
    entityType: "match",
    entityId: match.id,
    payload: parsed.data,
  });

  revalidatePath("/admin/partidos");
}

export async function registerResultAction(formData: FormData) {
  const { actorId, dbClient } = await requireAdminActor();
  const parsed = resultSchema.safeParse({
    matchId: formData.get("matchId"),
    format: formData.get("format"),
    playedOn: formData.get("playedOn") ?? undefined,
    set1p1: formData.get("set1p1"),
    set1p2: formData.get("set1p2"),
    set2p1: formData.get("set2p1") ?? undefined,
    set2p2: formData.get("set2p2") ?? undefined,
    set3p1: formData.get("set3p1") ?? undefined,
    set3p2: formData.get("set3p2") ?? undefined,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const sets = parseSets(parsed.data);
  const match = await getPendingMatchOrThrow(parsed.data.matchId);
  const winnerIndex = resolveWinner(sets, parsed.data.format);
  const winnerId = winnerIndex === 1 ? match.player1Id : match.player2Id;
  const loserId = winnerIndex === 1 ? match.player2Id : match.player1Id;
  const winnerWent3Sets = parsed.data.format === "mr3" && sets.length >= 3;
  const scoring = calculateWinLossPoints(parsed.data.format, winnerWent3Sets);
  const loserReason = getLoserReason(parsed.data.format, winnerWent3Sets);

  await dbClient.transaction(async (tx) => {
    await tx
      .update(matches)
      .set({
        format: parsed.data.format,
        status: "confirmado",
        winnerId,
        woLoserId: null,
        playedOn: parsed.data.playedOn || null,
        confirmedAt: new Date(),
        confirmedById: actorId,
      })
      .where(eq(matches.id, parsed.data.matchId));

    await tx
      .delete(matchSets)
      .where(eq(matchSets.matchId, parsed.data.matchId));

    await tx.insert(matchSets).values(
      sets.map((set) => ({
        matchId: parsed.data.matchId,
        setNumber: set.setNumber,
        gamesP1: set.gamesP1,
        gamesP2: set.gamesP2,
      })),
    );

    await tx.insert(rankingEvents).values({
      playerId: winnerId,
      delta: scoring.winner,
      reason: "match_win",
      refType: "match",
      refId: parsed.data.matchId,
      note: "Resultado confirmado desde admin",
      registeredById: actorId,
    });

    await tx.insert(rankingEvents).values({
      playerId: loserId,
      delta: scoring.loser,
      reason: loserReason,
      refType: "match",
      refId: parsed.data.matchId,
      note: "Resultado confirmado desde admin",
      registeredById: actorId,
    });

    await tx.insert(auditLog).values({
      actorId,
      action: "match.register_result",
      entityType: "match",
      entityId: parsed.data.matchId,
      payload: {
        format: parsed.data.format,
        winnerId,
        loserId,
        sets,
      },
    });
  });

  revalidateMatchSurfaces();
}

export async function registerDrawAction(formData: FormData) {
  const { actorId, dbClient } = await requireAdminActor();
  const parsed = resultSchema.safeParse({
    matchId: formData.get("matchId"),
    format: formData.get("format") ?? "mr3",
    playedOn: formData.get("playedOn") ?? undefined,
    set1p1: formData.get("set1p1"),
    set1p2: formData.get("set1p2"),
    set2p1: formData.get("set2p1") ?? undefined,
    set2p2: formData.get("set2p2") ?? undefined,
    set3p1: formData.get("set3p1") ?? undefined,
    set3p2: formData.get("set3p2") ?? undefined,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const sets = parseSets(parsed.data);
  const validation = isValidMatchScore(sets, parsed.data.format, true);

  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  const match = await getPendingMatchOrThrow(parsed.data.matchId);
  const drawDelta = 35;

  await dbClient.transaction(async (tx) => {
    await tx
      .update(matches)
      .set({
        format: parsed.data.format,
        status: "empate",
        winnerId: null,
        woLoserId: null,
        playedOn: parsed.data.playedOn || null,
        confirmedAt: new Date(),
        confirmedById: actorId,
      })
      .where(eq(matches.id, parsed.data.matchId));

    await tx
      .delete(matchSets)
      .where(eq(matchSets.matchId, parsed.data.matchId));

    await tx.insert(matchSets).values(
      sets.map((set) => ({
        matchId: parsed.data.matchId,
        setNumber: set.setNumber,
        gamesP1: set.gamesP1,
        gamesP2: set.gamesP2,
      })),
    );

    await tx.insert(rankingEvents).values({
      playerId: match.player1Id,
      delta: drawDelta,
      reason: "match_draw",
      refType: "match",
      refId: parsed.data.matchId,
      note: "Empate confirmado desde admin",
      registeredById: actorId,
    });

    await tx.insert(rankingEvents).values({
      playerId: match.player2Id,
      delta: drawDelta,
      reason: "match_draw",
      refType: "match",
      refId: parsed.data.matchId,
      note: "Empate confirmado desde admin",
      registeredById: actorId,
    });

    await tx.insert(auditLog).values({
      actorId,
      action: "match.register_draw",
      entityType: "match",
      entityId: parsed.data.matchId,
      payload: {
        format: parsed.data.format,
        sets,
      },
    });
  });

  revalidateMatchSurfaces();
}

export async function registerWalkoverAction(formData: FormData) {
  const { actorId, dbClient } = await requireAdminActor();
  const parsed = walkoverSchema.safeParse({
    matchId: formData.get("matchId"),
    playedOn: formData.get("playedOn") ?? undefined,
    winnerId: formData.get("winnerId"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const match = await getPendingMatchOrThrow(parsed.data.matchId);

  if (
    parsed.data.winnerId !== match.player1Id &&
    parsed.data.winnerId !== match.player2Id
  ) {
    throw new Error(
      "El ganador del W.O. debe ser uno de los jugadores del partido",
    );
  }

  const winnerId = parsed.data.winnerId;
  const loserId =
    winnerId === match.player1Id ? match.player2Id : match.player1Id;
  const winnerDelta = 60;
  const loserDelta = -20;

  await dbClient.transaction(async (tx) => {
    await tx
      .update(matches)
      .set({
        status: "wo",
        format: null,
        winnerId,
        woLoserId: loserId,
        playedOn: parsed.data.playedOn || null,
        confirmedAt: new Date(),
        confirmedById: actorId,
      })
      .where(eq(matches.id, parsed.data.matchId));

    await tx
      .delete(matchSets)
      .where(eq(matchSets.matchId, parsed.data.matchId));

    await tx.insert(rankingEvents).values({
      playerId: winnerId,
      delta: winnerDelta,
      reason: "wo_win",
      refType: "match",
      refId: parsed.data.matchId,
      note: "W.O. confirmado desde admin",
      registeredById: actorId,
    });

    await tx.insert(rankingEvents).values({
      playerId: loserId,
      delta: loserDelta,
      reason: "wo_loss",
      refType: "match",
      refId: parsed.data.matchId,
      note: "W.O. confirmado desde admin",
      registeredById: actorId,
    });

    await tx.insert(auditLog).values({
      actorId,
      action: "match.register_walkover",
      entityType: "match",
      entityId: parsed.data.matchId,
      payload: {
        winnerId,
        loserId,
      },
    });
  });

  revalidateMatchSurfaces();
}
