import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { freezes, players, seasons } from "@/lib/db/schema";
import { createFreezeAction } from "./actions";

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

function isActiveFreezeToday(startsOn: string, endsOn: string | null) {
  const today = new Date().toISOString().slice(0, 10);
  return startsOn <= today && (endsOn === null || endsOn >= today);
}

export default async function AdminCongelacionesPage() {
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

  const [activeSeason] = await db
    .select({ id: seasons.id, year: seasons.year })
    .from(seasons)
    .where(eq(seasons.status, "activa"))
    .limit(1);

  const allPlayers = await db
    .select({
      id: players.id,
      fullName: players.fullName,
      gender: players.gender,
    })
    .from(players)
    .where(eq(players.status, "activo"))
    .orderBy(players.gender, players.fullName);

  const allFreezes = activeSeason
    ? await db
        .select({
          id: freezes.id,
          startsOn: freezes.startsOn,
          endsOn: freezes.endsOn,
          reason: freezes.reason,
          playerName: players.fullName,
          playerGender: players.gender,
          createdAt: freezes.createdAt,
        })
        .from(freezes)
        .innerJoin(players, eq(freezes.playerId, players.id))
        .where(eq(freezes.seasonId, activeSeason.id))
        .orderBy(desc(freezes.createdAt))
    : [];

  // Count per player per semester for RN-09 display
  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = parseInt(today.slice(5, 7), 10);
  const currentYear = today.slice(0, 4);
  const semStart =
    currentMonth <= 6 ? `${currentYear}-01-01` : `${currentYear}-07-01`;
  const semEnd =
    currentMonth <= 6 ? `${currentYear}-06-30` : `${currentYear}-12-31`;

  const semesterCountRows = activeSeason
    ? await db
        .select({
          playerId: freezes.playerId,
          count: sql<number>`count(*)`,
        })
        .from(freezes)
        .where(
          and(
            eq(freezes.seasonId, activeSeason.id),
            gte(freezes.startsOn, semStart),
            lte(freezes.startsOn, semEnd),
          ),
        )
        .groupBy(freezes.playerId)
    : [];

  const semesterCountMap = new Map(
    semesterCountRows.map((r) => [r.playerId, Number(r.count)]),
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5">
        <p className="text-sm font-medium text-emerald-700">Admin</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Congelaciones
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          Registrá períodos de exención de penalidad por inactividad (RN-09: máx
          3 por semestre).
          {activeSeason && (
            <span className="ml-2 text-slate-400">
              Temporada {activeSeason.year}
            </span>
          )}
        </p>
      </section>

      <section className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">
            Nueva congelación
          </h2>

          {!activeSeason ? (
            <p className="mt-4 text-sm text-rose-600">
              No hay temporada activa. No se pueden registrar congelaciones.
            </p>
          ) : (
            <form action={createFreezeAction} className="mt-6 space-y-4">
              <label className="block space-y-2 text-sm text-slate-700">
                <span className="font-medium">Jugador</span>
                <select
                  name="playerId"
                  required
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-500"
                >
                  <option value="">— Seleccioná —</option>
                  {allPlayers.map((p) => {
                    const semCount = semesterCountMap.get(p.id) ?? 0;
                    return (
                      <option key={p.id} value={p.id} disabled={semCount >= 3}>
                        {p.fullName} ({p.gender === "M" ? "H" : "M"}){" "}
                        {semCount > 0 ? `· ${semCount}/3 este semestre` : ""}
                        {semCount >= 3 ? " — límite alcanzado" : ""}
                      </option>
                    );
                  })}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-2 text-sm text-slate-700">
                  <span className="font-medium">Desde</span>
                  <input
                    name="startsOn"
                    type="date"
                    required
                    defaultValue={today}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-500"
                  />
                </label>
                <label className="block space-y-2 text-sm text-slate-700">
                  <span className="font-medium">Hasta (opcional)</span>
                  <input
                    name="endsOn"
                    type="date"
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-500"
                  />
                </label>
              </div>

              <label className="block space-y-2 text-sm text-slate-700">
                <span className="font-medium">Motivo</span>
                <textarea
                  name="reason"
                  required
                  rows={3}
                  placeholder="Ej: Lesión de rodilla confirmada por médico"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-500"
                />
              </label>

              <button
                type="submit"
                className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-700"
              >
                Registrar congelación
              </button>
            </form>
          )}
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">
            Historial — temporada {activeSeason?.year ?? "—"}
          </h2>

          {allFreezes.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-500">
              Sin congelaciones registradas.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {allFreezes.map((f) => {
                const active = isActiveFreezeToday(f.startsOn, f.endsOn);
                return (
                  <div
                    key={f.id}
                    className={`rounded-2xl border p-4 ${
                      active
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-slate-950">
                        {f.playerName}
                        <span className="ml-2 text-xs font-normal text-slate-500">
                          {f.playerGender === "M" ? "Hombres" : "Mujeres"}
                        </span>
                      </p>
                      {active && (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
                          activa
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {formatDate(f.startsOn)} →{" "}
                      {f.endsOn ? formatDate(f.endsOn) : "sin fecha fin"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{f.reason}</p>
                  </div>
                );
              })}
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
