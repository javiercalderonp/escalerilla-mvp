"use client"

import { CheckIcon } from "lucide-react"
import type { RecentPublicMatch } from "@/lib/ranking"

function formatDate(value: string | null) {
  if (!value) return ""
  const [year, month, day] = value.split("-")
  return `${day}/${month}/${year}`
}

function typeLabel(type: RecentPublicMatch["type"]) {
  if (type === "desafio") return "Desafío"
  if (type === "campeonato") return "Campeonato"
  return "Sorteo"
}

function shortName(fullName: string) {
  const parts = fullName.trim().split(" ")
  if (parts.length === 1) return fullName
  return `${parts[0][0]}. ${parts.slice(1).join(" ")}`
}

function MatchCard({ match }: { match: RecentPublicMatch }) {
  const p1Won = match.winnerId === match.player1Id
  const p2Won = match.winnerId === match.player2Id

  return (
    <div className="w-72 shrink-0 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* Card header */}
      <div className="flex items-center justify-between border-b border-white/10 bg-[#0d1b2a] px-4 py-2.5">
        <span className="text-xs font-semibold text-clay">
          {typeLabel(match.type)}
        </span>
        <span className="text-xs text-white/40">
          {formatDate(match.playedOn)}
        </span>
      </div>

      {/* Players + scores */}
      <div className="space-y-1 px-4 py-3">
        {/* Player 1 row */}
        <div className="flex items-center gap-2">
          <div
            className={`size-2.5 rounded-full shrink-0 ${p1Won ? "bg-court" : "bg-border"}`}
          />
          <span
            className={`flex-1 truncate text-sm ${p1Won ? "font-semibold text-foreground" : "text-muted-foreground"}`}
          >
            {shortName(match.player1Name)}
          </span>
          {p1Won && (
            <CheckIcon className="size-3.5 shrink-0 text-court" />
          )}
          <div className="flex gap-2 pl-1">
            {match.sets.map((set, i) => (
              <span
                key={i}
                className={`w-4 text-center text-sm tabular-nums ${p1Won ? "font-bold text-foreground" : "text-muted-foreground"}`}
              >
                {set.gamesP1}
              </span>
            ))}
          </div>
        </div>

        {/* Player 2 row */}
        <div className="flex items-center gap-2">
          <div
            className={`size-2.5 rounded-full shrink-0 ${p2Won ? "bg-court" : "bg-border"}`}
          />
          <span
            className={`flex-1 truncate text-sm ${p2Won ? "font-semibold text-foreground" : "text-muted-foreground"}`}
          >
            {shortName(match.player2Name)}
          </span>
          {p2Won && (
            <CheckIcon className="size-3.5 shrink-0 text-court" />
          )}
          <div className="flex gap-2 pl-1">
            {match.sets.map((set, i) => (
              <span
                key={i}
                className={`w-4 text-center text-sm tabular-nums ${p2Won ? "font-bold text-foreground" : "text-muted-foreground"}`}
              >
                {set.gamesP2}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function MatchesCarousel({
  matches,
}: {
  matches: RecentPublicMatch[]
}) {
  if (matches.length === 0) return null

  const doubled = [...matches, ...matches]

  return (
    <div
      className="overflow-hidden"
      style={{
        maskImage:
          "linear-gradient(90deg, transparent 0%, black 8%, black 92%, transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(90deg, transparent 0%, black 8%, black 92%, transparent 100%)",
      }}
    >
      <div
        className="flex gap-4 pr-4 will-change-transform"
        style={{ animation: "marquee 40s linear infinite" }}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLElement).style.animationPlayState = "paused"
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLElement).style.animationPlayState = "running"
        }}
      >
        {doubled.map((match, i) => (
          <MatchCard key={`${match.id}-${i}`} match={match} />
        ))}
      </div>
    </div>
  )
}
