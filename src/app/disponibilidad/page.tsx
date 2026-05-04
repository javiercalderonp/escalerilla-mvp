import { eq } from "drizzle-orm";
import { CalendarDays } from "lucide-react";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { requireCompleteProfile } from "@/lib/auth/require-complete-profile";
import { db } from "@/lib/db";
import { players } from "@/lib/db/schema";
import { AvailabilityForm } from "./availability-form";

export default async function DisponibilidadPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await requireCompleteProfile();
  const userEmail = session.user.email;
  if (!userEmail) redirect("/login");

  if (!db) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
        <div className="rounded-3xl border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
          Base de datos no configurada.
        </div>
      </main>
    );
  }

  const [player] = await db
    .select({
      id: players.id,
      fullName: players.fullName,
      availMonday: players.availMonday,
      availTuesday: players.availTuesday,
      availWednesday: players.availWednesday,
      availThursday: players.availThursday,
      availFriday: players.availFriday,
      availSaturday: players.availSaturday,
      availSunday: players.availSunday,
    })
    .from(players)
    .where(eq(players.email, userEmail.toLowerCase()))
    .limit(1);

  if (!player) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
        <div className="rounded-3xl border border-border bg-card p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-foreground">
            Mi disponibilidad
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Tu cuenta ({userEmail}) no está vinculada a ningún jugador.
          </p>
        </div>
      </main>
    );
  }

  const hasAvailability =
    player.availMonday !== null ||
    player.availTuesday !== null ||
    player.availWednesday !== null ||
    player.availThursday !== null ||
    player.availFriday !== null ||
    player.availSaturday !== null ||
    player.availSunday !== null;

  const existing = hasAvailability
    ? {
        availMonday: player.availMonday ?? false,
        availTuesday: player.availTuesday ?? false,
        availWednesday: player.availWednesday ?? false,
        availThursday: player.availThursday ?? false,
        availFriday: player.availFriday ?? false,
        availSaturday: player.availSaturday ?? false,
        availSunday: player.availSunday ?? false,
      }
    : null;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-3 py-5 sm:px-6 lg:py-9">
      <section className="rounded-3xl border border-white/70 bg-card/95 p-5 shadow-2xl shadow-court/10 ring-1 ring-border/70 sm:p-7 lg:p-9">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-5">
            <div className="inline-flex size-16 shrink-0 items-center justify-center rounded-2xl bg-grass/10 text-grass ring-1 ring-grass/10">
              <CalendarDays className="size-8" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium text-grass">
                {player.fullName}
              </p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
                Mi disponibilidad semanal
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                Define los horarios en que normalmente puedes jugar. Luego el
                club podrá usarlos para coordinar tus partidos.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <AvailabilityForm existing={existing} />
        </div>
      </section>
    </main>
  );
}
