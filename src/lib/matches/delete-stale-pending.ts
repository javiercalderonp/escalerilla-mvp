import { and, eq, isNull, lte } from "drizzle-orm";

import { db } from "@/lib/db";
import { auditLog, matches } from "@/lib/db/schema";
import { getStalePendingMatchCutoff } from "@/lib/matches/stale-pending";

export async function deleteStalePendingMatches(now = new Date()) {
  const dbClient = db;

  if (!dbClient) {
    throw new Error("Base de datos no configurada");
  }

  const cutoff = getStalePendingMatchCutoff(now);
  const deletedMatches = await dbClient
    .delete(matches)
    .where(
      and(
        eq(matches.status, "pendiente"),
        isNull(matches.reportedAt),
        lte(matches.createdAt, cutoff),
      ),
    )
    .returning({
      id: matches.id,
      weekId: matches.weekId,
      category: matches.category,
      type: matches.type,
      player1Id: matches.player1Id,
      player2Id: matches.player2Id,
      createdAt: matches.createdAt,
    });

  if (deletedMatches.length > 0) {
    await dbClient.insert(auditLog).values(
      deletedMatches.map((match) => ({
        action: "match.auto_delete_stale_pending",
        entityType: "match",
        entityId: match.id,
        payload: {
          ...match,
          reason: "pending_without_result_for_21_days",
          cutoff: cutoff.toISOString(),
        },
      })),
    );
  }

  return {
    cutoff: cutoff.toISOString(),
    deletedCount: deletedMatches.length,
    deletedMatchIds: deletedMatches.map((match) => match.id),
  };
}
