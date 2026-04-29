"use server"

import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { players, users } from "@/lib/db/schema"
import { onboardingFullSchema } from "@/lib/validation/player"

export async function submitOnboarding(input: unknown) {
  const session = await auth()

  if (!session?.user?.email) {
    throw new Error("No autenticado")
  }

  if (!db) {
    throw new Error("Base de datos no configurada")
  }

  const data = onboardingFullSchema.parse(input)

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, session.user.email.toLowerCase()))
    .limit(1)

  if (!user) {
    throw new Error("Usuario no existe")
  }

  const fullName = `${data.firstName} ${data.lastName}`.trim()
  const today = new Date().toISOString().slice(0, 10)
  const birthDate = data.birthDate.toISOString().slice(0, 10)

  try {
    if (!user.playerId) {
      const [created] = await db
        .insert(players)
        .values({
          fullName,
          firstName: data.firstName,
          lastName: data.lastName,
          email: session.user.email.toLowerCase(),
          gender: data.gender,
          birthDate,
          phone: data.phone,
          rut: data.rut,
          level: data.level,
          dominantHand: data.dominantHand,
          backhand: data.backhand,
          yearsPlaying: data.yearsPlaying,
          joinedLadderOn: today,
        })
        .returning({ id: players.id })

      await db
        .update(users)
        .set({ playerId: created.id, role: "player" })
        .where(eq(users.id, user.id))
    } else {
      await db
        .update(players)
        .set({
          fullName,
          firstName: data.firstName,
          lastName: data.lastName,
          email: session.user.email.toLowerCase(),
          gender: data.gender,
          birthDate,
          phone: data.phone,
          rut: data.rut,
          level: data.level,
          dominantHand: data.dominantHand,
          backhand: data.backhand,
          yearsPlaying: data.yearsPlaying,
        })
        .where(eq(players.id, user.playerId))

      await db
        .update(users)
        .set({ role: "player" })
        .where(eq(users.id, user.id))
    }
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("players_rut_unique")) {
      return { error: "rut_taken" as const }
    }

    throw error
  }

  revalidatePath("/")
  revalidatePath("/ranking")
  revalidatePath("/mi-perfil")
  redirect("/ranking/hombres")
}
