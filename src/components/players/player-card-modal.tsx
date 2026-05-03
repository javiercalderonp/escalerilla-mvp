"use client"

import { useEffect, useState } from "react"
import {
  BarChart2Icon,
  CalendarIcon,
  Clock3Icon,
  FlameIcon,
  HandIcon,
  IdCardIcon,
  MessageCircleIcon,
  PercentIcon,
  ShieldIcon,
  StarIcon,
  TrendingUpIcon,
  TrophyIcon,
  XIcon,
} from "lucide-react"

import { Avatar } from "@/components/ui/avatar"
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs"
import { whatsappUrl } from "@/lib/validation/phone"
import type { PlayerCardData } from "@/lib/players/get-player-card-data"

function formatDate(value: string | Date | null) {
  if (!value) return null
  const normalized =
    typeof value === "string"
      ? value.includes("T")
        ? value.slice(0, 10)
        : value
      : value.toISOString().slice(0, 10)
  const [year, month, day] = normalized.split("-")
  return `${day}/${month}/${year}`
}

function levelLabel(level: string | null) {
  if (!level) return null
  return level.replaceAll("_", " ")
}

function computeCurrentStreak(streak: Array<"W" | "L">) {
  if (!streak.length) return 0
  const positive = streak[0] === "W"
  let count = 0
  for (const r of streak) {
    if ((r === "W") === positive) count++
    else break
  }
  return positive ? count : -count
}

