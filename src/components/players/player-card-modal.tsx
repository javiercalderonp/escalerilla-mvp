"use client"

import {
  BarChart2Icon,
  CalendarIcon,
  ChevronDownIcon,
  Clock3Icon,
  FlameIcon,
  HandIcon,
  IdCardIcon,
  PercentIcon,
  ShieldIcon,
  StarIcon,
  TrophyIcon,
  XIcon,
} from "lucide-react"
import { useEffect, useState } from "react"

import { Avatar } from "@/components/ui/avatar"
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs"
import type { PlayerCardData } from "@/lib/players/get-player-card-data"
import { whatsappUrl } from "@/lib/validation/phone"

const INITIAL_VISIBLE_MATCHES = 5

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
  const [visibleMatches, setVisibleMatches] = useState(INITIAL_VISIBLE_MATCHES)

  useEffect(() => {
    if (open) {
      setActiveTab("info")
      setVisibleMatches(INITIAL_VISIBLE_MATCHES)
    }
  }, [open])

  const p = data.player
  const level = levelLabel(p.level)
  const record = `${data.performance.matchesWon}–${data.performance.matchesLost}`
  const performancePercent =
    data.performance.matchesPlayed > 0
      ? Math.round(
          (data.performance.matchesWon / data.performance.matchesPlayed) * 100
        )
      : 0
  const visibleRecentMatches = data.recentMatches.slice(0, visibleMatches)
  const remainingMatches = data.recentMatches.length - visibleRecentMatches.length
  const streakItems = data.recentMatches.reduce<
    Array<{ id: string; result: "W" | "L" }>
  >((items, match) => {
    if (match.result === "W" || match.result === "WO_W") {
      items.push({ id: match.id, result: "W" })
      return items
    }
    if (match.result === "L" || match.result === "WO_L") {
      items.push({ id: match.id, result: "L" })
      return items
    }
    return items
  }, [])

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
              <div className="flex items-center gap-2">
                <h2 className="truncate text-2xl font-bold tracking-tight text-white">
                  {p.firstName} {p.lastName}
                </h2>
                {p.phone && (
                  <a
                    href={whatsappUrl(p.phone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Enviar WhatsApp a ${p.firstName} ${p.lastName}`}
                    className="shrink-0 inline-flex size-8 items-center justify-center rounded-lg border border-green-400/40 bg-green-500/20 text-green-400 transition hover:bg-green-500/30"
                  >
                    <WhatsAppIcon className="size-4" />
                  </a>
                )}
              </div>
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

          <div className="relative grid grid-cols-5 gap-2 px-5 pb-5">
            <HeroStat
              icon={<BarChart2Icon className="size-3.5" />}
              label="Ranking"
              value={`#${data.ranking.position}`}
            />
            <HeroStat
              icon={<ShieldIcon className="size-3.5" />}
              label="Nivel"
              value={level ?? "—"}
              multiline
            />
            <HeroStat
              icon={<CalendarIcon className="size-3.5" />}
              label="Edad"
              value={p.age != null ? `${p.age} años` : "—"}
            />
            <HeroStat
              icon={<TrophyIcon className="size-3.5" />}
              label="Récord"
              value={record}
            />
            <HeroStat
              icon={<PercentIcon className="size-3.5" />}
              label="Rend."
              value={`${performancePercent}%`}
            />
          </div>
        </div>

        {/* ── Tabs – underline style, dark theme ── */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="flex h-12 w-full rounded-none border-b border-white/10 bg-[#080e2a] p-0 px-2 gap-0">
            <TabsTab
              value="info"
              className={`h-full min-w-0 rounded-none border-b-[3px] px-5 py-0 -mb-px text-sm transition-colors ${
                activeTab === "info"
                  ? "border-white font-bold text-white"
                  : "border-transparent font-medium text-white/40"
              }`}
            >
              Info
            </TabsTab>
            <TabsTab
              value="performance"
              className={`h-full min-w-0 rounded-none border-b-[3px] px-5 py-0 -mb-px text-sm transition-colors ${
                activeTab === "performance"
                  ? "border-white font-bold text-white"
                  : "border-transparent font-medium text-white/40"
              }`}
            >
              Rendimiento
            </TabsTab>
          </TabsList>

          {/* INFO tab – dark theme */}
          <TabsPanel
            value="info"
            className="min-h-0 flex-1 overflow-y-auto bg-[#080e2a] p-5"
          >
            <div className="flex flex-col gap-4 sm:flex-row">
              {/* Left: info rows */}
              <div className="min-w-0 flex-1 space-y-2">
                <InfoRow
                  icon={<CalendarIcon className="size-4" />}
                  label="Edad"
                  value={p.age != null ? `${p.age} años` : "—"}
                />
                <InfoRow
                  icon={<RacketIcon />}
                  label="Mano"
                  value={
                    p.dominantHand === "diestro"
                      ? "Diestro"
                      : p.dominantHand === "zurdo"
                        ? "Zurdo"
                        : "—"
                  }
                />
                <InfoRow
                  icon={<HandIcon className="size-4" />}
                  label="Revés"
                  value={
                    p.backhand === "una_mano"
                      ? "Una mano"
                      : p.backhand === "dos_manos"
                        ? "Dos manos"
                        : "—"
                  }
                />
                <InfoRow
                  icon={<Clock3Icon className="size-4" />}
                  label="Años jugando"
                  value={p.yearsPlaying != null ? String(p.yearsPlaying) : "—"}
                />
                <InfoRow
                  icon={<TrophyIcon className="size-4" />}
                  label="En la escalerilla"
                  value={
                    p.joinedLadderOn
                      ? (formatDate(p.joinedLadderOn) ?? p.joinedLadderOn)
                      : "—"
                  }
                />
                {p.rut ? (
                  <InfoRow
                    icon={<IdCardIcon className="size-4" />}
                    label="RUT"
                    value={p.rut}
                  />
                ) : null}
              </div>

              {data.availability ? (
                <div className="shrink-0 rounded-xl border border-white/[0.1] bg-white/[0.06] p-4 sm:w-52">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">
                      Disponibilidad
                    </p>
                    <CalendarIcon className="size-4 text-blue-300" />
                  </div>

                  {data.availability.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {data.availability.map((day) => (
                        <div
                          key={day.day}
                          className="flex items-start gap-2 text-sm"
                        >
                          <span className="w-9 shrink-0 rounded-full bg-blue-500/20 px-2 py-0.5 text-center text-xs font-semibold text-blue-300">
                            {day.short}
                          </span>
                          <span className="min-w-0 flex-1 leading-snug text-white/55">
                            {day.summary}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs leading-5 text-white/45">
                      Sin disponibilidad informada.
                    </p>
                  )}
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-blue-400/20 bg-blue-500/[0.08] px-4 py-3">
              <ShieldIcon className="mt-0.5 size-4 shrink-0 text-blue-400" />
              <p className="text-xs italic text-white/45">
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
                  {streakItems.length > 0 ? (
                    streakItems.map((item) => (
                      <span
                        key={item.id}
                        className={`flex size-8 items-center justify-center rounded-full text-xs font-bold ${
                          item.result === "W"
                            ? "bg-green-900/70 text-green-400 ring-1 ring-green-600/30"
                            : "bg-orange-950/70 text-orange-400 ring-1 ring-orange-700/30"
                        }`}
                      >
                        {item.result}
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
                    {visibleRecentMatches.map((match) => {
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
                  {remainingMatches > 0 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setVisibleMatches((current) =>
                          Math.min(current + 5, data.recentMatches.length)
                        )
                      }
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-white/75 transition hover:bg-white/[0.1] hover:text-white"
                    >
                      <ChevronDownIcon className="size-4" />
                      Ver más ({remainingMatches})
                    </button>
                  ) : null}
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
  multiline = false,
}: {
  icon: React.ReactNode
  label: string
  value: string
  multiline?: boolean
}) {
  return (
    <div className="min-w-0 flex flex-col gap-1.5 rounded-xl bg-white/10 p-2.5 sm:p-3">
      <div className="flex items-center gap-1 text-blue-200/75">
        {icon}
        <span className="truncate text-[10px] font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p
        className={
          multiline
            ? "line-clamp-2 text-sm font-bold leading-tight text-white"
            : "truncate text-sm font-bold text-white"
        }
      >
        {value}
      </p>
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
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.1] bg-white/[0.06] px-4 py-3 text-sm">
      <span className="shrink-0 text-white/50">{icon}</span>
      <span className="text-white/55">{label}</span>
      <span className="ml-auto font-semibold text-white">{value}</span>
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
  )
}

function RacketIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
    >
      <ellipse cx="8.5" cy="7.5" rx="4.8" ry="6.2" transform="rotate(35 8.5 7.5)" />
      <path d="M12.2 12.2 20 20" />
      <path d="m17.8 19.8 2-2" />
      <path d="m16.1 18.1 2-2" />
      <path d="M6 5.2 11.1 10.3" />
      <path d="M4.3 8.1 8.9 12.7" />
      <path d="M8.4 3.7 13 8.3" />
    </svg>
  )
}
