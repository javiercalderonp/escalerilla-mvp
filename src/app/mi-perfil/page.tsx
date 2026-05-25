import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import {
  Activity,
  BarChart3,
  CalendarDays,
  ChevronRight,
  Clock,
  Hand,
  Shield,
  TrendingUp,
  Trophy,
  User,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { requireCompleteProfile } from "@/lib/auth/require-complete-profile";
import {
  buildAvailabilitySlots,
  getSharedAvailabilityRanges,
  hasAnyAvailability,
} from "@/lib/availability";
import { db } from "@/lib/db";
import {
  matches,
  matchSets,
  type PlayerVisibility,
  players,
  weeks,
} from "@/lib/db/schema";
import {
  getRanking,
  type RankingCategory,
  rankingCategoryLabels,
} from "@/lib/ranking";
import { whatsappUrl } from "@/lib/validation/phone";

type ResolvedStatus = "confirmado" | "wo" | "empate";

type MatchHistoryRow = {
  id: string;
  playedOn: string | null;
  status: ResolvedStatus;
  type: "sorteo" | "desafio" | "campeonato";
  format: "mr3" | "set_largo" | null;
  winnerId: string | null;
  player1Id: string;
  player2Id: string;
  player1Name: string;
  player2Name: string;
};

type UpcomingMatchRow = {
  id: string;
  status: "pendiente" | "reportado";
  type: "sorteo" | "desafio" | "campeonato";
  playedOn: string | null;
  player1Id: string;
  player2Id: string;
  player1Name: string;
  player2Name: string;
  player1Phone: string | null;
  player2Phone: string | null;
  weekStartsOn: string | null;
  weekEndsOn: string | null;
  player1AvailMonday: boolean | null;
  player1AvailTuesday: boolean | null;
  player1AvailWednesday: boolean | null;
  player1AvailThursday: boolean | null;
  player1AvailFriday: boolean | null;
  player1AvailSaturday: boolean | null;
  player1AvailSunday: boolean | null;
  player1Visibility: PlayerVisibility | null;
  player2AvailMonday: boolean | null;
  player2AvailTuesday: boolean | null;
  player2AvailWednesday: boolean | null;
  player2AvailThursday: boolean | null;
  player2AvailFriday: boolean | null;
  player2AvailSaturday: boolean | null;
  player2AvailSunday: boolean | null;
  player2Visibility: PlayerVisibility | null;
};

type MatchSetRow = {
  matchId: string;
  setNumber: number;
  gamesP1: number;
  gamesP2: number;
  tiebreakP1: number | null;
  tiebreakP2: number | null;
};

const levelLabels: Record<string, string> = {
  principiante: "Principiante",
  intermedio_bajo: "Intermedio bajo",
  intermedio_alto: "Intermedio alto",
  avanzado: "Avanzado",
};

const handLabels: Record<string, string> = {
  diestro: "Diestro",
  zurdo: "Zurdo",
};

const backhandLabels: Record<string, string> = {
  una_mano: "Revés a una mano",
  dos_manos: "Revés a dos manos",
};

const monthNames = [
  "ENE",
  "FEB",
  "MAR",
  "ABR",
  "MAY",
  "JUN",
  "JUL",
  "AGO",
  "SEP",
  "OCT",
  "NOV",
  "DIC",
];

function getTodayInSantiago() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDays(dateStr: string, days: number) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getWeekStart(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const jsDay = date.getUTCDay();
  const diff = jsDay === 0 ? -6 : 1 - jsDay;
  return addDays(dateStr, diff);
}

function getWeekEnd(weekStart: string) {
  return addDays(weekStart, 6);
}

function formatDateParts(value: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return {
    day: day.toString().padStart(2, "0"),
    month: monthNames[month - 1],
    year: year.toString(),
  };
}

function formatCompactDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatUpcomingDate(match: UpcomingMatchRow) {
  if (match.playedOn) return formatCompactDate(match.playedOn);
  return "Fecha por definir";
}

function getAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const today = new Date();
  const [year, month, day] = birthDate.split("-").map(Number);
  let age = today.getFullYear() - year;
  if (
    today.getMonth() + 1 < month ||
    (today.getMonth() + 1 === month && today.getDate() < day)
  ) {
    age--;
  }
  return age;
}

