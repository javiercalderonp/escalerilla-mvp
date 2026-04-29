"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { availability, players, weeks } from "@/lib/db/schema";

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
    .select({ id: players.id })
    .from(players)
    .where(eq(players.email, session.user.email.toLowerCase()))
    .limit(1);

  if (!player) {
    throw new Error("No estás vinculado a ningún jugador");
  }

  const weekId = z.string().uuid().parse(formData.get("weekId"));

  const [week] = await dbClient
    .select({ id: weeks.id })
    .from(weeks)
    .where(and(eq(weeks.id, weekId), eq(weeks.status, "abierta")))
    .limit(1);

  if (!week) {
    throw new Error("La semana ya cerró o no existe");
  }

  const maxMatches = z.coerce
    .number()
    .int()
    .min(0)
    .max(3)
    .parse(formData.get("maxMatches"));

  const payload = {
    weekId: week.id,
    playerId: player.id,
    monday: formData.get("monday") === "1",
    tuesday: formData.get("tuesday") === "1",
    wednesday: formData.get("wednesday") === "1",
    thursday: formData.get("thursday") === "1",
    friday: formData.get("friday") === "1",
    saturday: formData.get("saturday") === "1",
    sunday: formData.get("sunday") === "1",
    maxMatches,
    updatedAt: new Date(),
  };

  await dbClient
    .insert(availability)
    .values(payload)
    .onConflictDoUpdate({
      target: [availability.weekId, availability.playerId],
      set: {
        monday: payload.monday,
        tuesday: payload.tuesday,
        wednesday: payload.wednesday,
        thursday: payload.thursday,
        friday: payload.friday,
        saturday: payload.saturday,
        sunday: payload.sunday,
        maxMatches: payload.maxMatches,
        updatedAt: payload.updatedAt,
      },
    });

  redirect("/disponibilidad");
}
