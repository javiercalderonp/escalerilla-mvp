const REQUIRED_FIELDS = [
  "firstName",
  "lastName",
  "birthDate",
  "phone",
  "rut",
  "level",
  "dominantHand",
  "backhand",
  "yearsPlaying",
  "joinedLadderOn",
] as const

type PlayerProfileShape = Record<(typeof REQUIRED_FIELDS)[number], unknown> | null | undefined

export function isProfileComplete(player: PlayerProfileShape): boolean {
  if (!player) {
    return false
  }

  return REQUIRED_FIELDS.every((field) => {
    const value = player[field]
    return value !== null && value !== undefined && value !== ""
  })
}
