import { eq } from "drizzle-orm"
import { redirect } from "next/navigation"

import { OnboardingWizard } from "@/app/onboarding/onboarding-wizard"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { players, users } from "@/lib/db/schema"
import { isProfileComplete } from "@/lib/players/profile-completeness"

export default async function OnboardingPage() {
  const session = await auth()

  if (!session?.user?.email) {
    redirect("/login")
  }

  if (!db) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <div className="w-full rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5">
          Base de datos no configurada.
        </div>
      </div>
    )
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, session.user.email.toLowerCase()))
    .limit(1)

  if (user?.playerId) {
    const [player] = await db
      .select()
      .from(players)
      .where(eq(players.id, user.playerId))
      .limit(1)

    if (isProfileComplete(player)) {
      redirect("/ranking/hombres")
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <div className="w-full space-y-6">
        <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5">
          <p className="text-sm font-medium text-court">Bienvenido a la escalerilla</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            Completa tu perfil antes de entrar
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Necesitamos tus datos básicos y tu perfil tenístico para habilitar ranking,
            fixture y disponibilidad.
          </p>
        </section>

        <OnboardingWizard />
      </div>
    </div>
  )
}
