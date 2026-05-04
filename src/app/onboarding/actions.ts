"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { ensureAppUser } from "@/lib/auth/ensure-app-user";
import { db } from "@/lib/db";
import { players, users } from "@/lib/db/schema";
import { isAdminEmail } from "@/lib/env";
import { onboardingFullSchema } from "@/lib/validation/player";

type ExistingPlayerCandidate = {
  id: string;
  fullName: string;
  rut: string | null;
};

function normalizeProfileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export async function submitOnboarding(input: unknown) {
  const session = await auth();

  if (!session?.user?.email) {
    throw new Error("No autenticado");
  }

  if (!db) {
    throw new Error("Base de datos no configurada");
  }

  const email = session.user.email.toLowerCase();
  const data = onboardingFullSchema.parse(input);

  const user = await ensureAppUser(session.user);

  const fullName = `${data.firstName} ${data.lastName}`.trim();
  const today = new Date().toISOString().slice(0, 10);
  const birthDate = data.birthDate.toISOString().slice(0, 10);

  try {
    if (!user.playerId) {
      const [playerByRut] = await db
        .select({
          id: players.id,
          fullName: players.fullName,
          rut: players.rut,
        })
        .from(players)
        .where(eq(players.rut, data.rut))
        .limit(1);

      let existingPlayer: ExistingPlayerCandidate | undefined = playerByRut;

      if (!existingPlayer) {
        const sameGenderPlayers = await db
          .select({
            id: players.id,
            fullName: players.fullName,
            rut: players.rut,
          })
          .from(players)
          .where(eq(players.gender, data.gender));

        const normalizedFullName = normalizeProfileName(fullName);
        const nameMatches = sameGenderPlayers.filter(
          (player) =>
            !player.rut &&
            normalizeProfileName(player.fullName) === normalizedFullName,
        );

        if (nameMatches.length === 1) {
          existingPlayer = nameMatches[0];
        }
      }

      if (existingPlayer) {
        const [linkedUser] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.playerId, existingPlayer.id))
          .limit(1);

        if (linkedUser && linkedUser.id !== user.id) {
          return { error: "player_already_linked" as const };
        }

        await db
          .update(players)
          .set({
            fullName,
            firstName: data.firstName,
            lastName: data.lastName,
            email,
            gender: data.gender,
            birthDate,
            phone: data.phone,
            rut: data.rut,
            level: data.level,
            dominantHand: data.dominantHand,
            backhand: data.backhand,
            yearsPlaying: data.yearsPlaying,
            availMonday: data.availMonday,
            availTuesday: data.availTuesday,
            availWednesday: data.availWednesday,
            availThursday: data.availThursday,
            availFriday: data.availFriday,
            availSaturday: data.availSaturday,
            availSunday: data.availSunday,
          })
          .where(eq(players.id, existingPlayer.id));

        await db
          .update(users)
          .set({
            playerId: existingPlayer.id,
            role: isAdminEmail(email) ? "admin" : "player",
          })
          .where(eq(users.id, user.id));
      } else {
        const [created] = await db
          .insert(players)
          .values({
            fullName,
            firstName: data.firstName,
            lastName: data.lastName,
            email,
            gender: data.gender,
            birthDate,
            phone: data.phone,
            rut: data.rut,
            level: data.level,
            dominantHand: data.dominantHand,
            backhand: data.backhand,
            yearsPlaying: data.yearsPlaying,
            joinedLadderOn: today,
            availMonday: data.availMonday,
            availTuesday: data.availTuesday,
            availWednesday: data.availWednesday,
            availThursday: data.availThursday,
            availFriday: data.availFriday,
            availSaturday: data.availSaturday,
            availSunday: data.availSunday,
          })
          .returning({ id: players.id });

        await db
          .update(users)
          .set({
            playerId: created.id,
            role: isAdminEmail(email) ? "admin" : "player",
          })
          .where(eq(users.id, user.id));
      }
    } else {
      await db
        .update(players)
        .set({
          fullName,
          firstName: data.firstName,
          lastName: data.lastName,
          email,
          gender: data.gender,
          birthDate,
          phone: data.phone,
          rut: data.rut,
          level: data.level,
          dominantHand: data.dominantHand,
          backhand: data.backhand,
          yearsPlaying: data.yearsPlaying,
          availMonday: data.availMonday,
          availTuesday: data.availTuesday,
          availWednesday: data.availWednesday,
          availThursday: data.availThursday,
          availFriday: data.availFriday,
          availSaturday: data.availSaturday,
          availSunday: data.availSunday,
        })
        .where(eq(players.id, user.playerId));

      await db
        .update(users)
        .set({ role: isAdminEmail(email) ? "admin" : "player" })
        .where(eq(users.id, user.id));
    }
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.message.includes("players_rut_unique")
    ) {
      return { error: "rut_taken" as const };
    }

    return {
      error: "unexpected" as const,
      message:
        error instanceof Error
          ? error.message
          : "No se pudo guardar tu perfil.",
    };
  }

  revalidatePath("/");
  revalidatePath("/ranking");
  revalidatePath("/mi-perfil");
  redirect("/ranking/hombres");
}