export function PlayerCardModal({
  data,
  open,
  onClose,
}: {
  data: PlayerCardData
  open: boolean
  onClose: () => void
}) {
  const [activeTab, setActiveTab] = useState("info")

  useEffect(() => {
    if (open) setActiveTab("info")
  }, [open])

  const p = data.player
  const level = levelLabel(p.level)
  const record = `${data.performance.matchesWon}–${data.performance.matchesLost}`
  const currentStreak = computeCurrentStreak(data.performance.streak)

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="bottom-0 top-auto !flex max-h-[calc(100dvh-1rem)] translate-x-[-50%] translate-y-0 flex-col gap-0 overflow-hidden rounded-t-2xl p-0 sm:bottom-auto sm:top-1/2 sm:max-h-[calc(100dvh-2rem)] sm:max-w-xl sm:-translate-y-1/2 sm:rounded-2xl"
      >
        {/* ── Hero header ── */}
        <div
          className="relative shrink-0 overflow-hidden rounded-t-2xl"
          style={{
            background:
              "linear-gradient(140deg, #0b1d4f 0%, #1640a0 55%, #0d2460 100%)",
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />

          <DialogClose className="absolute right-3 top-3 z-10 rounded-full p-2 text-white/50 transition hover:bg-white/15 hover:text-white">
            <XIcon className="size-5" />
            <span className="sr-only">Cerrar</span>
          </DialogClose>

          <div className="relative flex items-center gap-5 px-6 pb-5 pt-6">
            <div className="relative shrink-0">
              <div className="rounded-full ring-2 ring-blue-400 ring-offset-2 ring-offset-[#0b1d4f]">
                <Avatar
                  firstName={p.firstName}
                  lastName={p.lastName}
                  size="xl"
                  className="bg-[#1a3880] text-xl text-white"
                />
              </div>
              {p.status === "activo" && (
                <span className="absolute bottom-0.5 right-0.5 size-3.5 rounded-full bg-green-400 ring-2 ring-[#0b1d4f]" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-2xl font-bold tracking-tight text-white">
                {p.firstName} {p.lastName}
              </h2>
              <p className="mt-0.5 text-sm text-white/55">
                #{data.ranking.position} ·{" "}
                {p.gender === "M" ? "Hombres" : "Mujeres"}
              </p>
              {level && (
                <span className="mt-2 inline-block rounded-full border border-blue-400/40 bg-blue-500/25 px-3 py-1 text-xs font-semibold text-blue-100">
                  {level}
                </span>
              )}
            </div>
          </div>

          <div className="relative grid grid-cols-4 gap-2 px-5 pb-5">
            <HeroStat
              icon={<BarChart2Icon className="size-3.5" />}
              label="Ranking"
              value={`#${data.ranking.position}`}
            />
            <HeroStat
              icon={<ShieldIcon className="size-3.5" />}
              label="Nivel"
              value={level ?? "—"}
            />
            <HeroStat
              icon={<TrophyIcon className="size-3.5" />}
              label="Modalidad"
              value="Singles"
            />
            <HeroStat
              icon={<TrophyIcon className="size-3.5" />}
              label="Récord"
              value={record}
            />
          </div>
        </div>

        {/* ── Tabs – underline style ── */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="flex h-12 w-full rounded-none border-b border-border bg-background p-0 px-2 gap-0">
            <TabsTab
              value="info"
              className="h-full min-w-0 rounded-none border-b-2 border-transparent px-5 py-0 -mb-px font-medium text-muted-foreground transition-colors data-[selected]:border-court data-[selected]:bg-transparent data-[selected]:text-court"
            >
              Info
            </TabsTab>
            <TabsTab
              value="performance"
              className="h-full min-w-0 rounded-none border-b-2 border-transparent px-5 py-0 -mb-px font-medium text-muted-foreground transition-colors data-[selected]:border-court data-[selected]:bg-transparent data-[selected]:text-court"
            >
              Rendimiento
            </TabsTab>
          </TabsList>

          {/* INFO tab */}
          <TabsPanel
            value="info"
            className="min-h-0 flex-1 overflow-y-auto bg-background p-5"
          >
            <div className="flex flex-col gap-4 sm:flex-row">
              {/* Left: info rows */}
              <div className="min-w-0 flex-1 space-y-2">
                {p.age != null && (
                  <InfoRow
                    icon={<CalendarIcon className="size-4" />}
                    label="Edad"
                    value={`${p.age} años`}
                  />
                )}
                {p.dominantHand && (
                  <InfoRow
                    icon={<HandIcon className="size-4" />}
                    label="Mano"
                    value={p.dominantHand === "diestro" ? "Diestro" : "Zurdo"}
                  />
                )}
                {p.backhand && (
                  <InfoRow
                    icon={<HandIcon className="size-4" />}
                    label="Revés"
                    value={
                      p.backhand === "una_mano" ? "Una mano" : "Dos manos"
                    }
                  />
                )}
                {p.yearsPlaying != null && (
                  <InfoRow
                    icon={<Clock3Icon className="size-4" />}
                    label="Años jugando"
                    value={String(p.yearsPlaying)}
                  />
                )}
                {p.joinedLadderOn && (
                  <InfoRow
                    icon={<TrophyIcon className="size-4" />}
                    label="En la escalerilla"
                    value={formatDate(p.joinedLadderOn) ?? p.joinedLadderOn}
                  />
                )}
                {p.phone ? (
                  <a
                    href={whatsappUrl(p.phone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm transition hover:bg-muted/50"
                  >
                    <MessageCircleIcon className="size-4 text-grass" />
                    <span>WhatsApp</span>
                  </a>
                ) : null}
                {p.rut ? (
                  <InfoRow
                    icon={<IdCardIcon className="size-4" />}
                    label="RUT"
                    value={p.rut}
                  />
                ) : null}
              </div>

              {/* Right: compact performance panel */}
              <div className="shrink-0 rounded-xl border border-border bg-muted/30 p-4 sm:w-52">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">
                    Rendimiento
                  </p>
                  <TrendingUpIcon className="size-4 text-court" />
                </div>

                <p className="mt-3 text-xs text-muted-foreground">Últimos 5</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {data.performance.streak.slice(0, 5).length > 0 ? (
                    data.performance.streak.slice(0, 5).map((r, i) => (
                      <span
                        key={i}
                        className={`flex size-8 items-center justify-center rounded-full text-xs font-bold ${
                          r === "W"
                            ? "bg-grass/15 text-grass ring-1 ring-grass/30"
                            : "bg-clay/15 text-clay ring-1 ring-clay/30"
                        }`}
                      >
                        {r}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>

                <div className="mt-3 space-y-2.5 border-t border-border/60 pt-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      Racha actual
                    </span>
                    <span
                      className={`text-sm font-semibold ${
                        currentStreak > 0
                          ? "text-grass"
                          : currentStreak < 0
                            ? "text-clay"
                            : "text-muted-foreground"
                      }`}
                    >
                      {currentStreak > 0
                        ? `+${currentStreak} 🔥`
                        : currentStreak < 0
                          ? `${currentStreak}`
                          : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      Partidos jugados
                    </span>
                    <span className="text-base font-bold text-foreground">
                      {data.performance.matchesPlayed}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab("performance")}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-court px-3 py-2 text-xs font-medium text-court transition hover:bg-court/5"
                >
                  <BarChart2Icon className="size-3.5" />
                  Ver rendimiento completo
                </button>
              </div>
            </div>

            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-court/20 bg-court/5 px-4 py-3">
              <ShieldIcon className="mt-0.5 size-4 shrink-0 text-court" />
              <p className="text-xs italic text-muted-foreground">
                Este jugador forma parte de la escalerilla y puede desafiar o
                ser desafiado según las reglas de la liga.
              </p>
            </div>
          </TabsPanel>

          {/* PERFORMANCE tab – dark theme */}
          <TabsPanel
            value="performance"
            className="min-h-0 flex-1 overflow-y-auto bg-[#080e2a] sm:rounded-b-2xl"
          >
            <div className="space-y-4 p-5">
              {/* 5 stat cards with icons */}
              <div className="grid grid-cols-5 gap-2">
                <DarkStat
                  icon={<CalendarIcon className="size-4" />}
                  label="Partidos jugados"
                  value={String(data.performance.matchesPlayed)}
                />
                <DarkStat
                  icon={<TrophyIcon className="size-4" />}
                  label="Ganados"
                  value={String(data.performance.matchesWon)}
                  tone="grass"
                />
                <DarkStat
                  icon={<PercentIcon className="size-4" />}
                  label="% Win"
                  value={`${data.performance.winRate.toFixed(0)}%`}
                />
                <DarkStat
                  icon={<BarChart2Icon className="size-4" />}
                  label="Ranking actual"
                  value={`#${data.ranking.position}`}
                />
                <DarkStat
                  icon={<StarIcon className="size-4" />}
                  label="Mejor ranking"
                  value={
                    data.ranking.bestPosition != null
                      ? `#${data.ranking.bestPosition}`
                      : "—"
                  }
                  tone="grass"
                />
              </div>

              {/* Racha */}
              <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white/[0.06] px-4 py-3">
                <div className="flex items-center gap-2">
                  <FlameIcon className="size-4 text-orange-400" />
                  <span className="text-sm font-semibold text-white">
                    Racha
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {data.performance.streak.length > 0 ? (
                    data.performance.streak.map((r, i) => (
                      <span
                        key={i}
                        className={`flex size-8 items-center justify-center rounded-full text-xs font-bold ${
                          r === "W"
                            ? "bg-green-900/70 text-green-400 ring-1 ring-green-600/30"
                            : "bg-orange-950/70 text-orange-400 ring-1 ring-orange-700/30"
                        }`}
                      >
                        {r}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-white/40">Sin partidos</span>
                  )}
                </div>
              </div>

              {/* Recent matches */}
              {data.recentMatches.length > 0 && (
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <Clock3Icon className="size-4 text-white/40" />
                    <p className="text-sm font-semibold text-white">
                      Últimos partidos
                    </p>
                  </div>
                  <ul className="space-y-2">
                    {data.recentMatches.map((match) => {
                      const won =
                        match.result === "W" || match.result === "WO_W"
                      const lost =
                        match.result === "L" || match.result === "WO_L"
                      return (
                        <li
                          key={match.id}
                          className="flex items-center gap-3 rounded-xl bg-white/[0.06] px-4 py-3"
                        >
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/50">
                            <RacketIcon />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-white">
                              vs {match.opponentName}
                            </p>
                            {match.score && (
                              <p className="text-xs text-white/35">
                                {match.score}
                              </p>
                            )}
                          </div>
                          <span
                            className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                              won
                                ? "bg-green-900/60 text-green-400"
                                : lost
                                  ? "bg-orange-950/60 text-orange-400"
                                  : "bg-white/10 text-white/60"
                            }`}
                          >
                            {won ? "W" : lost ? "L" : "D"}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </div>
          </TabsPanel>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

function HeroStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl bg-white/10 p-3">
      <div className="flex items-center gap-1 text-blue-200/75">
        {icon}
        <span className="truncate text-[10px] font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="truncate text-sm font-bold text-white">{value}</p>
    </div>
  )
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm">
      <span className="shrink-0 text-court">{icon}</span>
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto font-semibold text-foreground">{value}</span>
    </div>
  )
}

function DarkStat({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone?: "default" | "grass"
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-xl bg-white/[0.08] p-3 text-center">
      <div
        className={`flex size-8 items-center justify-center rounded-full ${
          tone === "grass"
            ? "bg-green-900/60 text-green-400"
            : "bg-blue-900/60 text-blue-300"
        }`}
      >
        {icon}
      </div>
      <p
        className={`text-base font-bold tabular-nums leading-none ${
          tone === "grass" ? "text-green-400" : "text-white"
        }`}
      >
        {value}
      </p>
      <p className="text-[9px] leading-tight text-white/45">{label}</p>
    </div>
  )
}

function RacketIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      className="size-4"
    >
      <ellipse cx="9.5" cy="9.5" rx="6" ry="6" />
      <line x1="14" y1="14" x2="20" y2="20" />
      <line x1="7" y1="9.5" x2="12" y2="9.5" />
      <line x1="9.5" y1="7" x2="9.5" y2="12" />
    </svg>
  )
}
