import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { players, users } from "@/lib/db/schema";
import { isAdminEmail } from "@/lib/env";

type SessionUserLike = {
  email?: string | null;
  name?: string | null;
  image?: string | null;
};

export async function ensureAppUser(sessionUser: SessionUserLike) {
  if (!db) {
    throw new Error("Base de datos no configurada");
  }

  const email = sessionUser.email?.toLowerCase();

  if (!email) {
    throw new Error("No autenticado");
  }

  const [linkedPlayer] = await db
    .select({ id: players.id })
    .from(players)
    .where(eq(players.email, email))
    .limit(1);

  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const desiredRole = isAdminEmail(email)
    ? "admin"
    : linkedPlayer
      ? "player"
      : "guest";

  if (!existingUser) {
    const [created] = await db
      .insert(users)
      .values({
        email,
        name: sessionUser.name ?? null,
        image: sessionUser.image ?? null,
        playerId: linkedPlayer?.id ?? null,
        role: desiredRole,
      })
      .returning();

    return created;
  }

  if (
    existingUser.playerId !== (linkedPlayer?.id ?? null) ||
    existingUser.role !== desiredRole ||
    existingUser.name !== (sessionUser.name ?? null) ||
    existingUser.image !== (sessionUser.image ?? null)
  ) {
    const [updated] = await db
      .update(users)
      .set({
        playerId: linkedPlayer?.id ?? null,
        role: desiredRole,
        name: sessionUser.name ?? existingUser.name ?? null,
        image: sessionUser.image ?? existingUser.image ?? null,
      })
      .where(eq(users.id, existingUser.id))
      .returning();

    return updated;
  }

  return existingUser;
}
