"use client"

import { CalendarIcon, Clock3Icon, HandIcon, IdCardIcon, MessageCircleIcon, TrophyIcon } from "lucide-react"

import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent } from "@/components/ui/dialog"
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

export function PlayerCardModal({
  data,
  open,
  onClose,
}: {
  data: PlayerCardData
  open: boolean
  onClose: () => void
}) {
  const p = data.player

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="bottom-0 top-auto max-h-[90vh] translate-x-[-50%] translate-y-0 gap-0 overflow-y-auto rounded-t-2xl p-0 sm:top-1/2 sm:max-w-md sm:-translate-y-1/2 sm:rounded-2xl">
        <header className="flex items-center gap-3 border-b p-4 pr-12">
          <Avatar firstName={p.firstName} lastName={p.lastName} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold tracking-tight">
              {p.firstName} {p.lastName}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="tabular-nums">#{data.ranking.position}</span>
              <span>·</span>
              <span>{p.gender === "M" ? "Hombres" : "Mujeres"}</span>
              {p.level ? <Badge variant="court">{levelLabel(p.level)}</Badge> : null}
            </div>
          </div>
        </header>

        <Tabs defaultValue="info">
          <TabsList className="mx-4 mt-3">
            <TabsTab value="info">Info</TabsTab>
            <TabsTab value="performance">Rendimiento</TabsTab>
          </TabsList>

          <TabsPanel value="info" className="space-y-3 p-4">
            {p.age != null ? <InfoRow icon={<CalendarIcon />} label="Edad" value={`${p.age} años`} /> : null}
            {p.dominantHand ? <InfoRow icon={<HandIcon />} label="Mano" value={p.dominantHand === "diestro" ? "Diestro" : "Zurdo"} /> : null}
            {p.backhand ? <InfoRow icon={<HandIcon />} label="Revés" value={p.backhand === "una_mano" ? "Una mano" : "Dos manos"} /> : null}
            {p.yearsPlaying != null ? <InfoRow icon={<Clock3Icon />} label="Años jugando" value={String(p.yearsPlaying)} /> : null}
            {p.joinedLadderOn ? <InfoRow icon={<TrophyIcon />} label="En la escalerilla desde" value={formatDate(p.joinedLadderOn) ?? p.joinedLadderOn} /> : null}
            {p.phone ? (
              <a
                href={whatsappUrl(p.phone)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-2xl border border-border px-4 py-3 text-sm transition hover:bg-muted/50"
              >
                <MessageCircleIcon className="size-4 text-grass" />
                <span>WhatsApp</span>
              </a>
            ) : null}
            {p.rut ? <InfoRow icon={<IdCardIcon />} label="RUT" value={p.rut} /> : null}
          </TabsPanel>

          <TabsPanel value="performance" className="space-y-4 p-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <Stat label="Jugados" value={String(data.performance.matchesPlayed)} />
              <Stat label="Ganados" value={String(data.performance.matchesWon)} tone="grass" />
              <Stat label="% Win" value={`${data.performance.winRate.toFixed(0)}%`} />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Racha:</span>
              <div className="flex gap-1">
                {data.performance.streak.length > 0 ? data.performance.streak.map((result, index) => (
                  <Badge key={`${result}-${index}`} variant={result === "W" ? "success" : "warning"} size="sm">
                    {result}
                  </Badge>
                )) : <span>—</span>}
              </div>
            </div>
            <ul className="space-y-2">
              {data.recentMatches.map((match) => (
                <li key={match.id} className="rounded-2xl border border-border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">vs {match.opponentName}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(match.playedOn) ?? match.playedOn}</p>
                    </div>
                    <Badge variant={match.result === "W" || match.result === "WO_W" ? "success" : match.result === "D" ? "muted" : "warning"}>
                      {match.result}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{match.score}</p>
                </li>
              ))}
            </ul>
          </TabsPanel>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border px-4 py-3 text-sm">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto font-medium text-foreground">{value}</span>
    </div>
  )
}

function Stat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "grass" }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-3 py-4">
      <p className={`text-lg font-semibold tabular-nums ${tone === "grass" ? "text-grass" : "text-foreground"}`}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
