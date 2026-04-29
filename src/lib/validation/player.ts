import { z } from "zod";

import { phoneSchema } from "./phone";
import { rutSchema } from "./rut";

const NAME_REGEX = /^[A-Za-zÁÉÍÓÚÑáéíóúñ' -]+$/;

export const onboardingStep1Schema = z.object({
  firstName: z.string().min(2).max(60).regex(NAME_REGEX, "Solo letras"),
  lastName: z.string().min(2).max(60).regex(NAME_REGEX, "Solo letras"),
  gender: z.enum(["M", "F"]),
  birthDate: z.coerce.date().refine((date) => {
    const age = (Date.now() - date.getTime()) / 31_557_600_000;
    return age >= 14 && age <= 90;
  }, "Edad debe estar entre 14 y 90"),
  phone: phoneSchema,
  rut: rutSchema,
});

export const onboardingStep2Schema = z.object({
  level: z.enum([
    "principiante",
    "intermedio_bajo",
    "intermedio_alto",
    "avanzado",
  ]),
  dominantHand: z.enum(["diestro", "zurdo"]),
  backhand: z.enum(["una_mano", "dos_manos"]),
  yearsPlaying: z.coerce.number().int().min(0).max(80),
});

export const onboardingFullSchema = onboardingStep1Schema.merge(
  onboardingStep2Schema,
);

export type OnboardingStep1 = z.infer<typeof onboardingStep1Schema>;
export type OnboardingStep2 = z.infer<typeof onboardingStep2Schema>;
export type OnboardingFull = z.infer<typeof onboardingFullSchema>;
