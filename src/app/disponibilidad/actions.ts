"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { normalizeAvailabilitySlots } from "@/lib/availability";
import { db } from "@/lib/db";
import { DEFAULT_VISIBILITY, players } from "@/lib/db/schema";

const dayBool = z.preprocess((v) => v === "1", z.boolean());

const availabilitySchema = z.object({
  availMonday: dayBool,
  availTuesday: dayBool,
  availWednesday: dayBool,
  availThursday: dayBool,
  availFriday: dayBool,
  availSaturday: dayBool,
  availSunday: dayBool,
  availabilitySlots: z.string().transform((value, ctx) => {
    try {
      const slots = normalizeAvailabilitySlots(JSON.parse(value));
      if (slots) return slots;
    } catch {
      // handled below with a custom issue
    }

    ctx.addIssue({
      code: "custom",
      message: "Disponibilidad inválida",
    });
    return z.NEVER;
  }),
});

export async function upsertAvailabilityAction(formData: FormData) {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  const dbClient = db;
  if (!dbClient) {
    throw new Error("Base de datos no configurada");
  }

  const [player] = await dbClient
    .select({ id: players.id, visibility: players.visibility })
    .from(players)
    .where(eq(players.email, session.user.email.toLowerCase()))
    .limit(1);

  if (!player) {
    throw new Error("No estás vinculado a ningún jugador");
  }

  const data = availabilitySchema.parse({
    availMonday: formData.get("availMonday"),
    availTuesday: formData.get("availTuesday"),
    availWednesday: formData.get("availWednesday"),
    availThursday: formData.get("availThursday"),
    availFriday: formData.get("availFriday"),
    availSaturday: formData.get("availSaturday"),
    availSunday: formData.get("availSunday"),
    availabilitySlots: formData.get("availabilitySlots"),
  });

  await dbClient
    .update(players)
    .set({
      availMonday: data.availMonday,
      availTuesday: data.availTuesday,
      availWednesday: data.availWednesday,
      availThursday: data.availThursday,
      availFriday: data.availFriday,
      availSaturday: data.availSaturday,
      availSunday: data.availSunday,
      visibility: {
        ...DEFAULT_VISIBILITY,
        ...player.visibility,
        availabilitySlots: data.availabilitySlots,
      },
      updatedAt: new Date(),
    })
    .where(eq(players.id, player.id));

  redirect("/disponibilidad");
}
