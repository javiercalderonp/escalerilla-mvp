import { asc } from "drizzle-orm";
import { redirect } from "next/navigation";

import {
  createPlayerAction,
  importPlayersCsvAction,
  toggleRetiredPlayerAction,
  updatePlayerAction,
} from "@/app/admin/jugadores/actions";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { players } from "@/lib/db/schema";

async function getPlayers() {
  if (!db) {
    return [];
  }

  return db
    .select()
    .from(players)
    .orderBy(asc(players.gender), asc(players.fullName));
}

function statusBadge(status: "activo" | "congelado" | "retirado") {
  const variants = {
    activo: "success",
    congelado: "warning",
    retirado: "muted",
  } as const;

  return <Badge variant={variants[status]}>{status}</Badge>;
}

function levelBadge(level: string | null) {
  if (!level) {
    return <span className="text-sm text-slate-400">—</span>;
  }

  return <Badge variant="court">{level.replaceAll("_", " ")}</Badge>;
}

const csvExample = `full_name,email,gender,initial_points,notes
Juan Pérez López,juan@gmail.com,M,420,Ranking 2025: 3º
Pedro García,,M,380,
María Torres,maria.t@gmail.com,F,310,Ranking 2025: 1º femenino`;

export default async function AdminPlayersPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "admin") {
    redirect("/");
  }

  const rows = await getPlayers();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-700">Admin</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              Jugadores
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Alta manual, import CSV, edición rápida y retiro lógico de
              jugadores.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {rows.length} jugadores cargados
          </div>
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">
            Importar seed CSV
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Carga masiva inicial con columnas{" "}
            <code>full_name, email, gender, initial_points, notes</code>. Si una
            fila falla, se aborta todo.
          </p>

          <form action={importPlayersCsvAction} className="mt-6 space-y-4">
            <label className="block space-y-2 text-sm text-slate-700">
              <span className="font-medium">Archivo CSV</span>
              <input
                name="csvFile"
                type="file"
                accept=".csv,text/csv"
                required
                className="block w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm file:mr-4 file:rounded-full file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:font-medium file:text-emerald-700"
              />
            </label>

            <button
              type="submit"
              className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              Importar CSV
            </button>
          </form>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">
              Ejemplo esperado
            </p>
            <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
              {csvExample}
            </pre>
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">
            Crear jugador manual
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Útil para ajustes puntuales o altas individuales.
          </p>

          <form action={createPlayerAction} className="mt-6 space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="fullName"
                className="text-sm font-medium text-slate-700"
              >
                Nombre completo
              </label>
              <input
                id="fullName"
                name="fullName"
                required
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-500"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="text-sm font-medium text-slate-700"
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-500"
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="gender"
                  className="text-sm font-medium text-slate-700"
                >
                  Categoría
                </label>
                <select
                  id="gender"
                  name="gender"
                  defaultValue="M"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-500"
                >
                  <option value="M">Hombres</option>
                  <option value="F">Mujeres</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <label
                  htmlFor="initialPoints"
                  className="text-sm font-medium text-slate-700"
                >
                  Puntos iniciales
                </label>
                <input
                  id="initialPoints"
                  name="initialPoints"
                  type="number"
                  min={0}
                  defaultValue={0}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-500"
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="level"
                  className="text-sm font-medium text-slate-700"
                >
                  Nivel
                </label>
                <select
                  id="level"
                  name="level"
                  defaultValue=""
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-500"
                >
                  <option value="">Sin definir</option>
                  <option value="principiante">Principiante</option>
                  <option value="intermedio_bajo">Intermedio bajo</option>
                  <option value="intermedio_alto">Intermedio alto</option>
                  <option value="avanzado">Avanzado</option>
                </select>
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="status"
                  className="text-sm font-medium text-slate-700"
                >
                  Estado
                </label>
                <select
                  id="status"
                  name="status"
                  defaultValue="activo"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-500"
                >
                  <option value="activo">Activo</option>
                  <option value="congelado">Congelado</option>
                  <option value="retirado">Retirado</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="notes"
                className="text-sm font-medium text-slate-700"
              >
                Notas
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={4}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              className="rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Guardar jugador
            </button>
          </form>
        </article>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Plantel actual
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Puedes ajustar nombre, email, categoría, nivel, estado, puntos base y
              notas.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-500">
              Aún no hay jugadores cargados en la base.
            </div>
          ) : (
            rows.map((player) => (
              <form
                key={player.id}
                action={updatePlayerAction}
                className="rounded-2xl border border-slate-200 p-4"
              >
                <input type="hidden" name="playerId" value={player.id} />

                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-semibold text-slate-950">
                      {player.fullName}
                    </h3>
                    {statusBadge(player.status)}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>{player.gender === "M" ? "Hombres" : "Mujeres"}</span>
                    {levelBadge(player.level)}
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm text-slate-700">
                    <span className="font-medium">Nombre completo</span>
                    <input
                      name="fullName"
                      defaultValue={player.fullName}
                      required
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-500"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-slate-700">
                    <span className="font-medium">Email</span>
                    <input
                      name="email"
                      type="email"
                      defaultValue={player.email ?? ""}
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-500"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-slate-700">
                    <span className="font-medium">Categoría</span>
                    <select
                      name="gender"
                      defaultValue={player.gender}
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-500"
                    >
                      <option value="M">Hombres</option>
                      <option value="F">Mujeres</option>
                    </select>
                  </label>
                  <label className="space-y-2 text-sm text-slate-700">
                    <span className="font-medium">Estado</span>
                    <select
                      name="status"
                      defaultValue={player.status}
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-500"
                    >
                      <option value="activo">Activo</option>
                      <option value="congelado">Congelado</option>
                      <option value="retirado">Retirado</option>
                    </select>
                  </label>
                  <label className="space-y-2 text-sm text-slate-700">
                    <span className="font-medium">Puntos iniciales</span>
                    <input
                      name="initialPoints"
                      type="number"
                      min={0}
                      defaultValue={player.initialPoints}
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-500"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-slate-700">
                    <span className="font-medium">Nivel</span>
                    <select
                      name="level"
                      defaultValue={player.level ?? ""}
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-500"
                    >
                      <option value="">Sin definir</option>
                      <option value="principiante">Principiante</option>
                      <option value="intermedio_bajo">Intermedio bajo</option>
                      <option value="intermedio_alto">Intermedio alto</option>
                      <option value="avanzado">Avanzado</option>
                    </select>
                  </label>
                  <label className="space-y-2 text-sm text-slate-700 md:col-span-2">
                    <span className="font-medium">Notas</span>
                    <textarea
                      name="notes"
                      rows={3}
                      defaultValue={player.notes ?? ""}
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-500"
                    />
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="submit"
                    className="rounded-full bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                  >
                    Guardar cambios
                  </button>
                </div>
              </form>
            ))
          )}
        </div>

        {rows.length > 0 ? (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Retiro rápido
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Marca retirado o reactiva sin tocar el resto de los datos.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {rows.map((player) => {
                const nextStatus =
                  player.status === "retirado" ? "activo" : "retirado";
                const label =
                  player.status === "retirado"
                    ? `Reactivar ${player.fullName}`
                    : `Retirar ${player.fullName}`;

                return (
                  <form
                    key={`${player.id}-toggle`}
                    action={toggleRetiredPlayerAction}
                  >
                    <input type="hidden" name="playerId" value={player.id} />
                    <input type="hidden" name="nextStatus" value={nextStatus} />
                    <button
                      type="submit"
                      className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 transition hover:border-slate-400 hover:text-slate-950"
                    >
                      {label}
                    </button>
                  </form>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
