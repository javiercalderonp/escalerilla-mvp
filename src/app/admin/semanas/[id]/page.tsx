import { and, count, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CopyButton } from "@/components/ui/copy-button";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { availability, players, weeks } from "@/lib/db/schema";
import { closeAvailabilityAction, openAvailabilityAction } from "../actions";

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

export default async function AdminSemanaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") redirect("/");

  if (!db) {
    return (
      <div className="p-10 text-center text-sm text-slate-600">
        Base de datos no configurada.
      </div>
    );
  }

  const { id } = await params;

  const [week] = await db
    .select()
    .from(weeks)
    .where(eq(weeks.id, id))
    .limit(1);

  if (!week) notFound();

  const responses = await db
    .select({
      playerId: availability.playerId,
      fullName: players.fullName,
      gender: players.gender,
      playerStatus: players.status,
      monday: availability.monday,
      tuesday: availability.tuesday,
      wednesday: availability.wednesday,
      thursday: availability.thursday,
      friday: availability.friday,
      saturday: availability.saturday,
      sunday: availability.sunday,
      maxMatches: availability.maxMatches,
    })
    .from(availability)
    .innerJoin(players, eq(availability.playerId, players.id))
    .where(eq(availability.weekId, id))
    .orderBy(players.fullName);

  const [totalM] = await db
    .select({ count: count() })
    .from(players)
    .where(and(eq(players.gender, "M"), eq(players.status, "activo")));

  const [totalF] = await db
    .select({ count: count() })
    .from(players)
    .where(and(eq(players.gender, "F"), eq(players.status, "activo")));

  const men = responses.filter((r) => r.gender === "M");
  const women = responses.filter((r) => r.gender === "F");

  const weekLabel = `${formatDate(week.startsOn)}–${formatDate(week.endsOn)}`;
  const reminderMsg = [
    "🎾 *Escalerilla Club La Dehesa*",
    "",
    `Semana ${weekLabel} — recordatorio de disponibilidad.`,
    "",
    "✅ Declará tus días y cuántos partidos podés jugar en:",
    "https://escalerilla-mvp.vercel.app/disponibilidad",
    "",
    "_La ventana cierra pronto. Si no declarás, no entrás al fixture._",
  ].join("\n");

  const statusStyles = {
    borrador: "bg-slate-100 text-slate-700",
    abierta: "bg-emerald-100 text-emerald-800",
    cerrada: "bg-slate-200 text-slate-600",
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5">
        <p className="text-sm font-medium text-emerald-700">Admin › Semanas</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Semana {weekLabel}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[week.status]}`}
          >
            {week.status}
          </span>
          <span className="text-sm text-slate-600">
            {responses.length} respuesta{responses.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
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
          <Link
            href={`/admin/semanas/${week.id}/fixture`}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-950"
          >
            Gestionar fixture →
          </Link>
        </div>
      </section>

      {week.status === "abierta" && (
        <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-emerald-900">
            Mensaje recordatorio para WhatsApp
          </h2>
          <pre className="mt-3 whitespace-pre-wrap text-sm text-emerald-800">
            {reminderMsg}
          </pre>
          <CopyButton text={reminderMsg} />
        </section>
      )}

      {(
        [
          { gender: "M", label: "Hombres", rows: men, total: totalM?.count ?? 0 },
          {
            gender: "F",
            label: "Mujeres",
            rows: women,
            total: totalF?.count ?? 0,
          },
        ] as const
      ).map(({ gender, label, rows, total }) => (
        <section
          key={gender}
          className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="flex items-baseline gap-3">
            <h2 className="text-lg font-semibold text-slate-950">{label}</h2>
            <span className="text-sm text-slate-500">
              {rows.length} de {total} activos declararon
            </span>
          </div>

          {rows.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 px-6 py-8 text-center text-sm text-slate-500">
              Ningún jugador declaró disponibilidad aún.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="pb-3 pr-4 text-left font-medium text-slate-700">
                      Jugador
                    </th>
                    {DAY_LABELS.map((d) => (
                      <th
                        key={d}
                        className="px-2 pb-3 text-center font-medium text-slate-700"
                      >
                        {d}
                      </th>
                    ))}
                    <th className="pb-3 pl-4 text-center font-medium text-slate-700">
                      Máx
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.playerId}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="py-3 pr-4 font-medium text-slate-950">
                        {row.fullName}
                        {row.playerStatus !== "activo" && (
                          <span className="ml-2 text-xs text-slate-400">
                            ({row.playerStatus})
                          </span>
                        )}
                      </td>
                      {DAYS.map((day) => (
                        <td key={day} className="px-2 py-3 text-center">
                          {row[day] ? (
                            <span className="text-emerald-600">✓</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      ))}
                      <td className="py-3 pl-4 text-center font-semibold text-slate-950">
                        {row.maxMatches}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
