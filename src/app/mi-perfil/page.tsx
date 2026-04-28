import { and, desc, eq, gte, or, sql } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { matches, players, rankingEvents } from "@/lib/db/schema";

function formatDate(dateStr: string | null | Date) {
  if (!dateStr) return "—";
  const d = typeof dateStr === "string" ? new Date(dateStr + "T00:00:00") : dateStr;
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

function daysDiff(dateStr: string) {
  const then = new Date(dateStr + "T00:00:00").getTime();
  return Math.floor((Date.now() - then) / 86400000);
}

export default async function MiPerfilPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if (!db) {
    return (
      <div className="p-10 text-center text-sm text-slate-600">
        Base de datos no configurada.
      </div>
    );
  }

  // Find player linked to this email
  const email = session.user.email?.toLowerCase();
  const [myPlayer] = email
    ? await db
        .select({ id: players.id, fullName: players.fullName, gender: players.gender, status: players.status })
        .from(players)
        .where(eq(players.email, email))
        .limit(1)
    : [undefined];

  if (!myPlayer) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
        <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            Mi perfil
          </h1>
          <p className="mt-4 text-sm text-slate-600">
            Tu cuenta no está vinculada a ningún jugador. Pedile al administrador
            que asigne tu email al perfil de jugador correspondiente.
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Email: <span className="font-mono">{session.user.email}</span>
          </p>
        </section>
      </div>
    );
  }

  const category = myPlayer.gender;

  // Full ranking in my category (sorted by points desc) to compute my rank
  const categoryRanking = await db
    .select({
      id: players.id,
      fullName: players.fullName,
      points: sql<number>`coalesce(sum(${rankingEvents.delta}), 0)`,
    })
    .from(players)
    .leftJoin(rankingEvents, eq(rankingEvents.playerId, players.id))
    .where(and(eq(players.status, "activo"), eq(players.gender, category)))
    .groupBy(players.id, players.fullName)
    .orderBy(desc(sql<number>`coalesce(sum(${rankingEvents.delta}), 0)`));

  const rankedList = categoryRanking.map((p, i) => ({
    ...p,
    points: Number(p.points),
    rank: i + 1,
  }));

  const myEntry = rankedList.find((p) => p.id === myPlayer.id);
  const myRank = myEntry?.rank ?? null;
  const myPoints = myEntry?.points ?? 0;

  // Players I can challenge: ranked above me, up to 5 spots (rank myRank-5 to myRank-1)
  const challengeable = myRank
    ? rankedList.filter(
        (p) => p.rank >= Math.max(1, myRank - 5) && p.rank < myRank,
      )
    : [];

  // Players who can challenge me: ranked below me, up to 5 spots (rank myRank+1 to myRank+5)
  const challengedBy = myRank
    ? rankedList.filter(
        (p) => p.rank > myRank && p.rank <= myRank + 5,
      )
    : [];

  // Recent matches involving me (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoff30 = thirtyDaysAgo.toISOString().slice(0, 10);

  const recentMatchRows = await db
    .select({
      id: matches.id,
      status: matches.status,
      type: matches.type,
      playedOn: matches.playedOn,
      player1Id: matches.player1Id,
      player2Id: matches.player2Id,
      player1Name: players.fullName,
      player2Name: sql<string>`players_p2.full_name`,
      winnerId: matches.winnerId,
    })
    .from(matches)
    .innerJoin(players, eq(matches.player1Id, players.id))
    .innerJoin(
      sql`players as players_p2`,
      sql`${matches.player2Id} = players_p2.id`,
    )
    .where(
      and(
        or(eq(matches.player1Id, myPlayer.id), eq(matches.player2Id, myPlayer.id)),
        or(eq(matches.status, "confirmado"), eq(matches.status, "wo"), eq(matches.status, "empate")),
        gte(matches.playedOn, cutoff30),
      ),
    )
    .orderBy(desc(matches.playedOn))
    .limit(10);

  // Build set of opponents I played recently (for zone display)
  const recentOpponentIds = new Set(
    recentMatchRows.flatMap((m) =>
      m.player1Id === myPlayer.id ? [m.player2Id] : [m.player1Id],
    ),
  );

  // Last match date (for any completed match involving me)
  const [lastMatchRow] = await db
    .select({ playedOn: sql<string | null>`max(${matches.playedOn})` })
    .from(matches)
    .where(
      and(
        or(eq(matches.player1Id, myPlayer.id), eq(matches.player2Id, myPlayer.id)),
        or(eq(matches.status, "confirmado"), eq(matches.status, "wo"), eq(matches.status, "empate")),
      ),
    );

  const lastMatchDate = lastMatchRow?.playedOn ?? null;

  // Challenge matches this month
  const monthStart = new Date();
  monthStart.setDate(1);
  const monthCutoff = monthStart.toISOString().slice(0, 10);

  const [challengeCountRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(matches)
    .where(
      and(
        or(eq(matches.player1Id, myPlayer.id), eq(matches.player2Id, myPlayer.id)),
        eq(matches.type, "desafio"),
        gte(matches.playedOn, monthCutoff),
      ),
    );

  const challengeCount = Number(challengeCountRow?.count ?? 0);

  const categoryLabel = category === "M" ? "Hombres" : "Mujeres";

  function ZoneRow({
    player,
    canChallenge,
  }: {
    player: { id: string; fullName: string; points: number; rank: number };
    canChallenge: boolean;
  }) {
    const playedRecently = recentOpponentIds.has(player.id);
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="w-6 text-right text-xs text-slate-400">
            #{player.rank}
          </span>
          <span className="text-sm font-medium text-slate-800">
            {player.fullName}
          </span>
          <span className="text-xs text-slate-400">{player.points} pts</span>
        </div>
        {playedRecently ? (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
            RN-03 — 30 días
          </span>
        ) : (
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              canChallenge
                ? "bg-emerald-100 text-emerald-800"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {canChallenge ? "Puedo desafiar" : "Puede desafiarme"}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      {/* Header card */}
      <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5">
        <p className="text-sm font-medium text-emerald-700">Mi perfil</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          {myPlayer.fullName}
        </h1>
        <div className="mt-4 flex flex-wrap gap-4">
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-xs text-slate-500">Categoría</p>
            <p className="mt-0.5 text-lg font-semibold text-slate-950">
              {categoryLabel}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-xs text-slate-500">Posición</p>
            <p className="mt-0.5 text-lg font-semibold text-slate-950">
              {myRank ? `#${myRank}` : "—"}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-xs text-slate-500">Puntos</p>
            <p className="mt-0.5 text-lg font-semibold text-slate-950">
              {myPoints}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-xs text-slate-500">Último partido</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-950">
              {lastMatchDate ? (
                <>
                  {formatDate(lastMatchDate)}
                  <span className="ml-1 text-xs font-normal text-slate-400">
                    (hace {daysDiff(lastMatchDate)} días)
                  </span>
                </>
              ) : (
                "Sin partidos"
              )}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-xs text-slate-500">Desafíos este mes</p>
            <p className="mt-0.5 text-lg font-semibold text-slate-950">
              {challengeCount}
            </p>
          </div>
        </div>
      </section>

      {/* Zona desafiable */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">
          Zona desafiable
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Podés desafiar a cualquiera de las 5 posiciones sobre la tuya (RN-06).
          Los marcados con RN-03 jugaron contigo en los últimos 30 días.
        </p>

        {myRank === null ? (
          <p className="mt-4 text-sm text-slate-500">
            No hay suficientes datos para calcular tu posición.
          </p>
        ) : (
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-700">
                Puedo desafiar a
              </h3>
              {challengeable.length === 0 ? (
                <p className="text-sm text-slate-400">
                  Estás en la cima — nadie por encima.
                </p>
              ) : (
                <div className="space-y-2">
                  {[...challengeable].reverse().map((p) => (
                    <ZoneRow key={p.id} player={p} canChallenge={true} />
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-700">
                Me puede desafiar
              </h3>
              {challengedBy.length === 0 ? (
                <p className="text-sm text-slate-400">
                  Nadie en tu zona inferior.
                </p>
              ) : (
                <div className="space-y-2">
                  {challengedBy.map((p) => (
                    <ZoneRow key={p.id} player={p} canChallenge={false} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Partidos recientes */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">
          Mis partidos (últimos 30 días)
        </h2>

        {recentMatchRows.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 px-6 py-8 text-center text-sm text-slate-500">
            Sin partidos confirmados en los últimos 30 días.
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {recentMatchRows.map((m) => {
              const iWon = m.winnerId === myPlayer.id;
              const opponent =
                m.player1Id === myPlayer.id ? m.player2Name : m.player1Name;
              const resultLabel =
                m.status === "empate"
                  ? "Empate"
                  : m.status === "wo"
                    ? iWon
                      ? "Gané (W.O.)"
                      : "Perdí (W.O.)"
                    : iWon
                      ? "Gané"
                      : "Perdí";
              const resultColor =
                m.status === "empate"
                  ? "bg-blue-100 text-blue-700"
                  : iWon
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-rose-100 text-rose-700";
              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      vs {opponent}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatDate(m.playedOn)} ·{" "}
                      {m.type === "desafio" ? "desafío" : "sorteo"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${resultColor}`}
                  >
                    {resultLabel}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4">
          <Link
            href="/fixture"
            className="text-sm text-emerald-600 transition hover:underline"
          >
            Ver fixture actual →
          </Link>
        </div>
      </section>
    </div>
  );
}
