"use server";

import { eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";

import { auth } from "@/lib/auth";
import { ensureAppUser } from "@/lib/auth/ensure-app-user";
import { getTodayInSantiago } from "@/lib/date";
import { db } from "@/lib/db";
import {
  auditLog,
  matches,
  matchSets,
  players,
  rankingEvents,
} from "@/lib/db/schema";
import { notifyMatchResultRegistered } from "@/lib/email/match-result";
import { refreshHistoricalBestRanking } from "@/lib/ranking";
import {
  calculateWinLossPoints,
  getLoserReason,
  isValidMatchScore,
} from "@/lib/rules/scoring";

export type ParsedSet = {
  setNumber: number;
  gamesP1: number;
  gamesP2: number;
  tiebreakP1?: number | null;
  tiebreakP2?: number | null;
};

export type PlayerResultInput =
  | {
      kind: "scheduled";
      matchId: string;
      format: "mr3" | "set_largo" | "wo" | "empate";
      playedOn?: string;
      sets?: ParsedSet[];
      woWinnerId?: string;
      retirementLoserId?: string;
    }
  | {
      kind: "unscheduled";
      opponentId: string;
      isChallenge: boolean;
      format: "mr3" | "set_largo" | "wo" | "empate";
      playedOn?: string;
      sets?: ParsedSet[];
      woWinnerId?: string;
      retirementLoserId?: string;
    };

type MatchRecord = {
  id: string;
  player1Id: string;
  player2Id: string;
  category: "M" | "F";
};

function validateScoreInput(input: PlayerResultInput) {
  if (input.retirementLoserId) return null;

  if (input.format === "wo") {
    if (!input.woWinnerId) {
      return "Debes indicar el ganador del W.O.";
    }

    return null;
  }

  if (!input.sets?.length) return "Faltan los sets del partido";

  const validation = isValidMatchScore(
    input.sets,
    input.format === "set_largo" ? "set_largo" : "mr3",
    input.format === "empate",
  );

  return validation.valid ? null : validation.reason;
}

export async function playerReportResultAction(
  input: PlayerResultInput,
): Promise<{ success: true } | { error: string }> {
  try {
    const session = await auth();

    if (!session?.user?.email || session.user.role === "guest") {
      return { error: "No autorizado" };
    }

    if (!db) return { error: "Base de datos no configurada" };

    const actor = await ensureAppUser(session.user);

    if (!actor.playerId) {
      return { error: "Tu cuenta no está vinculada a un jugador" };
    }

    const playerId = actor.playerId;
    const resultPlayedOn = input.playedOn || getTodayInSantiago();
    let match: MatchRecord;
    let unscheduledCategory: "M" | "F" | null = null;

    if (input.kind === "scheduled") {
      const [existing] = await db
        .select({
          id: matches.id,
          player1Id: matches.player1Id,
          player2Id: matches.player2Id,
          category: matches.category,
          status: matches.status,
        })
        .from(matches)
        .where(eq(matches.id, input.matchId))
        .limit(1);

      if (!existing) return { error: "Partido no encontrado" };
      if (existing.status !== "pendiente") {
        return { error: "Este partido ya fue resuelto" };
      }
      if (existing.player1Id !== playerId && existing.player2Id !== playerId) {
        return {
          error: "No puedes reportar un partido en el que no participas",
        };
      }

      match = existing as MatchRecord;
    } else {
      if (input.opponentId === playerId) {
        return { error: "Selecciona un rival distinto a ti" };
      }

      const [myPlayer] = await db
        .select({ gender: players.gender })
        .from(players)
        .where(eq(players.id, playerId))
        .limit(1);

      if (!myPlayer) return { error: "Jugador no encontrado" };
      unscheduledCategory = myPlayer.gender;

      match = {
        id: "",
        player1Id: playerId,
        player2Id: input.opponentId,
        category: myPlayer.gender,
      };
    }

    const scoreError = validateScoreInput(input);
    if (scoreError) return { error: scoreError };

    if (
      input.format === "wo" &&
      input.woWinnerId !== match.player1Id &&
      input.woWinnerId !== match.player2Id
    ) {
      return { error: "El ganador del W.O. debe ser uno de los jugadores" };
    }

    if (
      input.retirementLoserId &&
      input.retirementLoserId !== match.player1Id &&
      input.retirementLoserId !== match.player2Id
    ) {
      return { error: "El jugador retirado debe ser uno de los jugadores" };
    }

    if (input.kind === "unscheduled") {
      const [created] = await db
        .insert(matches)
        .values({
          player1Id: playerId,
          player2Id: input.opponentId,
          category: unscheduledCategory ?? match.category,
          type: input.isChallenge ? "desafio" : "sorteo",
          status: "pendiente",
        })
        .returning({
          id: matches.id,
          player1Id: matches.player1Id,
          player2Id: matches.player2Id,
          category: matches.category,
        });

      match = created;
    }

    if (input.retirementLoserId) {
      const loserId = input.retirementLoserId;
      const winnerId =
        loserId === match.player1Id ? match.player2Id : match.player1Id;

      await db
        .update(matches)
        .set({
          status: "wo",
          format: null,
          winnerId,
          woLoserId: loserId,
          playedOn: resultPlayedOn,
          reportedAt: new Date(),
          reportedById: actor.id,
          confirmedAt: new Date(),
          confirmedById: actor.id,
        })
        .where(eq(matches.id, match.id));

      await db.insert(rankingEvents).values([
        {
          playerId: winnerId,
          delta: 60,
          reason: "wo_win" as const,
          refType: "match",
          refId: match.id,
          note: "Retiro reportado por jugador",
          registeredById: actor.id,
        },
        {
          playerId: loserId,
          delta: -20,
          reason: "wo_loss" as const,
          refType: "match",
          refId: match.id,
          note: "Retiro reportado por jugador",
          registeredById: actor.id,
        },
      ]);

      await db.insert(auditLog).values({
        actorId: actor.id,
        action: "match.player_report_retirement",
        entityType: "match",
        entityId: match.id,
        payload: {
          format: input.format,
          winnerId,
          loserId,
          sets: input.sets ?? [],
        },
      });
    } else if (input.format === "wo") {
      const woWinnerId = input.woWinnerId;
      if (!woWinnerId) return { error: "Debes indicar el ganador del W.O." };

      const loserId =
        woWinnerId === match.player1Id ? match.player2Id : match.player1Id;

      await db
        .update(matches)
        .set({
          status: "wo",
          format: null,
          winnerId: woWinnerId,
          woLoserId: loserId,
          playedOn: resultPlayedOn,
          reportedAt: new Date(),
          reportedById: actor.id,
          confirmedAt: new Date(),
          confirmedById: actor.id,
        })
        .where(eq(matches.id, match.id));

      await db.insert(rankingEvents).values([
        {
          playerId: woWinnerId,
          delta: 60,
          reason: "wo_win" as const,
          refType: "match",
          refId: match.id,
          note: "W.O. reportado por jugador",
          registeredById: actor.id,
        },
        {
          playerId: loserId,
          delta: -20,
          reason: "wo_loss" as const,
          refType: "match",
          refId: match.id,
          note: "W.O. reportado por jugador",
          registeredById: actor.id,
        },
      ]);

      await db.insert(auditLog).values({
        actorId: actor.id,
        action: "match.player_report_walkover",
        entityType: "match",
        entityId: match.id,
        payload: { winnerId: woWinnerId, loserId },
      });
    } else if (input.format === "empate") {
      const sets = input.sets;
      if (!sets?.length) return { error: "Faltan los sets del partido" };

      await db
        .update(matches)
        .set({
          status: "empate",
          format: "mr3",
          winnerId: null,
          woLoserId: null,
          playedOn: resultPlayedOn,
          reportedAt: new Date(),
          reportedById: actor.id,
          confirmedAt: new Date(),
          confirmedById: actor.id,
        })
        .where(eq(matches.id, match.id));

      await db.insert(matchSets).values(
        sets.map((s) => ({
          matchId: match.id,
          setNumber: s.setNumber,
          gamesP1: s.gamesP1,
          gamesP2: s.gamesP2,
          tiebreakP1: s.tiebreakP1 ?? null,
          tiebreakP2: s.tiebreakP2 ?? null,
        })),
      );

      await db.insert(rankingEvents).values([
        {
          playerId: match.player1Id,
          delta: 35,
          reason: "match_draw" as const,
          refType: "match",
          refId: match.id,
          note: "Empate reportado por jugador",
          registeredById: actor.id,
        },
        {
          playerId: match.player2Id,
          delta: 35,
          reason: "match_draw" as const,
          refType: "match",
          refId: match.id,
          note: "Empate reportado por jugador",
          registeredById: actor.id,
        },
      ]);

      await db.insert(auditLog).values({
        actorId: actor.id,
        action: "match.player_report_draw",
        entityType: "match",
        entityId: match.id,
        payload: { sets },
      });
    } else {
      const fmt = input.format;
      const sets = input.sets;
      if (!sets?.length) return { error: "Faltan los sets del partido" };

      const validation = isValidMatchScore(sets, fmt, false);
      if (validation.winnerIndex == null) {
        return { error: "No se determinó un ganador claro" };
      }

      const winnerId =
        validation.winnerIndex === 1 ? match.player1Id : match.player2Id;
      const loserId =
        validation.winnerIndex === 1 ? match.player2Id : match.player1Id;
      const winnerWent3Sets = fmt === "mr3" && sets.length >= 3;
      const scoring = calculateWinLossPoints(fmt, winnerWent3Sets);
      const loserReason = getLoserReason(fmt, winnerWent3Sets);

      await db
        .update(matches)
        .set({
          format: fmt,
          status: "confirmado",
          winnerId,
          woLoserId: null,
          playedOn: resultPlayedOn,
          reportedAt: new Date(),
          reportedById: actor.id,
          confirmedAt: new Date(),
          confirmedById: actor.id,
        })
        .where(eq(matches.id, match.id));

      await db.insert(matchSets).values(
        sets.map((s) => ({
          matchId: match.id,
          setNumber: s.setNumber,
          gamesP1: s.gamesP1,
          gamesP2: s.gamesP2,
          tiebreakP1: s.tiebreakP1 ?? null,
          tiebreakP2: s.tiebreakP2 ?? null,
        })),
      );

      await db.insert(rankingEvents).values([
        {
          playerId: winnerId,
          delta: scoring.winner,
          reason: "match_win" as const,
          refType: "match",
          refId: match.id,
          note: "Resultado reportado por jugador",
          registeredById: actor.id,
        },
        {
          playerId: loserId,
          delta: scoring.loser,
          reason: loserReason,
          refType: "match",
          refId: match.id,
          note: "Resultado reportado por jugador",
          registeredById: actor.id,
        },
      ]);

      await db.insert(auditLog).values({
        actorId: actor.id,
        action: "match.player_report_result",
        entityType: "match",
        entityId: match.id,
        payload: { format: fmt, winnerId, loserId, sets },
      });
    }

    await refreshHistoricalBestRanking(match.category);
    await notifyMatchResultRegistered(match.id);

    revalidateTag("ranking", "max");
    revalidatePath("/fixture");
    revalidatePath("/ranking/hombres");
    revalidatePath("/ranking/mujeres");
    revalidatePath("/ingresar-resultado");
    revalidatePath("/mi-perfil");

    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error inesperado" };
  }
}