function getInitials(fullName: string) {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function getCounterTone(current: number, target: number) {
  const ratio = target <= 0 ? 0 : current / target;
  if (ratio >= 1) return "text-rose-700 bg-rose-50 border-rose-200";
  if (ratio >= 0.7) return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-emerald-700 bg-emerald-50 border-emerald-200";
}

function formatScore(
  match: MatchHistoryRow,
  playerId: string,
  sets: MatchSetRow[],
) {
  if (match.status === "wo") return "W.O.";

  const orderedSets = [...sets].sort((a, b) => a.setNumber - b.setNumber);
  if (orderedSets.length === 0) {
    return match.status === "empate" ? "Empate" : "Resultado confirmado";
  }

  return orderedSets
    .map((set) => {
      const isPlayer1 = match.player1Id === playerId;
      const playerGames = isPlayer1 ? set.gamesP1 : set.gamesP2;
      const opponentGames = isPlayer1 ? set.gamesP2 : set.gamesP1;
      const base = `${playerGames}-${opponentGames}`;
      if (set.tiebreakP1 != null && set.tiebreakP2 != null) {
        const playerTiebreak = isPlayer1 ? set.tiebreakP1 : set.tiebreakP2;
        const opponentTiebreak = isPlayer1 ? set.tiebreakP2 : set.tiebreakP1;
        return `${base} (${playerTiebreak}-${opponentTiebreak})`;
      }
      return base;
    })
    .join(" · ");
}

function getOutcome(match: MatchHistoryRow, playerId: string) {
  if (match.status === "empate") {
    return {
      label: "Empate",
      classes: "text-blue-700 bg-blue-50 border-blue-200",
    };
  }
  if (match.winnerId === playerId) {
    return {
      label: match.status === "wo" ? "W.O. Ganado" : "Ganado",
      classes: "text-emerald-700 bg-emerald-50 border-emerald-200",
    };
  }
  return {
    label: match.status === "wo" ? "W.O. Perdido" : "Perdido",
    classes: "text-rose-700 bg-rose-50 border-rose-200",
  };
}

export default async function MiPerfilPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await requireCompleteProfile();

  if (!db) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-[#ded6ca] bg-[#fffdfa] p-8 text-sm text-[#776f66]">
          Base de datos no configurada.
        </div>
      </main>
    );
  }

  const userEmail = session.user.email?.toLowerCase();
  if (!userEmail) redirect("/login");

  const [player] = await db
    .select({
      id: players.id,
      fullName: players.fullName,
      gender: players.gender,
      status: players.status,
      level: players.level,
      dominantHand: players.dominantHand,
      backhand: players.backhand,
      birthDate: players.birthDate,
      phone: players.phone,
    })
    .from(players)
    .where(eq(players.email, userEmail))
    .limit(1);

  if (!player) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
        <section className="rounded-2xl border border-[#ded6ca] bg-[#fffdfa] p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-[#0d1b2a]">Mi perfil</h1>
          <p className="mt-3 text-sm text-[#776f66]">
            Tu cuenta ({session.user.email}) no está vinculada a ningún jugador.
            Pídele al administrador que te agregue con este email.
          </p>
        </section>
      </main>
    );
  }

  const category: RankingCategory =
    player.gender === "M" ? "hombres" : "mujeres";
  const today = getTodayInSantiago();
  const weekStart = getWeekStart(today);
  const weekEnd = getWeekEnd(weekStart);
  const rollingMonthStart = addDays(today, -29);

  const [
    ranking,
    [weekCountRow],
    [monthCountRow],
    [challengeMonthRow],
    upcomingMatches,
    historyRows,
  ] = await Promise.all([
    getRanking(category),
    db
      .select({ value: sql<number>`count(*)` })
      .from(matches)
      .where(
        and(
          or(
            eq(matches.player1Id, player.id),
            eq(matches.player2Id, player.id),
          ),
          sql`${matches.status} in ('confirmado', 'empate', 'wo')`,
          sql`${matches.playedOn} is not null`,
          sql`${matches.playedOn} between ${weekStart} and ${weekEnd}`,
          sql`${matches.type} <> 'campeonato'`,
        ),
      ),
    db
      .select({ value: sql<number>`count(*)` })
      .from(matches)
      .where(
        and(
          or(
            eq(matches.player1Id, player.id),
            eq(matches.player2Id, player.id),
          ),
          sql`${matches.status} in ('confirmado', 'empate', 'wo')`,
          sql`${matches.playedOn} is not null`,
          sql`${matches.playedOn} between ${rollingMonthStart} and ${today}`,
          sql`${matches.type} <> 'campeonato'`,
        ),
      ),
    db
      .select({ value: sql<number>`count(*)` })
      .from(matches)
      .where(
        and(
          or(
            eq(matches.player1Id, player.id),
            eq(matches.player2Id, player.id),
          ),
          eq(matches.type, "desafio"),
          sql`${matches.status} in ('confirmado', 'empate', 'wo')`,
          sql`${matches.playedOn} is not null`,
          sql`${matches.playedOn} between ${rollingMonthStart} and ${today}`,
        ),
      ),
    db
      .select({
        id: matches.id,
        status: matches.status,
        type: matches.type,
        playedOn: matches.playedOn,
        player1Id: matches.player1Id,
        player2Id: matches.player2Id,
        player1Name: players.fullName,
        player2Name: sql<string>`players_p2.full_name`,
        player1Phone: players.phone,
        player2Phone: sql<string | null>`players_p2.phone`,
        weekStartsOn: weeks.startsOn,
        weekEndsOn: weeks.endsOn,
        player1AvailMonday: players.availMonday,
        player1AvailTuesday: players.availTuesday,
        player1AvailWednesday: players.availWednesday,
        player1AvailThursday: players.availThursday,
        player1AvailFriday: players.availFriday,
        player1AvailSaturday: players.availSaturday,
        player1AvailSunday: players.availSunday,
        player1Visibility: players.visibility,
        player2AvailMonday: sql<boolean | null>`players_p2.avail_monday`,
        player2AvailTuesday: sql<boolean | null>`players_p2.avail_tuesday`,
        player2AvailWednesday: sql<boolean | null>`players_p2.avail_wednesday`,
        player2AvailThursday: sql<boolean | null>`players_p2.avail_thursday`,
        player2AvailFriday: sql<boolean | null>`players_p2.avail_friday`,
        player2AvailSaturday: sql<boolean | null>`players_p2.avail_saturday`,
        player2AvailSunday: sql<boolean | null>`players_p2.avail_sunday`,
        player2Visibility: sql<PlayerVisibility | null>`players_p2.visibility`,
      })
      .from(matches)
      .leftJoin(weeks, eq(matches.weekId, weeks.id))
      .innerJoin(players, eq(matches.player1Id, players.id))
      .innerJoin(
        sql`players as players_p2`,
        sql`${matches.player2Id} = players_p2.id`,
      )
      .where(
        and(
          or(
            eq(matches.player1Id, player.id),
            eq(matches.player2Id, player.id),
          ),
          sql`${matches.status} in ('pendiente', 'reportado')`,
          or(sql`${weeks.endsOn} is null`, sql`${weeks.endsOn} >= ${today}`),
        ),
      )
      .orderBy(
        asc(sql`coalesce(${matches.playedOn}, ${weeks.startsOn})`),
        asc(matches.createdAt),
      )
      .limit(6) as Promise<UpcomingMatchRow[]>,
    db
      .select({
        id: matches.id,
        playedOn: matches.playedOn,
        status: matches.status,
        type: matches.type,
        format: matches.format,
        winnerId: matches.winnerId,
        player1Id: matches.player1Id,
        player2Id: matches.player2Id,
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
          or(
            eq(matches.player1Id, player.id),
            eq(matches.player2Id, player.id),
          ),
          sql`${matches.status} in ('confirmado', 'empate', 'wo')`,
        ),
      )
      .orderBy(
        desc(matches.playedOn),
        desc(matches.confirmedAt),
        desc(matches.createdAt),
      )
      .limit(10) as Promise<MatchHistoryRow[]>,
  ]);

  const rankingEntry = ranking.find((e) => e.id === player.id) ?? null;

  const matchIds = historyRows.map((r) => r.id);
  const allSets = matchIds.length
    ? ((await db
        .select({
          matchId: matchSets.matchId,
          setNumber: matchSets.setNumber,
          gamesP1: matchSets.gamesP1,
          gamesP2: matchSets.gamesP2,
          tiebreakP1: matchSets.tiebreakP1,
          tiebreakP2: matchSets.tiebreakP2,
        })
        .from(matchSets)
        .where(
          sql`${matchSets.matchId} in (${sql.join(
            matchIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        )) as MatchSetRow[])
    : [];

  const setsByMatch = new Map<string, MatchSetRow[]>();
  for (const set of allSets) {
    const existing = setsByMatch.get(set.matchId) ?? [];
    existing.push(set);
    setsByMatch.set(set.matchId, existing);
  }

  const initials = getInitials(player.fullName);
  const age = getAge(player.birthDate ?? null);
  const weekCount = weekCountRow?.value ?? 0;
  const monthCount = monthCountRow?.value ?? 0;
  const challengeCount = challengeMonthRow?.value ?? 0;

  const recentResults = historyRows.map((match) => ({
    key: match.id,
    result:
      match.status === "empate" || !match.winnerId
        ? ("D" as const)
        : match.winnerId === player.id
          ? ("W" as const)
          : ("L" as const),
  }));
  const recentForm = recentResults.map(({ result }) => result);
  const last4 = recentForm.slice(0, 4);
  const winRateValue =
    last4.length > 0
      ? Math.round((last4.filter((r) => r === "W").length / last4.length) * 100)
      : null;

  const typeLabel = (type: string) =>
    type === "desafio"
      ? "Desafío"
      : type === "campeonato"
        ? "Partido"
        : "Sorteo";

  const nextMatch = upcomingMatches[0] ?? null;
  const nextMatchIsPlayer1 = nextMatch
    ? nextMatch.player1Id === player.id
    : false;
  const nextMatchOpponent = nextMatch
    ? nextMatchIsPlayer1
      ? nextMatch.player2Name
      : nextMatch.player1Name
    : null;
  const nextMatchMyAvailability = nextMatch
    ? buildAvailabilitySlots({
        availMonday: nextMatchIsPlayer1
          ? nextMatch.player1AvailMonday
          : nextMatch.player2AvailMonday,
        availTuesday: nextMatchIsPlayer1
          ? nextMatch.player1AvailTuesday
          : nextMatch.player2AvailTuesday,
        availWednesday: nextMatchIsPlayer1
          ? nextMatch.player1AvailWednesday
          : nextMatch.player2AvailWednesday,
        availThursday: nextMatchIsPlayer1
          ? nextMatch.player1AvailThursday
          : nextMatch.player2AvailThursday,
        availFriday: nextMatchIsPlayer1
          ? nextMatch.player1AvailFriday
          : nextMatch.player2AvailFriday,
        availSaturday: nextMatchIsPlayer1
          ? nextMatch.player1AvailSaturday
          : nextMatch.player2AvailSaturday,
        availSunday: nextMatchIsPlayer1
          ? nextMatch.player1AvailSunday
          : nextMatch.player2AvailSunday,
        visibility: nextMatchIsPlayer1
          ? nextMatch.player1Visibility
          : nextMatch.player2Visibility,
      })
    : null;
  const nextMatchOpponentAvailability = nextMatch
    ? buildAvailabilitySlots({
        availMonday: nextMatchIsPlayer1
          ? nextMatch.player2AvailMonday
          : nextMatch.player1AvailMonday,
        availTuesday: nextMatchIsPlayer1
          ? nextMatch.player2AvailTuesday
          : nextMatch.player1AvailTuesday,
        availWednesday: nextMatchIsPlayer1
          ? nextMatch.player2AvailWednesday
          : nextMatch.player1AvailWednesday,
        availThursday: nextMatchIsPlayer1
          ? nextMatch.player2AvailThursday
          : nextMatch.player1AvailThursday,
        availFriday: nextMatchIsPlayer1
          ? nextMatch.player2AvailFriday
          : nextMatch.player1AvailFriday,
        availSaturday: nextMatchIsPlayer1
          ? nextMatch.player2AvailSaturday
          : nextMatch.player1AvailSaturday,
        availSunday: nextMatchIsPlayer1
          ? nextMatch.player2AvailSunday
          : nextMatch.player1AvailSunday,
        visibility: nextMatchIsPlayer1
          ? nextMatch.player2Visibility
          : nextMatch.player1Visibility,
      })
    : null;
  const nextMatchSuggestedBlocks =
    nextMatch?.status === "pendiente" &&
    nextMatchMyAvailability &&
    nextMatchOpponentAvailability
      ? getSharedAvailabilityRanges(
          nextMatchMyAvailability,
          nextMatchOpponentAvailability,
        )
      : [];

  return (
    <>
      <div className="relative flex w-full flex-1 flex-col bg-[#f6f2ea] px-4 pb-8 pt-4 md:hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[#0d1b2a]" />

        <section className="relative rounded-2xl border border-[#ded6ca] bg-[#fffdfa] p-4 shadow-lg shadow-[#0d1b2a]/10">
          <div className="flex items-start gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-[#071b2d] text-2xl font-bold tracking-wide text-white shadow-inner">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h1 className="text-3xl font-bold tracking-tight text-[#0d1b2a]">
                    {player.fullName}
                  </h1>
                  <p className="mt-1 text-sm text-[#776f66]">
                    Categoría {rankingCategoryLabels[category]} · Estado{" "}
                    {player.status}
                    <span className="ml-1 inline-flex h-2 w-2 rounded-full bg-emerald-500 align-middle" />
                  </p>
                  <p className="mt-2 text-xl font-semibold text-[#0d1b2a]">
                    {rankingEntry ? `#${rankingEntry.position}` : "#—"}
                    <span className="mx-2 text-[#776f66]">·</span>
                    <span className="text-[#b04d15]">
                      {rankingEntry?.points ?? "—"} pts
                    </span>
                  </p>
                </div>
                <Link
                  href={`/ranking/${category}?player=${player.id}`}
                  aria-label="Ver perfil en ranking"
                  className="mt-10 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#0d1b2a]"
                >
                  <ChevronRight className="h-7 w-7" />
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-5 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            <MobileProfileFact
              icon={<Activity className="h-5 w-5" />}
              label="Nivel"
              value={player.level ? levelLabels[player.level] : "—"}
            />
            <MobileProfileFact
              icon={<Hand className="h-5 w-5" />}
              label="Mano"
              value={
                player.dominantHand ? handLabels[player.dominantHand] : "—"
              }
            />
            <MobileProfileFact
              icon={<Trophy className="h-5 w-5" />}
              label="Revés"
              value={
                player.backhand
                  ? player.backhand === "una_mano"
                    ? "A una mano"
                    : "A dos manos"
                  : "—"
              }
            />
            <MobileProfileFact
              icon={<CalendarDays className="h-5 w-5" />}
              label="Edad"
              value={age !== null ? `${age} años` : "—"}
            />
          </div>
        </section>

        {nextMatch && (
          <section className="mt-4 rounded-2xl border border-[#ded6ca] bg-[#fffdfa] p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white">
                  <CalendarDays className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold uppercase tracking-wide text-emerald-800">
                    Próximo partido
                  </p>
                  <p className="mt-4 text-sm text-[#776f66]">
                    {typeLabel(nextMatch.type)}
                  </p>
                  <h2 className="mt-1 text-3xl font-bold leading-none text-[#0d1b2a]">
                    vs {nextMatchOpponent}
                  </h2>
                  <p className="mt-2 text-lg text-[#b04d15]">
                    {nextMatch.status === "reportado"
                      ? "Resultado pendiente"
                      : "Pendiente de jugar"}
                  </p>
                </div>
              </div>
              <Link
                href="/ingresar-resultado"
                className="mt-2 shrink-0 rounded-full border border-[#b04d15] px-4 py-2 text-sm font-semibold text-[#b04d15]"
              >
                Resultado
              </Link>
            </div>

            <div className="mt-5 rounded-xl border border-[#ded6ca] bg-[#f6f2ea] px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#776f66]">
                Horarios recomendados
              </p>
              {nextMatchSuggestedBlocks.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {nextMatchSuggestedBlocks.slice(0, 4).map((block) => (
                    <span
                      key={`${nextMatch.id}-${block.dayKey}-${block.start}-${block.end}`}
                      className="rounded-full bg-[#0d1b2a] px-4 py-2 text-sm font-medium text-white"
                    >
                      {block.label}
                    </span>
                  ))}
                  {nextMatchSuggestedBlocks.length > 4 && (
                    <span className="rounded-full border border-[#ded6ca] bg-[#fffdfa] px-4 py-2 text-sm font-medium text-[#776f66]">
                      +{nextMatchSuggestedBlocks.length - 4} más
                    </span>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-sm text-[#776f66]">
                  Sin bloques compartidos sugeridos.
                </p>
              )}
            </div>
          </section>
        )}

        <section className="mt-4 rounded-2xl border border-[#ded6ca] bg-[#fffdfa] p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[#0d1b2a]" />
            <h2 className="text-sm font-bold uppercase tracking-wide text-[#0d1b2a]">
              Resumen de rendimiento
            </h2>
          </div>
          <div className="mt-5 grid grid-cols-4 divide-x divide-[#ded6ca]">
            <MobilePerformanceMetric
              label="Partidos esta semana"
              value={weekCount}
              target={3}
              caption="límite semanal"
            />
            <MobilePerformanceMetric
              label="Partidos últimos 30 días"
              value={monthCount}
              target={4}
              caption="límite mensual"
            />
            <MobilePerformanceMetric
              label="Desafíos últimos 30 días"
              value={challengeCount}
              target={2}
              caption="mínimo sugerido"
            />
            <div className="min-w-0 px-2 text-center">
              <p className="mx-auto min-h-10 max-w-24 text-sm leading-tight text-[#776f66]">
                Win rate (últimos 4)
              </p>
              <p className="mt-3 text-3xl font-bold tabular-nums text-[#0d1b2a]">
                {winRateValue !== null ? `${winRateValue}%` : "—"}
              </p>
              {recentResults.length > 0 ? (
                <div className="mt-4 flex justify-center gap-1">
                  {recentResults.slice(0, 4).map(({ key, result: r }) => (
                    <MobileResultDot key={key} result={r} />
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-xs text-[#776f66]">Sin partidos</p>
              )}
            </div>
          </div>
          <div className="mt-5 border-t border-[#ded6ca] pt-4 text-center text-sm font-semibold uppercase tracking-wide text-[#776f66]">
            Récord:{" "}
            <span className="text-[#0d1b2a]">
              {rankingEntry
                ? `${rankingEntry.matchesWon} - ${rankingEntry.matchesLost}`
                : "—"}
            </span>{" "}
            (V-D) <span className="mx-1">·</span> Mejor ranking:{" "}
            <span className="text-[#b04d15]">
              {rankingEntry?.bestRankingPosition
                ? `#${rankingEntry.bestRankingPosition}`
                : "—"}
            </span>{" "}
            <span className="mx-1">·</span> Puntos:{" "}
            <span className="text-[#b04d15]">
              {rankingEntry?.points ?? "—"}
            </span>
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-[#ded6ca] bg-[#fffdfa] p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-[#0d1b2a]" />
            <h2 className="text-sm font-bold uppercase tracking-wide text-[#0d1b2a]">
              Acciones rápidas
            </h2>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <MobileQuickAction
              href={`/ranking/${category}`}
              icon={<BarChart3 className="h-5 w-5" />}
              label="Ver ranking"
            />
            <MobileQuickAction
              href="/disponibilidad"
              icon={<Clock className="h-5 w-5" />}
              label="Disponibilidad"
            />
            <MobileQuickAction
              href="/fixture"
              icon={<CalendarDays className="h-5 w-5" />}
              label="Ver fixture"
            />
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-[#ded6ca] bg-[#fffdfa] p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-[#0d1b2a]">
              Últimos resultados
            </h2>
            {historyRows.length > 0 && (
              <Link
                href={`/ranking/${category}?player=${player.id}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-[#b04d15]"
              >
                Ver todos
                <ChevronRight className="h-5 w-5" />
              </Link>
            )}
          </div>

          {historyRows.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-[#ded6ca] px-4 py-8 text-center text-sm text-[#776f66]">
              Todavía no registras partidos esta temporada.
            </div>
          ) : (
            <div className="mt-4 divide-y divide-[#ede5d8]">
              {historyRows.slice(0, 4).map((match) => {
                const isPlayer1 = match.player1Id === player.id;
                const opponentName = isPlayer1
                  ? match.player2Name
                  : match.player1Name;
                const outcome = getOutcome(match, player.id);
                const score = formatScore(
                  match,
                  player.id,
                  setsByMatch.get(match.id) ?? [],
                );
                const dateParts = formatDateParts(match.playedOn);

                return (
                  <Link
                    key={match.id}
                    href={`/mi-perfil/partidos/${match.id}`}
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    {dateParts ? (
                      <div className="flex w-14 shrink-0 flex-col items-center rounded-lg bg-[#f6f2ea] px-1 py-2 text-center">
                        <span className="text-xl font-bold leading-none text-[#0d1b2a]">
                          {dateParts.day}
                        </span>
                        <span className="mt-0.5 text-xs font-bold uppercase text-[#b04d15]">
                          {dateParts.month}
                        </span>
                        <span className="text-xs text-[#776f66]">
                          {dateParts.year}
                        </span>
                      </div>
                    ) : (
                      <div className="w-14 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-[#776f66]">
                        {typeLabel(match.type)}
                      </p>
                      <p className="truncate text-base font-bold text-[#0d1b2a]">
                        vs {opponentName}
                      </p>
                      <p className="text-sm text-[#776f66]">{score}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${outcome.classes}`}
                    >
                      {outcome.label.replace("W.O. ", "")}
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-[#776f66]" />
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <main className="mx-auto hidden w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-8 sm:px-6 lg:px-8 md:flex">
        {/* ── Hero ── */}
        <section className="rounded-2xl border border-[#ded6ca] bg-[#fffdfa] p-6 shadow-sm">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#0d1b2a] text-xl font-bold tracking-wide text-[#fffdfa]">
                {initials}
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-[#0d1b2a]">
                  {player.fullName}
                </h1>
                <p className="mt-1 text-sm text-[#776f66]">
                  Categoría {rankingCategoryLabels[category]} · Estado{" "}
                  {player.status}
                  {rankingEntry
                    ? ` · #${rankingEntry.position} · ${rankingEntry.points} pts`
                    : ""}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {player.level && (
                    <span className="rounded-full bg-[#0d1b2a] px-3 py-1 text-xs font-medium text-[#fffdfa]">
                      {levelLabels[player.level]}
                    </span>
                  )}
                  {player.dominantHand && (
                    <span className="rounded-full border border-[#ded6ca] bg-[#ede5d8] px-3 py-1 text-xs text-[#17283a]">
                      {handLabels[player.dominantHand]}
                    </span>
                  )}
                  {player.backhand && (
                    <span className="rounded-full border border-[#ded6ca] bg-[#ede5d8] px-3 py-1 text-xs text-[#17283a]">
                      {backhandLabels[player.backhand]}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-end">
              <Link
                href="/disponibilidad"
                className="inline-flex items-center gap-2 rounded-xl bg-[#0d1b2a] px-4 py-2.5 text-sm font-medium text-[#fffdfa] transition hover:bg-[#17283a]"
              >
                <CalendarDays className="h-4 w-4" />
                Gestionar disponibilidad
              </Link>
              <Link
                href={`/ranking/${category}`}
                className="inline-flex items-center gap-2 rounded-xl border border-[#ded6ca] bg-[#fffdfa] px-4 py-2.5 text-sm font-medium text-[#0d1b2a] transition hover:bg-[#ede5d8]"
              >
                <BarChart3 className="h-4 w-4" />
                Ver ranking
              </Link>
            </div>
          </div>
        </section>

        {/* ── Stats row ── */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <article className="rounded-2xl border border-[#ded6ca] bg-[#fffdfa] p-4 shadow-sm">
            <div className="flex items-center gap-2 text-[#776f66]">
              <CalendarDays className="h-4 w-4" />
              <p className="text-xs font-medium">Partidos esta semana</p>
            </div>
            <p className="mt-2 text-3xl font-semibold text-[#0d1b2a]">
              {weekCount} <span className="text-xl text-[#776f66]">/ 3</span>
            </p>
            <span
              className={`mt-2 inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${getCounterTone(weekCount, 3)}`}
            >
              límite semanal
            </span>
          </article>

          <article className="rounded-2xl border border-[#ded6ca] bg-[#fffdfa] p-4 shadow-sm">
            <div className="flex items-center gap-2 text-[#776f66]">
              <CalendarDays className="h-4 w-4" />
              <p className="text-xs font-medium">Partidos últimos 30 días</p>
            </div>
            <p className="mt-2 text-3xl font-semibold text-[#0d1b2a]">
              {monthCount} <span className="text-xl text-[#776f66]">/ 4</span>
            </p>
            <span
              className={`mt-2 inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${getCounterTone(monthCount, 4)}`}
            >
              límite mensual
            </span>
          </article>

          <article className="rounded-2xl border border-[#ded6ca] bg-[#fffdfa] p-4 shadow-sm">
            <div className="flex items-center gap-2 text-[#776f66]">
              <Shield className="h-4 w-4" />
              <p className="text-xs font-medium">Desafíos últimos 30 días</p>
            </div>
            <p className="mt-2 text-3xl font-semibold text-[#0d1b2a]">
              {challengeCount}{" "}
              <span className="text-xl text-[#776f66]">/ 2</span>
            </p>
            <span
              className={`mt-2 inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${getCounterTone(challengeCount, 2)}`}
            >
              mínimo sugerido
            </span>
          </article>

          <article className="rounded-2xl border border-[#ded6ca] bg-[#fffdfa] p-4 shadow-sm">
            <div className="flex items-center gap-2 text-[#776f66]">
              <TrendingUp className="h-4 w-4" />
              <p className="text-xs font-medium">Win rate (últimos 4)</p>
            </div>
            <p className="mt-2 text-3xl font-semibold text-[#0d1b2a]">
              {winRateValue !== null ? `${winRateValue}%` : "—"}
            </p>
            {recentForm.length > 0 && (
              <div className="mt-2 flex gap-1">
                {recentResults.slice(0, 5).map(({ key, result: r }) => (
                  <span
                    key={key}
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                      r === "W"
                        ? "bg-emerald-100 text-emerald-700"
                        : r === "D"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    {r === "D" ? "E" : r}
                  </span>
                ))}
              </div>
            )}
            {recentForm.length === 0 && (
              <p className="mt-2 text-xs text-[#776f66]">Sin partidos aún</p>
            )}
          </article>
        </section>

        {/* ── Main content ── */}
        <div className="grid gap-5 lg:grid-cols-5">
          {/* Left column */}
          <div className="flex flex-col gap-5 lg:col-span-2">
            {/* Datos del jugador */}
            <section className="rounded-2xl border border-[#ded6ca] bg-[#fffdfa] p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-[#776f66]" />
                <h2 className="text-sm font-semibold text-[#0d1b2a]">
                  Datos del jugador
                </h2>
              </div>
              <dl className="mt-4 space-y-0 divide-y divide-[#ede5d8]">
                {age !== null && (
                  <div className="flex items-center justify-between py-2.5">
                    <dt className="text-sm text-[#776f66]">Edad</dt>
                    <dd className="text-sm font-medium text-[#0d1b2a]">
                      {age} años
                    </dd>
                  </div>
                )}
                {player.dominantHand && (
                  <div className="flex items-center justify-between py-2.5">
                    <dt className="text-sm text-[#776f66]">Mano dominante</dt>
                    <dd className="text-sm font-medium text-[#0d1b2a]">
                      {handLabels[player.dominantHand]}
                    </dd>
                  </div>
                )}
                {player.backhand && (
                  <div className="flex items-center justify-between py-2.5">
                    <dt className="text-sm text-[#776f66]">Revés</dt>
                    <dd className="text-sm font-medium text-[#0d1b2a]">
                      {backhandLabels[player.backhand]}
                    </dd>
                  </div>
                )}
                {player.level && (
                  <div className="flex items-center justify-between py-2.5">
                    <dt className="text-sm text-[#776f66]">Nivel</dt>
                    <dd>
                      <span className="rounded-full bg-[#0d1b2a] px-2.5 py-0.5 text-xs font-medium text-[#fffdfa]">
                        {levelLabels[player.level]}
                      </span>
                    </dd>
                  </div>
                )}
                {player.phone && (
                  <div className="flex items-center justify-between py-2.5">
                    <dt className="text-sm text-[#776f66]">Teléfono</dt>
                    <dd className="text-sm font-medium text-[#0d1b2a]">
                      {player.phone}
                    </dd>
                  </div>
                )}
              </dl>
              {!age &&
                !player.dominantHand &&
                !player.backhand &&
                !player.level &&
                !player.phone && (
                  <p className="mt-4 text-sm text-[#776f66]">
                    Sin datos de perfil registrados.
                  </p>
                )}
            </section>

            {/* Acciones rápidas */}
            <section className="rounded-2xl border border-[#ded6ca] bg-[#fffdfa] p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-[#776f66]" />
                <h2 className="text-sm font-semibold text-[#0d1b2a]">
                  Acciones rápidas
                </h2>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <Link
                  href={`/ranking/${category}`}
                  className="flex flex-col items-center gap-2 rounded-xl border border-[#ded6ca] bg-[#f6f2ea] p-3 text-center transition hover:bg-[#ede5d8]"
                >
                  <BarChart3 className="h-6 w-6 text-[#0d1b2a]" />
                  <span className="text-xs font-medium text-[#0d1b2a]">
                    Ver ranking
                  </span>
                </Link>
                <Link
                  href="/disponibilidad"
                  className="flex flex-col items-center gap-2 rounded-xl border border-[#ded6ca] bg-[#f6f2ea] p-3 text-center transition hover:bg-[#ede5d8]"
                >
                  <Clock className="h-6 w-6 text-[#0d1b2a]" />
                  <span className="text-xs font-medium text-[#0d1b2a]">
                    Disponibilidad
                  </span>
                </Link>
                <Link
                  href="/fixture"
                  className="flex flex-col items-center gap-2 rounded-xl border border-[#ded6ca] bg-[#f6f2ea] p-3 text-center transition hover:bg-[#ede5d8]"
                >
                  <CalendarDays className="h-6 w-6 text-[#0d1b2a]" />
                  <span className="text-xs font-medium text-[#0d1b2a]">
                    Ver fixture
                  </span>
                </Link>
              </div>
            </section>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-5 lg:col-span-3">
            {/* Resumen competitivo */}
            <section className="rounded-2xl border border-[#ded6ca] bg-[#fffdfa] p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-[#776f66]" />
                  <h2 className="text-sm font-semibold text-[#0d1b2a]">
                    Resumen competitivo
                  </h2>
                </div>
                <Link
                  href={`/ranking/${category}?player=${player.id}`}
                  className="text-xs font-medium text-[#776f66] hover:text-[#0d1b2a]"
                >
                  Ver ranking completo →
                </Link>
              </div>

              <div className="mt-4 grid grid-cols-4 gap-3 border-b border-[#ede5d8] pb-4">
                <div className="text-center">
                  <p className="text-xs text-[#776f66]">Ranking actual</p>
                  <p className="mt-1 text-2xl font-bold text-[#0d1b2a]">
                    {rankingEntry ? `#${rankingEntry.position}` : "—"}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-[#776f66]">Mejor ranking</p>
                  <p className="mt-1 text-2xl font-bold text-[#0d1b2a]">
                    {rankingEntry?.bestRankingPosition
                      ? `#${rankingEntry.bestRankingPosition}`
                      : "—"}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-[#776f66]">Puntos</p>
                  <p className="mt-1 text-2xl font-bold text-[#0d1b2a]">
                    {rankingEntry?.points ?? "—"}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-[#776f66]">Récord</p>
                  <p className="mt-1 text-2xl font-bold text-[#0d1b2a]">
                    {rankingEntry
                      ? `${rankingEntry.matchesWon}-${rankingEntry.matchesLost}`
                      : "—"}
                  </p>
                  {rankingEntry && (
                    <p className="text-[10px] text-[#776f66]">V-D</p>
                  )}
                </div>
              </div>

              {recentForm.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-[#776f66]">Racha reciente</p>
                  <div className="mt-2 flex items-center gap-1.5">
                    {recentResults.slice(0, 8).map(({ key, result: r }) => (
                      <span
                        key={key}
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                          r === "W"
                            ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200"
                            : r === "D"
                              ? "bg-blue-100 text-blue-700 ring-1 ring-blue-200"
                              : "bg-rose-100 text-rose-700 ring-1 ring-rose-200"
                        }`}
                      >
                        {r === "D" ? "E" : r}
                      </span>
                    ))}
                    <span className="ml-1 text-xs text-[#776f66]">
                      G = Ganado · E = Empate · L = Perdido
                    </span>
                  </div>
                </div>
              )}

              {!rankingEntry && (
                <p className="mt-4 text-sm text-[#776f66]">
                  Aún no apareces en el ranking de esta temporada.
                </p>
              )}
            </section>

            {/* Próximos partidos */}
            <section className="rounded-2xl border border-[#ded6ca] bg-[#fffdfa] p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[#776f66]" />
                  <h2 className="text-sm font-semibold text-[#0d1b2a]">
                    Próximos partidos
                  </h2>
                </div>
                {upcomingMatches.length > 0 && (
                  <Link
                    href="/fixture"
                    className="text-xs font-medium text-[#776f66] hover:text-[#0d1b2a]"
                  >
                    Ver fixture →
                  </Link>
                )}
              </div>

              {upcomingMatches.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-[#ded6ca] px-6 py-10 text-center text-sm text-[#776f66]">
                  No tienes partidos próximos publicados.
                </div>
              ) : (
                <div className="mt-4 divide-y divide-[#ede5d8]">
                  {upcomingMatches.map((match) => {
                    const isPlayer1 = match.player1Id === player.id;
                    const opponentName = isPlayer1
                      ? match.player2Name
                      : match.player1Name;
                    const opponentPhone = isPlayer1
                      ? match.player2Phone
                      : match.player1Phone;
                    const myAvailability = buildAvailabilitySlots({
                      availMonday: isPlayer1
                        ? match.player1AvailMonday
                        : match.player2AvailMonday,
                      availTuesday: isPlayer1
                        ? match.player1AvailTuesday
                        : match.player2AvailTuesday,
                      availWednesday: isPlayer1
                        ? match.player1AvailWednesday
                        : match.player2AvailWednesday,
                      availThursday: isPlayer1
                        ? match.player1AvailThursday
                        : match.player2AvailThursday,
                      availFriday: isPlayer1
                        ? match.player1AvailFriday
                        : match.player2AvailFriday,
                      availSaturday: isPlayer1
                        ? match.player1AvailSaturday
                        : match.player2AvailSaturday,
                      availSunday: isPlayer1
                        ? match.player1AvailSunday
                        : match.player2AvailSunday,
                      visibility: isPlayer1
                        ? match.player1Visibility
                        : match.player2Visibility,
                    });
                    const opponentAvailability = buildAvailabilitySlots({
                      availMonday: isPlayer1
                        ? match.player2AvailMonday
                        : match.player1AvailMonday,
                      availTuesday: isPlayer1
                        ? match.player2AvailTuesday
                        : match.player1AvailTuesday,
                      availWednesday: isPlayer1
                        ? match.player2AvailWednesday
                        : match.player1AvailWednesday,
                      availThursday: isPlayer1
                        ? match.player2AvailThursday
                        : match.player1AvailThursday,
                      availFriday: isPlayer1
                        ? match.player2AvailFriday
                        : match.player1AvailFriday,
                      availSaturday: isPlayer1
                        ? match.player2AvailSaturday
                        : match.player1AvailSaturday,
                      availSunday: isPlayer1
                        ? match.player2AvailSunday
                        : match.player1AvailSunday,
                      visibility: isPlayer1
                        ? match.player2Visibility
                        : match.player1Visibility,
                    });
                    const suggestedBlocks =
                      match.status === "pendiente"
                        ? getSharedAvailabilityRanges(
                            myAvailability,
                            opponentAvailability,
                          )
                        : [];
                    const hasAvailabilityData =
                      hasAnyAvailability(myAvailability) &&
                      hasAnyAvailability(opponentAvailability);

                    return (
                      <article
                        key={match.id}
                        className="flex flex-col gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#f6f2ea]">
                          <CalendarDays className="h-4 w-4 text-[#b04d15]" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-[#776f66]">
                            {typeLabel(match.type)} ·{" "}
                            {formatUpcomingDate(match)}
                          </p>
                          <p className="mt-0.5 text-sm font-semibold text-[#0d1b2a]">
                            vs {opponentName}
                          </p>
                          <p className="text-xs text-[#776f66]">
                            {match.status === "reportado"
                              ? "Resultado pendiente de confirmación"
                              : "Pendiente de jugar"}
                          </p>
                          {match.status === "pendiente" && (
                            <div className="mt-3 rounded-xl border border-[#ede5d8] bg-[#f6f2ea] px-3 py-2">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#776f66]">
                                Horarios recomendados
                              </p>
                              {suggestedBlocks.length > 0 ? (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {suggestedBlocks.map((block) => (
                                    <span
                                      key={`${match.id}-${block.dayKey}-${block.start}-${block.end}`}
                                      className="rounded-full bg-[#0d1b2a] px-2.5 py-1 text-xs font-medium text-[#fffdfa]"
                                    >
                                      {block.label}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p className="mt-1 text-xs text-[#776f66]">
                                  {hasAvailabilityData
                                    ? "No hay bloques compartidos de 90 minutos."
                                    : "Falta disponibilidad de uno de los jugadores."}
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
                          {opponentPhone && (
                            <a
                              href={whatsappUrl(opponentPhone)}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Enviar WhatsApp a ${opponentName}`}
                              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 hover:text-emerald-800"
                            >
                              <WhatsAppIcon className="h-3.5 w-3.5" />
                              WhatsApp
                            </a>
                          )}
                          <Link
                            href="/ingresar-resultado"
                            className="rounded-full border border-[#ded6ca] bg-[#fffdfa] px-3 py-1 text-xs font-medium text-[#b04d15] transition hover:bg-[#f6f2ea] hover:text-[#8a3a0f]"
                          >
                            Resultado
                          </Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Últimos resultados */}
            <section className="rounded-2xl border border-[#ded6ca] bg-[#fffdfa] p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-[#776f66]" />
                  <h2 className="text-sm font-semibold text-[#0d1b2a]">
                    Últimos resultados registrados
                  </h2>
                </div>
                {historyRows.length > 0 && (
                  <Link
                    href={`/ranking/${category}?player=${player.id}`}
                    className="text-xs font-medium text-[#776f66] hover:text-[#0d1b2a]"
                  >
                    Ver todos →
                  </Link>
                )}
              </div>

              {historyRows.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-[#ded6ca] px-6 py-10 text-center text-sm text-[#776f66]">
                  Todavía no registras partidos esta temporada.
                </div>
              ) : (
                <div className="mt-4 divide-y divide-[#ede5d8]">
                  {historyRows.slice(0, 6).map((match) => {
                    const isPlayer1 = match.player1Id === player.id;
                    const opponentName = isPlayer1
                      ? match.player2Name
                      : match.player1Name;
                    const outcome = getOutcome(match, player.id);
                    const score = formatScore(
                      match,
                      player.id,
                      setsByMatch.get(match.id) ?? [],
                    );
                    const dateParts = formatDateParts(match.playedOn);

                    return (
                      <article
                        key={match.id}
                        className="flex items-start gap-4 py-3 first:pt-0 last:pb-0"
                      >
                        {/* Date block */}
                        {dateParts ? (
                          <div className="flex w-10 shrink-0 flex-col items-center rounded-lg bg-[#f6f2ea] px-1 py-1.5 text-center">
                            <span className="text-sm font-bold leading-none text-[#0d1b2a]">
                              {dateParts.day}
                            </span>
                            <span className="mt-0.5 text-[10px] font-semibold uppercase text-[#b04d15]">
                              {dateParts.month}
                            </span>
                            <span className="text-[10px] text-[#776f66]">
                              {dateParts.year}
                            </span>
                          </div>
                        ) : (
                          <div className="w-10 shrink-0" />
                        )}

                        {/* Match info */}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-[#776f66]">
                            {typeLabel(match.type)}
                          </p>
                          <p className="mt-0.5 text-sm font-semibold text-[#0d1b2a]">
                            vs {opponentName}
                          </p>
                          <p className="text-xs text-[#776f66]">{score}</p>
                          <Link
                            href={`/mi-perfil/partidos/${match.id}`}
                            className="mt-1 inline-flex text-xs font-medium text-[#b04d15] hover:text-[#8a3a0f]"
                          >
                            Ver detalle →
                          </Link>
                        </div>

                        {/* Outcome badge + chevron */}
                        <div className="flex shrink-0 items-center gap-1">
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${outcome.classes}`}
                          >
                            {outcome.label}
                          </span>
                          <Link href={`/mi-perfil/partidos/${match.id}`}>
                            <ChevronRight className="h-4 w-4 text-[#ded6ca]" />
                          </Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </>
  );
}

function MobileProfileFact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="w-[88px] shrink-0 rounded-xl border border-[#ded6ca] bg-[#fffdfa] px-2 py-3 text-center shadow-sm">
      <div className="mx-auto flex h-6 w-6 items-center justify-center text-[#776f66]">
        {icon}
      </div>
      <p className="mt-1 text-xs leading-tight text-[#776f66]">{label}</p>
      <p className="mt-0.5 text-sm font-semibold leading-tight text-[#0d1b2a]">
        {value}
      </p>
    </div>
  );
}

function MobilePerformanceMetric({
  label,
  value,
  target,
  caption,
}: {
  label: string;
  value: number;
  target: number;
  caption: string;
}) {
  return (
    <div className="min-w-0 px-2 text-center">
      <p className="mx-auto min-h-10 text-xs leading-tight text-[#776f66]">
        {label}
      </p>
      <p className="mt-2 whitespace-nowrap text-2xl font-bold tabular-nums text-[#0d1b2a]">
        {value} <span className="text-[#776f66]">/ {target}</span>
      </p>
      <span className="mt-3 inline-flex max-w-full items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
        {caption}
      </span>
    </div>
  );
}

function MobileResultDot({ result }: { result: "W" | "L" | "D" }) {
  const classes =
    result === "W"
      ? "bg-emerald-100 text-emerald-700"
      : result === "D"
        ? "bg-blue-100 text-blue-700"
        : "bg-rose-100 text-rose-700";

  return (
    <span
      className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${classes}`}
    >
      {result === "D" ? "E" : result}
    </span>
  );
}

function MobileQuickAction({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-[#ded6ca] bg-[#f6f2ea] px-2 py-4 text-center text-sm font-medium text-[#0d1b2a]"
    >
      <span className="shrink-0">{icon}</span>
      <span className="leading-tight">{label}</span>
    </Link>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}
