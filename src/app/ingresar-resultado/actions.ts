"use server";

import { eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";

import { auth } from "@/lib/auth";
import { ensureAppUser } from "@/lib/auth/ensure-app-user";
import { db } from "@/lib/db";
import {
  auditLog,
  matches,
  matchSets,
  players,
  rankingEvents,
} from "@/lib/db/schema";
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
    }
  | {
      kind: "unscheduled";
      opponentId: string;
      isChallenge: boolean;
      format: "mr3" | "set_largo" | "wo" | "empate";
      playedOn?: string;
      sets?: ParsedSet[];
      woWinnerId?: string;
    };

type MatchRecord = {
  id: string;
  player1Id: string;
  player2Id: string;
  category: "M" | "F";
};

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
    let match: MatchRecord;

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
      const [myPlayer] = await db
        .select({ gender: players.gender })
        .from(players)
        .where(eq(players.id, playerId))
        .limit(1);

      if (!myPlayer) return { error: "Jugador no encontrado" };

      const [created] = await db
        .insert(matches)
        .values({
          player1Id: playerId,
          player2Id: input.opponentId,
          category: myPlayer.gender,
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

    if (input.format === "wo") {
      if (!input.woWinnerId) {
        return { error: "Debes indicar el ganador del W.O." };
      }
      if (
        input.woWinnerId !== match.player1Id &&
        input.woWinnerId !== match.player2Id
      ) {
        return { error: "El ganador del W.O. debe ser uno de los jugadores" };
      }

      const loserId =
        input.woWinnerId === match.player1Id
          ? match.player2Id
          : match.player1Id;

      await db
        .update(matches)
        .set({
          status: "wo",
          format: null,
          winnerId: input.woWinnerId,
          woLoserId: loserId,
          playedOn: input.playedOn ?? null,
          reportedAt: new Date(),
          reportedById: actor.id,
          confirmedAt: new Date(),
          confirmedById: actor.id,
        })
        .where(eq(matches.id, match.id));

      await db.insert(rankingEvents).values([
        {
          playerId: input.woWinnerId,
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
        payload: { winnerId: input.woWinnerId, loserId },
      });
    } else if (input.format === "empate") {
      if (!input.sets?.length) return { error: "Faltan los sets del partido" };

      const validation = isValidMatchScore(input.sets, "mr3", true);
      if (!validation.valid) return { error: validation.reason };

      await db
        .update(matches)
        .set({
          status: "empate",
          format: "mr3",
          winnerId: null,
          woLoserId: null,
          playedOn: input.playedOn ?? null,
          reportedAt: new Date(),
          reportedById: actor.id,
          confirmedAt: new Date(),
          confirmedById: actor.id,
        })
        .where(eq(matches.id, match.id));

      await db.insert(matchSets).values(
        input.sets.map((s) => ({
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
        payload: { sets: input.sets },
      });
    } else {
      if (!input.sets?.length) return { error: "Faltan los sets del partido" };

      const fmt = input.format;
      const validation = isValidMatchScore(input.sets, fmt, false);
      if (!validation.valid) return { error: validation.reason };
      if (validation.winnerIndex == null) {
        return { error: "No se determinó un ganador claro" };
      }

      const winnerId =
        validation.winnerIndex === 1 ? match.player1Id : match.player2Id;
      const loserId =
        validation.winnerIndex === 1 ? match.player2Id : match.player1Id;
      const winnerWent3Sets = fmt === "mr3" && input.sets.length >= 3;
      const scoring = calculateWinLossPoints(fmt, winnerWent3Sets);
      const loserReason = getLoserReason(fmt, winnerWent3Sets);

      await db
        .update(matches)
        .set({
          format: fmt,
          status: "confirmado",
          winnerId,
          woLoserId: null,
          playedOn: input.playedOn ?? null,
          reportedAt: new Date(),
          reportedById: actor.id,
          confirmedAt: new Date(),
          confirmedById: actor.id,
        })
        .where(eq(matches.id, match.id));

      await db.insert(matchSets).values(
        input.sets.map((s) => ({
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
        payload: { format: fmt, winnerId, loserId, sets: input.sets },
      });
    }

    await refreshHistoricalBestRanking(match.category);

    revalidateTag("ranking", "max");
    revalidatePath("/admin/partidos");
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
