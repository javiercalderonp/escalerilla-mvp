import { describe, expect, it } from "vitest"

import { isProfileComplete } from "../../src/lib/players/profile-completeness"

describe("isProfileComplete", () => {
  it("returns false for null", () => {
    expect(isProfileComplete(null)).toBe(false)
  })

  it("returns false when a required field is missing", () => {
    expect(
      isProfileComplete({
        firstName: null,
        lastName: "Calderon",
        birthDate: "1990-01-01",
        phone: "+56912345678",
        rut: "12345678-5",
        level: "intermedio_bajo",
        dominantHand: "diestro",
        backhand: "dos_manos",
        yearsPlaying: 8,
        joinedLadderOn: "2026-04-29",
      })
    ).toBe(false)
  })

  it("returns true when all required fields are present", () => {
    expect(
      isProfileComplete({
        firstName: "Javier",
        lastName: "Calderon",
        birthDate: "1990-01-01",
        phone: "+56912345678",
        rut: "12345678-5",
        level: "intermedio_bajo",
        dominantHand: "diestro",
        backhand: "dos_manos",
        yearsPlaying: 8,
        joinedLadderOn: "2026-04-29",
      })
    ).toBe(true)
  })
})
