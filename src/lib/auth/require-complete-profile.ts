import { eq } from "drizzle-orm"
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { players, users } from "@/lib/db/schema"
import { isProfileComplete } from "@/lib/players/profile-completeness"

export async function requireCompleteProfile() {
  const session = await auth()

  if (!session?.user?.email) {
    redirect("/login")
  }

  if (!db) {
    throw new Error("Base de datos no configurada")
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, session.user.email.toLowerCase()))
    .limit(1)

  if (!user?.playerId) {
    redirect("/onboarding")
  }

  const [player] = await db
    .select()
    .from(players)
    .where(eq(players.id, user.playerId))
    .limit(1)

  if (!isProfileComplete(player)) {
    redirect("/onboarding")
  }

  return { user, player }
}
