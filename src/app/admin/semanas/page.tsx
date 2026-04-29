import Link from "next/link";
import { desc } from "drizzle-orm";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { weeks } from "@/lib/db/schema";
import {
  closeAvailabilityAction,
  createWeekAction,
  openAvailabilityAction,
} from "./actions";

function statusBadge(status: "borrador" | "abierta" | "cerrada") {
  const styles = {
    borrador: "bg-slate-100 text-slate-700",
    abierta: "bg-emerald-100 text-emerald-800",
    cerrada: "bg-slate-200 text-slate-600",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${styles[status]}`}
    >
      {status}
    </span>
  );
}

function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

function nextMonday(): string {
  const today = new Date();
  const day = today.getDay();
  const daysUntil = day === 0 ? 1 : 8 - day;
  const d = new Date(today);
  d.setDate(today.getDate() + daysUntil);
  return d.toISOString().slice(0, 10);
}

export default async function AdminSemanasPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") redirect("/");

  const rows = db
    ? await db.select().from(weeks).orderBy(desc(weeks.startsOn))
    : [];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5">
        <p className="text-sm font-medium text-emerald-700">Admin</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Semanas
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Abrí la ventana para que los jugadores declaren disponibilidad.
          Cerrála antes de generar el fixture.
        </p>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Nueva semana</h2>
        <p className="mt-1 text-sm text-slate-600">
          El sistema calcula el fin de semana automáticamente (+6 días).
        </p>
        <form
          action={createWeekAction}
          className="mt-4 flex flex-wrap items-end gap-4"
        >
          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-medium">Fecha de inicio</span>
            <input
              name="startsOn"
              type="date"
              defaultValue={nextMonday()}
              required
              className="block rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-500"
            />
          </label>
          <button
            type="submit"
            className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            Crear semana
          </button>
        </form>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Historial</h2>

        {rows.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-500">
            No hay semanas creadas aún.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {rows.map((week) => (
              <div
                key={week.id}
                className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-slate-950">
                    {formatDate(week.startsOn)} — {formatDate(week.endsOn)}
                  </span>
                  {statusBadge(week.status)}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/admin/semanas/${week.id}`}
                    className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 transition hover:border-slate-400"
                  >
                    Ver disponibilidad
                  </Link>

                  {week.status === "borrador" && (
                    <form action={openAvailabilityAction}>
                      <input type="hidden" name="weekId" value={week.id} />
                      <button
                        type="submit"
                        className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
                      >
                        Abrir disponibilidad
                      </button>
                    </form>
                  )}

                  {week.status === "abierta" && (
                    <form action={closeAvailabilityAction}>
                      <input type="hidden" name="weekId" value={week.id} />
                      <button
                        type="submit"
                        className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                      >
                        Cerrar disponibilidad
                      </button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
