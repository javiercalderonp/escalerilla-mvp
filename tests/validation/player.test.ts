import { describe, expect, it } from "vitest";

import {
  onboardingFullSchema,
  onboardingStep1Schema,
  onboardingStep2Schema,
} from "../../src/lib/validation/player";

describe("onboarding schemas", () => {
  it("acepta paso 1 válido y normaliza phone/rut", () => {
    const parsed = onboardingStep1Schema.parse({
      firstName: "Javier",
      lastName: "Calderon",
      gender: "M",
      birthDate: "1990-01-15",
      phone: "912345678",
      rut: "12.345.678-5",
    });

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
    });

    expect(parsed.level).toBe("intermedio_bajo");
  });
});
