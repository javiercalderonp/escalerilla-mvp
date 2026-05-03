import { count, desc, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { availability, matches, players, weeks } from "@/lib/db/schema";
import {
  closeAvailabilityAction,
  createWeekAction,
  openAvailabilityAction,
} from "./actions";
import { DeleteWeekButton } from "./delete-week-button";

type WeekRow = typeof weeks.$inferSelect;

function statusBadge(status: WeekRow["status"]) {
  const styles = {
    borrador: "bg-slate-100 text-slate-700",
    abierta: "bg-emerald-100 text-emerald-800",
    cerrada: "bg-slate-200 text-slate-600",
  };
  const labels = {
    borrador: "Borrador",
    abierta: "Disponibilidad abierta",
    cerrada: "Cerrada",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${styles[status]}`}
    >
      {labels[status]}
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

function getWeekLabel(week: WeekRow) {
  return `${formatDate(week.startsOn)} — ${formatDate(week.endsOn)}`;
}

function getFocusWeek(rows: WeekRow[]) {
  return (
    rows.find((week) => week.status === "abierta") ??
    rows.find((week) => week.status === "borrador") ??
    rows[0] ??
    null
  );
}

function getNextAction(week: WeekRow, matchCount: number) {
  if (week.status === "borrador") {
    return {
      title: "Prepara la lista de jugadores",
      body: "Agrega jugadores manualmente o abre la disponibilidad cuando quieras pedir respuestas.",
      href: `/admin/semanas/${week.id}`,
      label: "Revisar jugadores",
    };
  }

  if (week.status === "abierta") {
    return {
      title: "Revisa respuestas y cierra la ventana",
      body: "Cuando tengas suficientes respuestas, cierra disponibilidad y pasa a armar los cruces.",
      href: `/admin/semanas/${week.id}`,
      label: "Ver disponibilidad",
    };
  }

  return {
    title: matchCount > 0 ? "Programación publicada" : "Arma los cruces",
    body:
      matchCount > 0
        ? "Los partidos de esta semana ya están creados. Puedes republicar si necesitas ajustar algo."
        : "La disponibilidad ya está cerrada. El siguiente paso es generar y publicar los partidos.",
    href: `/admin/semanas/${week.id}/fixture`,
    label: matchCount > 0 ? "Editar programación" : "Armar cruces",
  };
}

export default async function AdminSemanasPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") redirect("/");

  const rows = db
    ? await db.select().from(weeks).orderBy(desc(weeks.startsOn))
    : [];
  const focusWeek = getFocusWeek(rows);
  const historyRows = focusWeek
    ? rows.filter((week) => week.id !== focusWeek.id)
    : rows;

  const responseRows =
    db && rows.length > 0
      ? await db
          .select({
            weekId: availability.weekId,
            value: count(),
          })
          .from(availability)
          .groupBy(availability.weekId)
      : [];
  const responseCounts = new Map(
    responseRows.map((row) => [row.weekId, row.value]),
  );

  const focusMatches =
    db && focusWeek
      ? await db
          .select({
            id: matches.id,
            category: matches.category,
            status: matches.status,
            player1Name: players.fullName,
            player2Name: sql<string>`players_p2.full_name`,
          })
          .from(matches)
          .innerJoin(players, eq(matches.player1Id, players.id))
          .innerJoin(
            sql`players as players_p2`,
            sql`${matches.player2Id} = players_p2.id`,
          )
          .where(eq(matches.weekId, focusWeek.id))
          .orderBy(matches.category, players.fullName)
      : [];
  const nextAction = focusWeek
    ? getNextAction(focusWeek, focusMatches.length)
    : null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <section className="rounded-lg bg-white p-8 shadow-sm ring-1 ring-black/5">
        <p className="text-sm font-medium text-emerald-700">Admin</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Programación
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Opera la semana activa desde un solo lugar. El historial queda abajo,
          cerrado, para que no distraiga cuando toca crear la programación.
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Semana en curso
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
              {focusWeek ? getWeekLabel(focusWeek) : "Sin programación activa"}
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {focusWeek ? statusBadge(focusWeek.status) : null}
              {focusWeek ? (
                <span className="text-sm text-slate-600">
                  {responseCounts.get(focusWeek.id) ?? 0} jugador
                  {(responseCounts.get(focusWeek.id) ?? 0) !== 1 ? "es" : ""} en
                  disponibilidad
                </span>
              ) : (
                <span className="text-sm text-slate-600">
                  Crea la próxima semana para empezar.
                </span>
              )}
            </div>
          </div>

          <form
            action={createWeekAction}
            className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4"
          >
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Nueva programación</span>
              <input
                name="startsOn"
                type="date"
                defaultValue={nextMonday()}
                required
                className="block rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-emerald-500"
              />
            </label>
            <button
              type="submit"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              Crear
            </button>
          </form>
        </div>

        {focusWeek && nextAction ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)]">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
              <h3 className="text-lg font-semibold text-emerald-950">
                {nextAction.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-emerald-900">
                {nextAction.body}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={nextAction.href}
                  className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  {nextAction.label}
                </Link>
                <Link
                  href={`/admin/semanas/${focusWeek.id}/fixture`}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400"
                >
                  Cruces
                </Link>
                {focusWeek.status === "borrador" && (
                  <form action={openAvailabilityAction}>
                    <input type="hidden" name="weekId" value={focusWeek.id} />
                    <button
                      type="submit"
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
                    >
                      Abrir disponibilidad
                    </button>
                  </form>
                )}
                {focusWeek.status === "abierta" && (
                  <form action={closeAvailabilityAction}>
                    <input type="hidden" name="weekId" value={focusWeek.id} />
                    <button
                      type="submit"
                      className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                    >
                      Cerrar disponibilidad
                    </button>
                  </form>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-5">
              <p className="text-sm font-semibold text-slate-950">
                Partidos de esta semana
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {focusMatches.length} partido
                {focusMatches.length !== 1 ? "s" : ""} creado
                {focusMatches.length !== 1 ? "s" : ""}
              </p>

              {focusMatches.length === 0 ? (
                <div className="mt-4 rounded-lg border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
                  Todavía no hay partidos publicados para esta semana.
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  {focusMatches.map((match) => (
                    <div
                      key={match.id}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-slate-950">
                          {match.player1Name} vs {match.player2Name}
                        </span>
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          {match.category}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Estado: {match.status}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </section>

      <details className="group rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Historial de programaciones
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Ver semanas anteriores y acciones secundarias.
            </p>
          </div>
          <span className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition group-open:bg-slate-100">
            Abrir
          </span>
        </summary>

        {historyRows.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-500">
            No hay programaciones creadas aún.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {historyRows.map((week) => (
              <div
                key={week.id}
                className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-semibold text-slate-950">
                    {getWeekLabel(week)}
                  </span>
                  {statusBadge(week.status)}
                  <span className="text-sm text-slate-500">
                    {responseCounts.get(week.id) ?? 0} jugador
                    {(responseCounts.get(week.id) ?? 0) !== 1 ? "es" : ""}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/admin/semanas/${week.id}`}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 transition hover:border-slate-400"
                  >
                    Ver disponibilidad
                  </Link>
                  <Link
                    href={`/admin/semanas/${week.id}/fixture`}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 transition hover:border-slate-400"
                  >
                    Ver cruces
                  </Link>

                  {week.status === "borrador" && (
                    <form action={openAvailabilityAction}>
                      <input type="hidden" name="weekId" value={week.id} />
                      <button
                        type="submit"
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
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
                        className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                      >
                        Cerrar disponibilidad
                      </button>
                    </form>
                  )}

                  <DeleteWeekButton
                    weekId={week.id}
                    weekLabel={getWeekLabel(week)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </details>
    </div>
  );
}
