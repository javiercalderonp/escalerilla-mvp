import { describe, expect, it } from "vitest";

import { AVAILABILITY_DAYS, buildSlots } from "../../src/lib/availability";
import {
  onboardingFullSchema,
  onboardingStep1Schema,
  onboardingStep2Schema,
} from "../../src/lib/validation/player";

describe("onboarding schemas", () => {
  const availabilitySlots = AVAILABILITY_DAYS.reduce(
    (acc, { key }) => {
      acc[key] = buildSlots(key, key === "availMonday");
      return acc;
    },
    {} as Record<(typeof AVAILABILITY_DAYS)[number]["key"], boolean[]>,
  );

  it("acepta paso 1 válido y normaliza phone/rut", () => {
    const parsed = onboardingStep1Schema.parse({
      firstName: "javier",
      lastName: "calderon perez",
      gender: "M",
      birthDate: "1990-01-15",
      phone: "912345678",
      rut: "12.345.678-5",
    });

    expect(parsed.firstName).toBe("Javier");
    expect(parsed.lastName).toBe("Calderon Perez");
    expect(parsed.phone).toBe("+56912345678");
    expect(parsed.rut).toBe("12345678-5");
  });

  it("rechaza edad fuera de rango", () => {
    expect(() =>
      onboardingStep1Schema.parse({
        firstName: "Ju",
        lastName: "Perez",
        gender: "M",
        birthDate: "2018-01-01",
        phone: "912345678",
        rut: "12.345.678-5",
      }),
    ).toThrow("Edad debe estar entre 14 y 90");
  });

  it("acepta paso 2 válido", () => {
    const parsed = onboardingStep2Schema.parse({
      level: "intermedio_alto",
      dominantHand: "diestro",
      backhand: "dos_manos",
      yearsPlaying: 12,
    });

    expect(parsed.yearsPlaying).toBe(12);
  });

  it("rechaza yearsPlaying fuera de rango", () => {
    expect(() =>
      onboardingStep2Schema.parse({
        level: "avanzado",
        dominantHand: "zurdo",
        backhand: "una_mano",
        yearsPlaying: 81,
      }),
    ).toThrow();
  });

  it("acepta payload completo", () => {
    const parsed = onboardingFullSchema.parse({
      firstName: "Javier",
      lastName: "Calderon",
      gender: "M",
      birthDate: "1990-01-15",
      phone: "+56912345678",
      rut: "12.345.678-5",
      level: "intermedio_bajo",
      dominantHand: "diestro",
      backhand: "dos_manos",
      yearsPlaying: 5,
      availMonday: true,
      availTuesday: false,
      availWednesday: false,
      availThursday: false,
      availFriday: false,
      availSaturday: false,
      availSunday: false,
      availabilitySlots,
    });

    expect(parsed.level).toBe("intermedio_bajo");
  });
});
