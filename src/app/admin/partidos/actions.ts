"use server";

import { eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { ensureAppUser } from "@/lib/auth/ensure-app-user";
import { db } from "@/lib/db";
import {
  auditLog,
  matches,
  matchSets,
  rankingEvents,
} from "@/lib/db/schema";
import {
  calculateWinLossPoints,
  getLoserReason,
  isValidMatchScore,
} from "@/lib/rules/scoring";
import { refreshHistoricalBestRanking } from "@/lib/ranking";

const createMatchSchema = z.object({
  player1Id: z.string().uuid(),
  player2Id: z.string().uuid(),
  category: z.enum(["M", "F"]),
  type: z.enum(["sorteo", "desafio", "campeonato"]).default("sorteo"),
});

const optionalScoreField = z.coerce.number().int().min(0).max(20).optional();

const resultSchema = z.object({
  matchId: z.string().uuid(),
  format: z.enum(["mr3", "set_largo"]),
  playedOn: z.string().optional(),
  set1p1: z.coerce.number().int().min(0).max(20),
  set1p2: z.coerce.number().int().min(0).max(20),
  set1tbp1: optionalScoreField,
  set1tbp2: optionalScoreField,
  set2p1: optionalScoreField,
  set2p2: optionalScoreField,
  set2tbp1: optionalScoreField,
  set2tbp2: optionalScoreField,
  set3p1: optionalScoreField,
  set3p2: optionalScoreField,
});

const walkoverSchema = z.object({
  matchId: z.string().uuid(),
  playedOn: z.string().optional(),
  winnerId: z.string().uuid(),
});

type ParsedSet = {
  setNumber: number;
  gamesP1: number;
  gamesP2: number;
  tiebreakP1?: number | null;
  tiebreakP2?: number | null;
};

type MatchForResolution = {
  id: string;
  player1Id: string;
  player2Id: string;
  category: "M" | "F";
  status: "pendiente" | "reportado" | "confirmado" | "wo" | "empate";
  format: "mr3" | "set_largo" | null;
  winnerId: string | null;
  woLoserId: string | null;
};

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

function getOptionalNumber(value: FormDataEntryValue | null) {
  if (value == null) return undefined;
  const text = value.toString().trim();
  return text === "" ? undefined : text;
}

function parseSets(parsed: z.infer<typeof resultSchema>) {
  const sets: ParsedSet[] = [
    {
      setNumber: 1,
      gamesP1: parsed.set1p1,
      gamesP2: parsed.set1p2,
      tiebreakP1: parsed.set1tbp1,
      tiebreakP2: parsed.set1tbp2,
    },
  ];

  if (parsed.format === "set_largo") {
    return sets;
  }

  if (parsed.set2p1 == null || parsed.set2p2 == null) {
    throw new Error("Falta completar el set 2");
  }

  sets.push({
    setNumber: 2,
    gamesP1: parsed.set2p1,
    gamesP2: parsed.set2p2,
    tiebreakP1: parsed.set2tbp1,
    tiebreakP2: parsed.set2tbp2,
  });

  if ((parsed.set3p1 == null) !== (parsed.set3p2 == null)) {
    throw new Error("El set 3 debe venir completo");
  }

  if (parsed.set3p1 != null && parsed.set3p2 != null) {
    sets.push({
      setNumber: 3,
      gamesP1: parsed.set3p1,
      gamesP2: parsed.set3p2,
    });
  }

  return sets;
}

async function getMatchOrThrow(matchId: string) {
  const dbClient = db;

  if (!dbClient) {
    throw new Error("Base de datos no configurada");
  }

  const [match] = await dbClient
    .select({
      id: matches.id,
      player1Id: matches.player1Id,
      player2Id: matches.player2Id,
      category: matches.category,
      status: matches.status,
      format: matches.format,
      winnerId: matches.winnerId,
      woLoserId: matches.woLoserId,
    })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);

  if (!match) {
    throw new Error("Partido no encontrado");
  }

  return match as MatchForResolution;
}

async function getPendingMatchOrThrow(matchId: string) {
  const match = await getMatchOrThrow(matchId);

  if (match.status !== "pendiente" && match.status !== "reportado") {
    throw new Error("Este partido ya fue resuelto");
  }

  return match;
}

async function getResolvedMatchOrThrow(matchId: string) {
  const match = await getMatchOrThrow(matchId);

  if (
    match.status !== "confirmado" &&
    match.status !== "empate" &&
    match.status !== "wo"
  ) {
    throw new Error("Solo puedes corregir partidos ya resueltos");
  }

  return match;
}

