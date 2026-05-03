import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { requireCompleteProfile } from "@/lib/auth/require-complete-profile";
import { db } from "@/lib/db";
import { availability, players, weeks } from "@/lib/db/schema";
import { upsertAvailabilityAction } from "./actions";

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
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
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
        <div className="rounded-3xl border border-slate-200 bg-white p-8">
          <h1 className="text-2xl font-semibold text-slate-950">
            Mi disponibilidad
          </h1>
          <p className="mt-3 text-sm text-slate-600">
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
        <div className="rounded-3xl border border-slate-200 bg-white p-8">
          <p className="text-sm font-medium text-emerald-700">
            Hola, {player.fullName}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            Mi disponibilidad
          </h1>
          <p className="mt-4 text-sm text-slate-600">
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
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5">
        <p className="text-sm font-medium text-emerald-700">
          Hola, {player.fullName}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
          Disponibilidad — semana {weekLabel}
        </h1>
        {existing && (
          <p className="mt-2 rounded-2xl bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
            Ya declaraste tu disponibilidad. Puedes actualizarla hasta que
            cierre la ventana.
          </p>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <form action={upsertAvailabilityAction} className="space-y-6">
          <input type="hidden" name="weekId" value={openWeek.id} />

          <div>
            <p className="text-sm font-semibold text-slate-950">
              ¿Qué días puedes jugar?
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {DAYS.map(({ key, label }) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 transition hover:border-emerald-400 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50"
                >
                  <input
                    type="checkbox"
                    name={key}
                    value="1"
                    defaultChecked={existing?.[key] ?? false}
                    className="accent-emerald-600"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-semibold text-slate-950">
                ¿Cuántos partidos puedes jugar esta semana?
              </span>
              <select
                name="maxMatches"
                defaultValue={String(existing?.maxMatches ?? 1)}
                className="block w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-500"
              >
                <option value="0">0 — no puedo jugar</option>
                <option value="1">1 partido</option>
                <option value="2">2 partidos</option>
                <option value="3">3 partidos</option>
              </select>
            </label>
          </div>

          <button
            type="submit"
            className="rounded-full bg-emerald-600 px-6 py-3 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            {existing ? "Actualizar disponibilidad" : "Guardar disponibilidad"}
          </button>
        </form>
      </section>
    </main>
  );
}
