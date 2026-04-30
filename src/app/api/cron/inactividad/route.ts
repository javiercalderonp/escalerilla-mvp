import { and, eq, gte, lte, or, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  auditLog,
  freezes,
  matches,
  players,
  rankingEvents,
} from "@/lib/db/schema";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // Allow: Vercel cron bearer token, or admin manual trigger (no secret configured in dev)
  const isVercelCron = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const isDevRun = !cronSecret && process.env.NODE_ENV !== "production";

  if (!isVercelCron && !isDevRun) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!db) {
    return Response.json({ error: "DB not configured" }, { status: 500 });
  }

  const todayStr = today();
  const applied: Array<{
    playerId: string;
    name: string;
    reason: string;
    delta: number;
  }> = [];
  const skipped: Array<{ playerId: string; name: string; reason: string }> = [];

  // Load all active players with points + last match date
  const activePlayers = await db
    .select({
      id: players.id,
      fullName: players.fullName,
      points: sql<number>`coalesce(sum(${rankingEvents.delta}), 0)`,
    })
    .from(players)
    .leftJoin(rankingEvents, eq(rankingEvents.playerId, players.id))
    .where(eq(players.status, "activo"))
    .groupBy(players.id, players.fullName);

  // Last match date per player — fetch all completed matches and aggregate in JS
  const allRelevantMatches = await db
    .select({
      player1Id: matches.player1Id,
      player2Id: matches.player2Id,
      playedOn: matches.playedOn,
    })
    .from(matches)
    .where(
      or(
        eq(matches.status, "confirmado"),
        eq(matches.status, "wo"),
        eq(matches.status, "empate"),
      ),
    );

  const lastMatchMap = new Map<string, string>(); // playerId → lastPlayedOn
  for (const m of allRelevantMatches) {
    if (!m.playedOn) continue;
    for (const pid of [m.player1Id, m.player2Id]) {
      const current = lastMatchMap.get(pid);
      if (!current || m.playedOn > current) {
        lastMatchMap.set(pid, m.playedOn);
      }
    }
  }

  // Load active freezes
  const activeFreezeRows = await db
    .select({ playerId: freezes.playerId })
    .from(freezes)
    .where(
      and(
        lte(freezes.startsOn, todayStr),
        or(sql`${freezes.endsOn} IS NULL`, gte(freezes.endsOn, todayStr)),
      ),
    );

  const frozenPlayerIds = new Set(activeFreezeRows.map((r) => r.playerId));

  // Load recent inactivity events per player to enforce idempotency
  type InactivityReason =
    | "inactivity_month"
    | "inactivity_3mo"
    | "inactivity_6mo"
    | "inactivity_1y";

  const inactivityReasons: InactivityReason[] = [
    "inactivity_month",
    "inactivity_3mo",
    "inactivity_6mo",
    "inactivity_1y",
  ];

  const recentInactivityRows = await db
    .select({
      playerId: rankingEvents.playerId,
      reason: rankingEvents.reason,
      occurredAt: rankingEvents.occurredAt,
    })
    .from(rankingEvents)
    .where(
      and(
        sql`${rankingEvents.reason} = ANY(ARRAY['inactivity_month','inactivity_3mo','inactivity_6mo','inactivity_1y'])`,
        gte(
          rankingEvents.occurredAt,
          new Date(new Date().setFullYear(new Date().getFullYear() - 2)),
        ),
      ),
    );

  // Map: playerId → Map<reason, last occurredAt date string>
  const lastPenaltyMap = new Map<string, Map<string, string>>();
  for (const row of recentInactivityRows) {
    if (!inactivityReasons.includes(row.reason as InactivityReason)) continue;
    if (!lastPenaltyMap.has(row.playerId)) {
      lastPenaltyMap.set(row.playerId, new Map());
    }
    const dateStr = row.occurredAt.toISOString().slice(0, 10);
    const existing = lastPenaltyMap.get(row.playerId)?.get(row.reason);
    if (!existing || dateStr > existing) {
      lastPenaltyMap.get(row.playerId)?.set(row.reason, dateStr);
    }
  }

  const eventsToInsert: Array<{
    playerId: string;
    delta: number;
    reason: InactivityReason;
    note: string;
  }> = [];

  for (const player of activePlayers) {
    const currentPoints = Number(player.points);

    // Skip frozen players
    if (frozenPlayerIds.has(player.id)) {
      skipped.push({
        playerId: player.id,
        name: player.fullName,
        reason: "congelado",
      });
      continue;
    }

    const lastMatchDate = lastMatchMap.get(player.id) ?? null;
    const daysSince = lastMatchDate
      ? Math.floor(
          (new Date(todayStr).getTime() -
            new Date(`${lastMatchDate}T00:00:00`).getTime()) /
            86400000,
        )
      : 9999;

    const penaltyMap =
      lastPenaltyMap.get(player.id) ?? new Map<string, string>();

    // -40 monthly (repeat monthly, idempotent: last penalty must be >30 days ago or not exist after last match)
    if (daysSince >= 30) {
      const lastMonthly = penaltyMap.get("inactivity_month") ?? null;
      // Apply if: never applied, or last applied before last match (player played since), or >35 days since last monthly penalty
      const alreadyAppliedThisCycle =
        lastMonthly !== null &&
        (lastMatchDate === null || lastMonthly > lastMatchDate) &&
        Math.floor(
          (new Date(todayStr).getTime() -
            new Date(`${lastMonthly}T00:00:00`).getTime()) /
            86400000,
        ) < 35;

      if (!alreadyAppliedThisCycle) {
        eventsToInsert.push({
          playerId: player.id,
          delta: -40,
          reason: "inactivity_month",
          note: `Sin partido en ${daysSince} días`,
        });
      }
    }

    // -25% at 3 months (once per inactivity stretch)
    if (daysSince >= 90 && currentPoints > 0) {
      const lastApplied = penaltyMap.get("inactivity_3mo") ?? null;
      const alreadyApplied =
        lastApplied !== null &&
        (lastMatchDate === null || lastApplied > lastMatchDate);
      if (!alreadyApplied) {
        const delta = -Math.round(currentPoints * 0.25);
        eventsToInsert.push({
          playerId: player.id,
          delta,
          reason: "inactivity_3mo",
          note: `Sin partido en ${daysSince} días — -25%`,
        });
      }
    }

    // -50% at 6 months (once per inactivity stretch)
    if (daysSince >= 180 && currentPoints > 0) {
      const lastApplied = penaltyMap.get("inactivity_6mo") ?? null;
      const alreadyApplied =
        lastApplied !== null &&
        (lastMatchDate === null || lastApplied > lastMatchDate);
      if (!alreadyApplied) {
        const delta = -Math.round(currentPoints * 0.5);
        eventsToInsert.push({
          playerId: player.id,
          delta,
          reason: "inactivity_6mo",
          note: `Sin partido en ${daysSince} días — -50%`,
        });
      }
    }

    // -100% at 1 year (once per inactivity stretch)
    if (daysSince >= 365 && currentPoints > 0) {
      const lastApplied = penaltyMap.get("inactivity_1y") ?? null;
      const alreadyApplied =
        lastApplied !== null &&
        (lastMatchDate === null || lastApplied > lastMatchDate);
      if (!alreadyApplied) {
        eventsToInsert.push({
          playerId: player.id,
          delta: -currentPoints,
          reason: "inactivity_1y",
          note: `Sin partido en ${daysSince} días — -100%`,
        });
      }
    }
  }

  // Insert in a transaction
  if (eventsToInsert.length > 0) {
    await db.transaction(async (tx) => {
      for (const ev of eventsToInsert) {
        await tx.insert(rankingEvents).values({
          playerId: ev.playerId,
          delta: ev.delta,
          reason: ev.reason,
          note: ev.note,
        });
        applied.push({
          playerId: ev.playerId,
          name: activePlayers.find((p) => p.id === ev.playerId)?.fullName ?? "",
          reason: ev.reason,
          delta: ev.delta,
        });
      }
      await tx.insert(auditLog).values({
        action: "cron.inactividad",
        entityType: "cron",
        payload: {
          applied: applied.length,
          skipped: skipped.length,
          date: todayStr,
        },
      });
    });
  }

  return Response.json({
    ok: true,
    date: todayStr,
    applied,
    skipped,
    totalPlayers: activePlayers.length,
  });
}
