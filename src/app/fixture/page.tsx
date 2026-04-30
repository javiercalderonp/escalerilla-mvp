import { and, asc, desc, eq, gt, inArray, lt, sql } from "drizzle-orm";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { WeekStepper } from "@/components/ui/week-stepper";
import { auth } from "@/lib/auth";
import { requireCompleteProfile } from "@/lib/auth/require-complete-profile";
import { db } from "@/lib/db";
import { matches, players, weeks } from "@/lib/db/schema";

type FixturePageProps = {
  searchParams?: Promise<{
    week?: string;
  }>;
};

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
    pendiente: "bg-muted text-muted-foreground",
    reportado: "bg-clay/15 text-clay",
    confirmado: "bg-grass/15 text-grass",
    wo: "bg-destructive/10 text-destructive",
    empate: "bg-court/10 text-court",
  };
  const style = styles[status] ?? "bg-muted text-muted-foreground";
  const label =
    status === "confirmado" && winnerName ? `Ganó ${winnerName}` : status;

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${style}`}>
      {label}
    </span>
  );
}

export default async function FixturePage({ searchParams }: FixturePageProps) {
  const session = await auth();
  const query = searchParams ? await searchParams : undefined;
  const requestedWeekId = query?.week;

  if (session?.user?.role !== "admin" && session?.user) {
    await requireCompleteProfile();
  }

  if (!db) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <div className="w-full rounded-3xl bg-card p-8 shadow-sm ring-1 ring-black/5">
          <p className="text-sm text-muted-foreground">
            Base de datos no configurada.
          </p>
        </div>
      </div>
    );
  }

  const allowedStatuses =
    session?.user?.role === "admin"
      ? (["borrador", "abierta", "cerrada"] as const)
      : (["cerrada"] as const);

  const currentWeekRows = requestedWeekId
    ? await db
        .selectDistinct({
          id: weeks.id,
          seasonId: weeks.seasonId,
          startsOn: weeks.startsOn,
          endsOn: weeks.endsOn,
          status: weeks.status,
        })
        .from(weeks)
        .innerJoin(matches, eq(matches.weekId, weeks.id))
        .where(
          and(
            eq(weeks.id, requestedWeekId),
            inArray(weeks.status, allowedStatuses),
          ),
        )
        .limit(1)
    : await db
        .selectDistinct({
          id: weeks.id,
          seasonId: weeks.seasonId,
          startsOn: weeks.startsOn,
          endsOn: weeks.endsOn,
          status: weeks.status,
        })
        .from(weeks)
        .innerJoin(matches, eq(matches.weekId, weeks.id))
        .where(inArray(weeks.status, allowedStatuses))
        .orderBy(desc(weeks.startsOn))
        .limit(1);

  const currentWeek = currentWeekRows[0] ?? null;

  if (!currentWeek) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <div className="w-full space-y-6">
          <div className="rounded-3xl bg-card p-8 shadow-sm ring-1 ring-black/5">
            <p className="text-sm font-medium text-court">Partidos</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
              Partidos
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              No hay partidos publicados todavía.
            </p>
          </div>
          <EmptyState
            title="Sin partidos"
            description="Esta semana no tiene partidos publicados."
          />
        </div>
      </div>
    );
  }

  const [prevWeekRows, nextWeekRows] = await Promise.all([
    db
      .select({ id: weeks.id })
      .from(weeks)
      .where(
        and(
          eq(weeks.seasonId, currentWeek.seasonId),
          lt(weeks.startsOn, currentWeek.startsOn),
          inArray(weeks.status, allowedStatuses),
        ),
      )
      .orderBy(desc(weeks.startsOn))
      .limit(1),
    db
      .select({ id: weeks.id })
      .from(weeks)
      .where(
        and(
          eq(weeks.seasonId, currentWeek.seasonId),
          gt(weeks.startsOn, currentWeek.startsOn),
          inArray(weeks.status, allowedStatuses),
        ),
      )
      .orderBy(asc(weeks.startsOn))
      .limit(1),
  ]);

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

  const matchesM = weekMatches.filter((match) => match.category === "M");
  const matchesF = weekMatches.filter((match) => match.category === "F");
  const weekLabel = `${formatDate(currentWeek.startsOn)}–${formatDate(currentWeek.endsOn)}`;
  const isClosedWeek = currentWeek.status === "cerrada";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <section className="rounded-3xl bg-card p-8 shadow-sm ring-1 ring-black/5">
        <p className="text-sm font-medium text-court">Partidos</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
          Semana {weekLabel}
        </h1>
        <div className="mt-4">
          <WeekStepper
            label={weekLabel}
            previousHref={
              prevWeekRows[0] ? `/fixture?week=${prevWeekRows[0].id}` : null
            }
            nextHref={
              nextWeekRows[0] ? `/fixture?week=${nextWeekRows[0].id}` : null
            }
          />
        </div>
        {isClosedWeek ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Estás viendo una semana cerrada en modo solo lectura.
          </p>
        ) : myPlayerId ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Tus partidos están resaltados.
          </p>
        ) : !session?.user ? (
          <p className="mt-3 text-sm text-muted-foreground">
            <Link href="/login" className="text-court hover:underline">
              Ingresá
            </Link>{" "}
            para ver tus partidos resaltados.
          </p>
        ) : null}
      </section>

      {(
        [
          { cat: "M", label: "Hombres", rows: matchesM },
          { cat: "F", label: "Mujeres", rows: matchesF },
        ] as const
      ).map(({ cat, label, rows }) => (
        <section
          key={cat}
          className="rounded-3xl border border-border bg-card p-6 shadow-sm"
        >
          <h2 className="text-lg font-semibold text-foreground">{label}</h2>
          {rows.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="Sin partidos"
                description="Esta semana no tiene partidos publicados."
              />
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
                      isMyMatch ? "border-court bg-court/5" : "border-border"
                    }`}
                  >
                    <p className="font-medium text-foreground">
                      {match.player1Name}{" "}
                      <span className="font-normal text-muted-foreground">
                        vs
                      </span>{" "}
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
