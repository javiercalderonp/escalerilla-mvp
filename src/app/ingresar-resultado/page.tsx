import { and, asc, desc, eq, ne, or, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { ensureAppUser } from "@/lib/auth/ensure-app-user";
import { db } from "@/lib/db";
import { matches, players } from "@/lib/db/schema";

import type { PendingMatch, PlayerOption } from "./ResultForm";
import { ResultForm } from "./ResultForm";

export default async function IngresarResultadoPage() {
  const session = await auth();

  if (!session?.user?.email) redirect("/login");

  if (!db) throw new Error("Base de datos no configurada");

  const actor = await ensureAppUser(session.user);

  if (!actor.playerId) redirect("/onboarding");

  const playerId = actor.playerId;

  const [myPlayer] = await db
    .select({ id: players.id, fullName: players.fullName, gender: players.gender })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);

  if (!myPlayer) redirect("/onboarding");

  const pendingMatches = (await db
    .select({
      id: matches.id,
      player1Id: matches.player1Id,
      player2Id: matches.player2Id,
      type: matches.type,
      player1Name: players.fullName,
      player2Name: sql<string>`players_p2.full_name`,
    })
    .from(matches)
    .innerJoin(players, eq(matches.player1Id, players.id))
    .innerJoin(
      sql`players as players_p2`,
      sql`${matches.player2Id} = players_p2.id`,
    )
    .where(
      and(
        eq(matches.status, "pendiente"),
        or(eq(matches.player1Id, playerId), eq(matches.player2Id, playerId)),
      ),
    )
    .orderBy(desc(matches.createdAt))) as PendingMatch[];

  const allPlayers = (await db
    .select({ id: players.id, fullName: players.fullName })
    .from(players)
    .where(
      and(
        eq(players.gender, myPlayer.gender),
        eq(players.status, "activo"),
        ne(players.id, playerId),
      ),
    )
    .orderBy(asc(players.fullName))) as PlayerOption[];

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold text-slate-900">
        Ingresar resultado
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        Registra el resultado de tu partido y los puntos se actualizan
        automáticamente.
      </p>

      <ResultForm
        pendingMatches={pendingMatches}
        allPlayers={allPlayers}
        myPlayerId={playerId}
        myName={myPlayer.fullName}
      />
    </main>
  );
}