async function getStoredSets(matchId: string) {
  const dbClient = db;

  if (!dbClient) {
    throw new Error("Base de datos no configurada");
  }

  return dbClient
    .select({
      setNumber: matchSets.setNumber,
      gamesP1: matchSets.gamesP1,
      gamesP2: matchSets.gamesP2,
      tiebreakP1: matchSets.tiebreakP1,
      tiebreakP2: matchSets.tiebreakP2,
    })
    .from(matchSets)
    .where(eq(matchSets.matchId, matchId));
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

function getCurrentOutcomeEvents(match: MatchForResolution, sets: ParsedSet[]) {
  if (match.status === "empate") {
    return [
      {
        playerId: match.player1Id,
        delta: 35,
        reason: "match_draw" as const,
      },
      {
        playerId: match.player2Id,
        delta: 35,
        reason: "match_draw" as const,
      },
    ];
  }

  if (match.status === "wo") {
    if (!match.winnerId || !match.woLoserId) {
      throw new Error("El partido W.O. actual está incompleto");
    }

    return [
      {
        playerId: match.winnerId,
        delta: 60,
        reason: "wo_win" as const,
      },
      {
        playerId: match.woLoserId,
        delta: -20,
        reason: "wo_loss" as const,
      },
    ];
  }

  if (match.status === "confirmado") {
    if (!match.format || !match.winnerId) {
      throw new Error("El partido confirmado actual está incompleto");
    }

    const loserId =
      match.winnerId === match.player1Id ? match.player2Id : match.player1Id;
    const winnerWent3Sets = match.format === "mr3" && sets.length >= 3;
    const scoring = calculateWinLossPoints(match.format, winnerWent3Sets);

    return [
      {
        playerId: match.winnerId,
        delta: scoring.winner,
        reason: "match_win" as const,
      },
      {
        playerId: loserId,
        delta: scoring.loser,
        reason: getLoserReason(match.format, winnerWent3Sets),
      },
    ];
  }

  return [];
}

async function insertCompensationEvents(args: {
  match: MatchForResolution;
  actorId: string | null;
}) {
  const sets = await getStoredSets(args.match.id);
  const currentEvents = getCurrentOutcomeEvents(
    args.match,
    sets as ParsedSet[],
  );

  return currentEvents.map((event) => ({
    playerId: event.playerId,
    delta: event.delta * -1,
    reason: "match_correction" as const,
    refType: "match",
    refId: args.match.id,
    note: `Corrección compensatoria de ${event.reason}`,
    registeredById: args.actorId,
  }));
}

function revalidateMatchSurfaces() {
  revalidateTag("ranking", "max");
  revalidatePath("/admin/partidos");
  revalidatePath("/ranking/hombres");
  revalidatePath("/ranking/mujeres");
}

async function refreshRankingAfterResult(category: "M" | "F") {
  await refreshHistoricalBestRanking(category);
  revalidateMatchSurfaces();
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

function parseResultForm(formData: FormData) {
  return resultSchema.safeParse({
    matchId: formData.get("matchId"),
    format: formData.get("format"),
    playedOn: formData.get("playedOn") ?? undefined,
    set1p1: formData.get("set1p1"),
    set1p2: formData.get("set1p2"),
    set1tbp1: getOptionalNumber(formData.get("set1tbp1")),
    set1tbp2: getOptionalNumber(formData.get("set1tbp2")),
    set2p1: getOptionalNumber(formData.get("set2p1")),
    set2p2: getOptionalNumber(formData.get("set2p2")),
    set2tbp1: getOptionalNumber(formData.get("set2tbp1")),
    set2tbp2: getOptionalNumber(formData.get("set2tbp2")),
    set3p1: getOptionalNumber(formData.get("set3p1")),
    set3p2: getOptionalNumber(formData.get("set3p2")),
  });
}

async function applyConfirmedResult(args: {
  dbClient: NonNullable<typeof db>;
  actorId: string | null;
  parsed: z.infer<typeof resultSchema>;
  match: MatchForResolution;
  isCorrection: boolean;
}) {
  const sets = parseSets(args.parsed);
  const winnerIndex = resolveWinner(sets, args.parsed.format);
  const winnerId =
    winnerIndex === 1 ? args.match.player1Id : args.match.player2Id;
  const loserId =
    winnerIndex === 1 ? args.match.player2Id : args.match.player1Id;
  const winnerWent3Sets = args.parsed.format === "mr3" && sets.length >= 3;
  const scoring = calculateWinLossPoints(args.parsed.format, winnerWent3Sets);
  const loserReason = getLoserReason(args.parsed.format, winnerWent3Sets);
  const compensationEvents = args.isCorrection
    ? await insertCompensationEvents({
        match: args.match,
        actorId: args.actorId,
      })
    : [];

  await args.dbClient.transaction(async (tx) => {
    if (compensationEvents.length > 0) {
      for (const event of compensationEvents) {
        await tx.insert(rankingEvents).values(event);
      }
    }

    await tx
      .update(matches)
      .set({
        format: args.parsed.format,
        status: "confirmado",
        winnerId,
        woLoserId: null,
        playedOn: args.parsed.playedOn || null,
        confirmedAt: new Date(),
        confirmedById: args.actorId,
      })
      .where(eq(matches.id, args.parsed.matchId));

    await tx
      .delete(matchSets)
      .where(eq(matchSets.matchId, args.parsed.matchId));

    await tx.insert(matchSets).values(
      sets.map((set) => ({
        matchId: args.parsed.matchId,
        setNumber: set.setNumber,
        gamesP1: set.gamesP1,
        gamesP2: set.gamesP2,
        tiebreakP1: set.tiebreakP1 ?? null,
        tiebreakP2: set.tiebreakP2 ?? null,
      })),
    );

    await tx.insert(rankingEvents).values({
      playerId: winnerId,
      delta: scoring.winner,
      reason: "match_win",
      refType: "match",
      refId: args.parsed.matchId,
      note: args.isCorrection
        ? "Resultado corregido desde admin"
        : "Resultado confirmado desde admin",
      registeredById: args.actorId,
    });

    await tx.insert(rankingEvents).values({
      playerId: loserId,
      delta: scoring.loser,
      reason: loserReason,
      refType: "match",
      refId: args.parsed.matchId,
      note: args.isCorrection
        ? "Resultado corregido desde admin"
        : "Resultado confirmado desde admin",
      registeredById: args.actorId,
    });

    await tx.insert(auditLog).values({
      actorId: args.actorId,
      action: args.isCorrection
        ? "match.correct_result"
        : "match.register_result",
      entityType: "match",
      entityId: args.parsed.matchId,
      payload: {
        format: args.parsed.format,
        winnerId,
        loserId,
        sets,
        corrected: args.isCorrection,
      },
    });
  });
}

async function applyDrawResult(args: {
  dbClient: NonNullable<typeof db>;
  actorId: string | null;
  parsed: z.infer<typeof resultSchema>;
  match: MatchForResolution;
  isCorrection: boolean;
}) {
  const sets = parseSets(args.parsed);
  const validation = isValidMatchScore(sets, args.parsed.format, true);

  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  const drawDelta = 35;
  const compensationEvents = args.isCorrection
    ? await insertCompensationEvents({
        match: args.match,
        actorId: args.actorId,
      })
    : [];

  await args.dbClient.transaction(async (tx) => {
    if (compensationEvents.length > 0) {
      for (const event of compensationEvents) {
        await tx.insert(rankingEvents).values(event);
      }
    }

    await tx
      .update(matches)
      .set({
        format: args.parsed.format,
        status: "empate",
        winnerId: null,
        woLoserId: null,
        playedOn: args.parsed.playedOn || null,
        confirmedAt: new Date(),
        confirmedById: args.actorId,
      })
      .where(eq(matches.id, args.parsed.matchId));

    await tx
      .delete(matchSets)
      .where(eq(matchSets.matchId, args.parsed.matchId));

    await tx.insert(matchSets).values(
      sets.map((set) => ({
        matchId: args.parsed.matchId,
        setNumber: set.setNumber,
        gamesP1: set.gamesP1,
        gamesP2: set.gamesP2,
        tiebreakP1: set.tiebreakP1 ?? null,
        tiebreakP2: set.tiebreakP2 ?? null,
      })),
    );

    for (const playerId of [args.match.player1Id, args.match.player2Id]) {
      await tx.insert(rankingEvents).values({
        playerId,
        delta: drawDelta,
        reason: "match_draw",
        refType: "match",
        refId: args.parsed.matchId,
        note: args.isCorrection
          ? "Empate corregido desde admin"
          : "Empate confirmado desde admin",
        registeredById: args.actorId,
      });
    }

    await tx.insert(auditLog).values({
      actorId: args.actorId,
      action: args.isCorrection ? "match.correct_draw" : "match.register_draw",
      entityType: "match",
      entityId: args.parsed.matchId,
      payload: {
        format: args.parsed.format,
        sets,
        corrected: args.isCorrection,
      },
    });
  });
}

async function applyWalkoverResult(args: {
  dbClient: NonNullable<typeof db>;
  actorId: string | null;
  parsed: z.infer<typeof walkoverSchema>;
  match: MatchForResolution;
  isCorrection: boolean;
}) {
  if (
    args.parsed.winnerId !== args.match.player1Id &&
    args.parsed.winnerId !== args.match.player2Id
  ) {
    throw new Error(
      "El ganador del W.O. debe ser uno de los jugadores del partido",
    );
  }

  const winnerId = args.parsed.winnerId;
  const loserId =
    winnerId === args.match.player1Id
      ? args.match.player2Id
      : args.match.player1Id;
  const compensationEvents = args.isCorrection
    ? await insertCompensationEvents({
        match: args.match,
        actorId: args.actorId,
      })
    : [];

  await args.dbClient.transaction(async (tx) => {
    if (compensationEvents.length > 0) {
      for (const event of compensationEvents) {
        await tx.insert(rankingEvents).values(event);
      }
    }

    await tx
      .update(matches)
      .set({
        status: "wo",
        format: null,
        winnerId,
        woLoserId: loserId,
        playedOn: args.parsed.playedOn || null,
        confirmedAt: new Date(),
        confirmedById: args.actorId,
      })
      .where(eq(matches.id, args.parsed.matchId));

    await tx
      .delete(matchSets)
      .where(eq(matchSets.matchId, args.parsed.matchId));

    await tx.insert(rankingEvents).values({
      playerId: winnerId,
      delta: 60,
      reason: "wo_win",
      refType: "match",
      refId: args.parsed.matchId,
      note: args.isCorrection
        ? "W.O. corregido desde admin"
        : "W.O. confirmado desde admin",
      registeredById: args.actorId,
    });

    await tx.insert(rankingEvents).values({
      playerId: loserId,
      delta: -20,
      reason: "wo_loss",
      refType: "match",
      refId: args.parsed.matchId,
      note: args.isCorrection
        ? "W.O. corregido desde admin"
        : "W.O. confirmado desde admin",
      registeredById: args.actorId,
    });

    await tx.insert(auditLog).values({
      actorId: args.actorId,
      action: args.isCorrection
        ? "match.correct_walkover"
        : "match.register_walkover",
      entityType: "match",
      entityId: args.parsed.matchId,
      payload: {
        winnerId,
        loserId,
        corrected: args.isCorrection,
      },
    });
  });
}

export async function registerResultAction(formData: FormData) {
  const { actorId, dbClient } = await requireAdminActor();
  const parsed = parseResultForm(formData);

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const match = await getPendingMatchOrThrow(parsed.data.matchId);
  await applyConfirmedResult({
    dbClient,
    actorId,
    parsed: parsed.data,
    match,
    isCorrection: false,
  });

  await refreshRankingAfterResult(match.category);
}

export async function registerDrawAction(formData: FormData) {
  const { actorId, dbClient } = await requireAdminActor();
  const parsed = parseResultForm(formData);

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const match = await getPendingMatchOrThrow(parsed.data.matchId);
  await applyDrawResult({
    dbClient,
    actorId,
    parsed: parsed.data,
    match,
    isCorrection: false,
  });

  await refreshRankingAfterResult(match.category);
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
  await applyWalkoverResult({
    dbClient,
    actorId,
    parsed: parsed.data,
    match,
    isCorrection: false,
  });

  await refreshRankingAfterResult(match.category);
}

export async function correctResultAction(formData: FormData) {
  const { actorId, dbClient } = await requireAdminActor();
  const parsed = parseResultForm(formData);

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const match = await getResolvedMatchOrThrow(parsed.data.matchId);
  await applyConfirmedResult({
    dbClient,
    actorId,
    parsed: parsed.data,
    match,
    isCorrection: true,
  });

  await refreshRankingAfterResult(match.category);
}

export async function correctDrawAction(formData: FormData) {
  const { actorId, dbClient } = await requireAdminActor();
  const parsed = parseResultForm(formData);

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const match = await getResolvedMatchOrThrow(parsed.data.matchId);
  await applyDrawResult({
    dbClient,
    actorId,
    parsed: parsed.data,
    match,
    isCorrection: true,
  });

  await refreshRankingAfterResult(match.category);
}

export async function correctWalkoverAction(formData: FormData) {
  const { actorId, dbClient } = await requireAdminActor();
  const parsed = walkoverSchema.safeParse({
    matchId: formData.get("matchId"),
    playedOn: formData.get("playedOn") ?? undefined,
    winnerId: formData.get("winnerId"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const match = await getResolvedMatchOrThrow(parsed.data.matchId);
  await applyWalkoverResult({
    dbClient,
    actorId,
    parsed: parsed.data,
    match,
    isCorrection: true,
  });

  await refreshRankingAfterResult(match.category);
}
