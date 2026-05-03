import { and, desc, eq, or, sql } from "drizzle-orm"

import { db } from "@/lib/db"
import { matchSets, matches, players, rankingEvents, users } from "@/lib/db/schema"
import { getRanking, type PlayerStatus, type RankingCategory } from "@/lib/ranking"

export type PlayerCardData = {
  player: {
    id: string
    firstName: string
    lastName: string
    fullName: string
    gender: "M" | "F"
    level: string | null
    dominantHand: string | null
    backhand: string | null
    yearsPlaying: number | null
    joinedLadderOn: string | null
    birthDate: string | null
    age: number | null
    phone: string | null
    rut: string | null
    status: PlayerStatus
  }
  ranking: {
    position: number
    bestPosition: number | null
    bestPositionAchievedAt: string | null
    points: number
    deltaWeek: number
  }
  performance: {
    matchesPlayed: number
    matchesWon: number
    matchesLost: number
    winRate: number
    streak: Array<"W" | "L">
  }
  recentMatches: Array<{
    id: string
    opponentName: string
    opponentId: string
    score: string
    result: "W" | "L" | "WO_W" | "WO_L" | "D"
    playedOn: string
  }>
}

function startOfCurrentWeekSantiago() {
  const now = new Date()
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now)
  const [year, month, day] = fmt.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  const jsDay = date.getUTCDay()
  const diff = jsDay === 0 ? -6 : 1 - jsDay
  date.setUTCDate(date.getUTCDate() + diff)
  return date.toISOString()
}

function formatScore(
  status: string,
  viewedPlayerIsP1: boolean,
  sets: Array<{
    gamesP1: number
    gamesP2: number
    tiebreakP1: number | null
    tiebreakP2: number | null
  }>
) {
  if (status === "wo") return "WO"
  if (status === "empate" && sets.length === 0) return "Empate"
  if (sets.length === 0) return "Resultado confirmado"

  return sets
    .map((set) => {
      const viewedGames = viewedPlayerIsP1 ? set.gamesP1 : set.gamesP2
      const opponentGames = viewedPlayerIsP1 ? set.gamesP2 : set.gamesP1
      const base = `${viewedGames}-${opponentGames}`
      if (set.tiebreakP1 != null && set.tiebreakP2 != null) {
        const viewedTiebreak = viewedPlayerIsP1 ? set.tiebreakP1 : set.tiebreakP2
        const opponentTiebreak = viewedPlayerIsP1 ? set.tiebreakP2 : set.tiebreakP1
        return `${base} (${viewedTiebreak}-${opponentTiebreak})`
      }
      return base
    })
    .join(" · ")
}

function toIsoDate(value: string | Date | null | undefined) {
  if (!value) return null
  if (typeof value === "string") {
    return value.includes("T") ? value.slice(0, 10) : value
  }
  return value.toISOString().slice(0, 10)
}

function getAge(birthDate: string | Date | null) {
  const normalizedBirthDate = toIsoDate(birthDate)
  if (!normalizedBirthDate) return null
  const today = new Date()
  const birth = new Date(`${normalizedBirthDate}T00:00:00`)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1
  }
  return age
}

export async function getViewerContext(email?: string | null) {
  if (!email || !db) {
    return { viewerRole: "guest" as const, viewerPlayerId: undefined }
  }

  const [user] = await db
    .select({ role: users.role, playerId: users.playerId })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1)

  return {
    viewerRole: (user?.role ?? "guest") as "admin" | "player" | "guest",
    viewerPlayerId: user?.playerId ?? undefined,
  }
}

