"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { PlayerCardModal } from "@/components/players/player-card-modal"
import type { PlayerCardData } from "@/lib/players/get-player-card-data"

export function PlayerCardModalLink({ data }: { data: PlayerCardData | null }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  if (!searchParams.get("player") || !data) {
    return null
  }

  return (
    <PlayerCardModal
      data={data}
      open
      onClose={() => router.replace(pathname, { scroll: false })}
    />
  )
}
