import { desc, eq, sql } from "drizzle-orm";
import Link from "next/link";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { matches, players, weeks } from "@/lib/db/schema";

function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

function MatchStatusBadge({
  status,
  winnerName,
}: {
  status: string;
  winnerName: string | null;
}) {
  const styles: Record<string, string> = {
    pendiente: "bg-slate-100 text-slate-600",
    reportado: "bg-amber-100 text-amber-700",
    confirmado: "bg-emerald-100 text-emerald-700",
    wo: "bg-rose-100 text-rose-700",
    empate: "bg-blue-100 text-blue-700",
  };
  const style = styles[status] ?? "bg-slate-100 text-slate-600";
  const label =
    status === "confirmado" && winnerName ? `Ganó ${winnerName}` : status;
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${style}`}>
      {label}
    </span>
  );
}

export default async function FixturePage() {
  const session = await auth();

  if (!db) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <div className="w-full rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5">
          <p className="text-sm text-slate-600">Base de datos no configurada.</p>
        </div>
      </div>
    );
  }

  // Most recent week that has any matches
  const weeksWithMatches = await db
    .selectDistinct({
      id: weeks.id,
      startsOn: weeks.startsOn,
      endsOn: weeks.endsOn,
      status: weeks.status,
    })
    .from(weeks)
    .innerJoin(matches, eq(matches.weekId, weeks.id))
    .orderBy(desc(weeks.startsOn))
    .limit(1);

  const currentWeek = weeksWithMatches[0] ?? null;

  if (!currentWeek) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <div className="w-full rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5">
          <p className="text-sm font-medium text-emerald-700">Fixture</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            Semana actual
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            No hay fixture publicado todavía.
          </p>
        </div>
      </div>
    );
  }

  // Player linked to session user (to highlight my matches)
  let myPlayerId: string | null = null;
  if (session?.user?.email) {
    const [myPlayer] = await db
      .select({ id: players.id })
      .from(players)
      .where(eq(players.email, session.user.email.toLowerCase()))
      .limit(1);
    myPlayerId = myPlayer?.id ?? null;
  }

  const weekMatches = await db
    .select({
      id: matches.id,
      category: matches.category,
      player1Id: matches.player1Id,
      player2Id: matches.player2Id,
      player1Name: players.fullName,
      player2Name: sql<string>`players_p2.full_name`,
      status: matches.status,
      winnerId: matches.winnerId,
      winnerName: sql<string | null>`players_winner.full_name`,
    })
    .from(matches)
    .innerJoin(players, eq(matches.player1Id, players.id))
    .innerJoin(
      sql`players as players_p2`,
      sql`${matches.player2Id} = players_p2.id`,
    )
    .leftJoin(
      sql`players as players_winner`,
      sql`${matches.winnerId} = players_winner.id`,
    )
    .where(eq(matches.weekId, currentWeek.id))
    .orderBy(matches.category, players.fullName);

  const matchesM = weekMatches.filter((m) => m.category === "M");
  const matchesF = weekMatches.filter((m) => m.category === "F");
  const weekLabel = `${formatDate(currentWeek.startsOn)}–${formatDate(currentWeek.endsOn)}`;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5">
        <p className="text-sm font-medium text-emerald-700">Fixture</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          Semana {weekLabel}
        </h1>
        {myPlayerId && (
          <p className="mt-2 text-sm text-slate-500">
            Tus partidos están resaltados en verde.
          </p>
        )}
        {!session?.user && (
          <p className="mt-2 text-sm text-slate-500">
            <Link href="/login" className="text-emerald-600 hover:underline">
              Ingresá
            </Link>{" "}
            para ver tus partidos resaltados.
          </p>
        )}
      </section>

      {(
        [
          { cat: "M", label: "Hombres", rows: matchesM },
          { cat: "F", label: "Mujeres", rows: matchesF },
        ] as const
      ).map(({ cat, label, rows }) => (
        <section
          key={cat}
          className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h2 className="text-lg font-semibold text-slate-950">{label}</h2>
          {rows.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 px-6 py-8 text-center text-sm text-slate-500">
              No hay partidos publicados para esta categoría.
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {rows.map((match) => {
                const isMyMatch =
                  myPlayerId !== null &&
                  (match.player1Id === myPlayerId ||
                    match.player2Id === myPlayerId);
                return (
                  <div
                    key={match.id}
                    className={`flex items-center justify-between gap-4 rounded-2xl border p-4 ${
                      isMyMatch
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-slate-200"
                    }`}
                  >
                    <p className="font-medium text-slate-950">
                      {match.player1Name}{" "}
                      <span className="font-normal text-slate-400">vs</span>{" "}
                      {match.player2Name}
                    </p>
                    <MatchStatusBadge
                      status={match.status}
                      winnerName={match.winnerName}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