export async function getPlayerCardData(
  category: RankingCategory,
  playerId: string,
  viewerRole: "admin" | "player" | "guest",
  viewerPlayerId?: string
): Promise<PlayerCardData | null> {
  if (!db) return null

  const ranking = await getRanking(category)
  const rankingEntry = ranking.find((entry) => entry.id === playerId)
  if (!rankingEntry) return null

  const [player] = await db
    .select()
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1)

  if (!player) return null

  const visibleToOwner = viewerPlayerId === playerId || viewerRole === "admin"
  const visibility = player.visibility ?? {
    phone: "players",
    rut: "admin",
    birthDate: "private",
  }

  const canSeePhone =
    visibility.phone === "public" ||
    (visibility.phone === "players" && viewerRole !== "guest") ||
    (visibility.phone === "private" && visibleToOwner)

  const canSeeBirth =
    visibility.birthDate === "public" ||
    (visibility.birthDate === "players" && viewerRole !== "guest") ||
    (visibility.birthDate === "private" && visibleToOwner)

  const canSeeRut = viewerRole === "admin"

  const recentMatchesRows = await db
    .select({
      id: matches.id,
      playedOn: matches.playedOn,
      status: matches.status,
      winnerId: matches.winnerId,
      player1Id: matches.player1Id,
      player2Id: matches.player2Id,
      player1Name: players.fullName,
      player2Name: sql<string>`players_p2.full_name`,
      opponentId: sql<string>`case when ${matches.player1Id} = ${playerId} then ${matches.player2Id} else ${matches.player1Id} end`,
      opponentName: sql<string>`case when ${matches.player1Id} = ${playerId} then players_p2.full_name else ${players.fullName} end`,
    })
    .from(matches)
    .innerJoin(players, eq(matches.player1Id, players.id))
    .innerJoin(sql`players as players_p2`, sql`${matches.player2Id} = players_p2.id`)
    .where(
      and(
        or(eq(matches.player1Id, playerId), eq(matches.player2Id, playerId)),
        sql`${matches.status} in ('confirmado', 'wo', 'empate')`
      )
    )
    .orderBy(desc(matches.playedOn), desc(matches.confirmedAt), desc(matches.createdAt))
    .limit(5)

  const matchIds = recentMatchesRows.map((match) => match.id)
  const setRows = matchIds.length
    ? await db
        .select({
          matchId: matchSets.matchId,
          setNumber: matchSets.setNumber,
          gamesP1: matchSets.gamesP1,
          gamesP2: matchSets.gamesP2,
          tiebreakP1: matchSets.tiebreakP1,
          tiebreakP2: matchSets.tiebreakP2,
        })
        .from(matchSets)
        .where(sql`${matchSets.matchId} in (${sql.join(matchIds.map((id) => sql`${id}`), sql`, `)})`)
    : []

  const setsByMatch = new Map<string, typeof setRows>()
  for (const set of setRows) {
    const current = setsByMatch.get(set.matchId) ?? []
    current.push(set)
    setsByMatch.set(set.matchId, current)
  }

  const recentMatches: PlayerCardData["recentMatches"] = recentMatchesRows.map((match) => {
    const sets = (setsByMatch.get(match.id) ?? []).sort((a, b) => a.setNumber - b.setNumber)
    const won = match.status !== "empate" && match.winnerId === playerId
    const lost = match.status !== "empate" && match.winnerId !== null && match.winnerId !== playerId
    const result: PlayerCardData["recentMatches"][number]["result"] =
      match.status === "empate"
        ? "D"
        : match.status === "wo"
          ? won
            ? "WO_W"
            : "WO_L"
          : won
            ? "W"
            : lost
              ? "L"
              : "D"

    return {
      id: match.id,
      opponentName: match.opponentName,
      opponentId: match.opponentId,
      score: formatScore(match.status, match.player1Id === playerId, sets),
      result,
      playedOn: toIsoDate(match.playedOn) ?? "",
    }
  })

  const matchesPlayed = recentMatchesRows.length
  const matchesWon = recentMatches.filter((match) => match.result === "W" || match.result === "WO_W").length
  const matchesLost = recentMatches.filter((match) => match.result === "L" || match.result === "WO_L").length

  const [deltaWeekRow] = await db
    .select({ value: sql<number>`coalesce(sum(${rankingEvents.delta}), 0)` })
    .from(rankingEvents)
    .where(
      and(
        eq(rankingEvents.playerId, playerId),
        sql`${rankingEvents.occurredAt} >= ${startOfCurrentWeekSantiago()}`
      )
    )

  return {
    player: {
      id: player.id,
      firstName: player.firstName ?? player.fullName.split(" ")[0] ?? "",
      lastName: player.lastName ?? player.fullName.split(" ").slice(1).join(" "),
      fullName: player.fullName,
      gender: player.gender,
      level: player.level,
      dominantHand: player.dominantHand,
      backhand: player.backhand,
      yearsPlaying: player.yearsPlaying,
      joinedLadderOn: toIsoDate(player.joinedLadderOn),
      birthDate: canSeeBirth ? toIsoDate(player.birthDate) : null,
      age: canSeeBirth ? getAge(player.birthDate) : null,
      phone: canSeePhone ? player.phone : null,
      rut: canSeeRut ? player.rut : null,
      status: player.status,
    },
    ranking: {
      position: rankingEntry.position,
      bestPosition: rankingEntry.bestRankingPosition,
      bestPositionAchievedAt: toIsoDate(rankingEntry.bestRankingAchievedAt),
      points: rankingEntry.points,
      deltaWeek: Number(deltaWeekRow?.value ?? rankingEntry.weeklyDelta ?? 0),
    },
    performance: {
      matchesPlayed,
      matchesWon,
      matchesLost,
      winRate: matchesPlayed > 0 ? (matchesWon / matchesPlayed) * 100 : 0,
      streak: recentMatches
        .map((match) => (match.result === "W" || match.result === "WO_W" ? "W" : match.result === "L" || match.result === "WO_L" ? "L" : null))
        .filter((value): value is "W" | "L" => value !== null),
    },
    recentMatches,
  }
}
