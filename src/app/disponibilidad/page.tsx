import { and, eq } from "drizzle-orm";
import { CalendarDays } from "lucide-react";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { requireCompleteProfile } from "@/lib/auth/require-complete-profile";
import { db } from "@/lib/db";
import { availability, players, weeks } from "@/lib/db/schema";
import { AvailabilityForm } from "./availability-form";

const DAYS = [
  { key: "monday", label: "Lunes" },
  { key: "tuesday", label: "Martes" },
  { key: "wednesday", label: "Miércoles" },
  { key: "thursday", label: "Jueves" },
  { key: "friday", label: "Viernes" },
  { key: "saturday", label: "Sábado" },
  { key: "sunday", label: "Domingo" },
] as const;

function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

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
      status: players.status,
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
            Tu cuenta ({userEmail}) no está vinculada a ningún jugador. Pide al
            administrador que te agregue con este email.
          </p>
        </div>
      </main>
    );
  }

  const [openWeek] = await db
    .select()
    .from(weeks)
    .where(eq(weeks.status, "abierta"))
    .limit(1);

  if (!openWeek) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
        <div className="rounded-3xl border border-border bg-card p-8 shadow-sm">
          <p className="text-sm font-medium text-clay">
            Hola, {player.fullName}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            Mi disponibilidad
          </h1>
          <p className="mt-4 text-sm text-muted-foreground">
            No hay ninguna semana abierta en este momento. Volvé cuando el
            administrador abra la próxima ventana de disponibilidad.
          </p>
        </div>
      </main>
    );
  }

  const [existing] = await db
    .select()
    .from(availability)
    .where(
      and(
        eq(availability.weekId, openWeek.id),
        eq(availability.playerId, player.id),
      ),
    )
    .limit(1);

  const weekLabel = `${formatDate(openWeek.startsOn)}–${formatDate(openWeek.endsOn)}`;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-8 sm:px-6 lg:py-10">
      <section className="rounded-3xl bg-card p-6 shadow-xl shadow-court/5 ring-1 ring-court/10 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-5">
            <div className="inline-flex size-16 shrink-0 items-center justify-center rounded-2xl bg-court/10 text-court">
              <CalendarDays className="size-8" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium text-clay">
                Hola, {player.fullName}
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
                Mi disponibilidad semanal
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                Semana {weekLabel}. Define los días en que normalmente puedes
                jugar; luego podrás actualizarlo mientras la ventana siga
                abierta.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 overflow-hidden rounded-lg border border-border bg-card text-sm font-medium shadow-sm sm:grid-cols-3">
            <div className="inline-flex items-center justify-center gap-2 border-b border-border bg-court px-5 py-3 text-court-foreground sm:border-b-0 sm:border-r">
              <CalendarDays className="size-4" aria-hidden="true" />
              Semana abierta
            </div>
            <div className="inline-flex items-center justify-center gap-2 border-b border-border px-5 py-3 text-muted-foreground sm:border-b-0 sm:border-r">
              <CalendarDays className="size-4" aria-hidden="true" />
              Esta semana
            </div>
            <div className="inline-flex items-center justify-center gap-2 px-5 py-3 text-muted-foreground">
              <CalendarDays className="size-4" aria-hidden="true" />
              Próxima semana
            </div>
          </div>
        </div>

        {existing && (
          <p className="mt-6 rounded-lg border border-grass/30 bg-grass/10 px-4 py-3 text-sm font-medium text-grass">
            Ya declaraste tu disponibilidad. Puedes actualizarla hasta que
            cierre la ventana.
          </p>
        )}

        <div className="mt-6">
          <AvailabilityForm
            weekId={openWeek.id}
            existing={
              existing
                ? DAYS.reduce(
                    (acc, { key }) => {
                      acc[key] = existing[key];
                      return acc;
                    },
                    { maxMatches: existing.maxMatches } as {
                      maxMatches: number;
                    } & Record<(typeof DAYS)[number]["key"], boolean>,
                  )
                : null
            }
          />
        </div>
      </section>
    </main>
  );
}
