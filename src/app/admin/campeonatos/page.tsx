import { and, desc, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { players, rankingEvents } from "@/lib/db/schema";
import {
  createChampionshipAction,
  getChampionshipsWithPlacements,
} from "./actions";

const typeLabels: Record<string, string> = {
  regular: "Regular",
  clausura: "Clausura",
  especial: "Especial",
};

const positionLabels: Record<number, string> = {
  1: "🥇 Campeón",
  2: "🥈 Finalista",
  3: "🥉 3.er lugar",
};

function formatDate(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

async function getActivePlayers(category: "M" | "F") {
  if (!db) return [];
  return db
    .select({
      id: players.id,
      fullName: players.fullName,
      points: sql<number>`coalesce(sum(${rankingEvents.delta}), 0)`,
    })
    .from(players)
    .leftJoin(rankingEvents, eq(rankingEvents.playerId, players.id))
    .where(and(eq(players.status, "activo"), eq(players.gender, category)))
    .groupBy(players.id, players.fullName)
    .orderBy(desc(sql<number>`coalesce(sum(${rankingEvents.delta}), 0)`));
}

export default async function AdminCampeonatosPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") redirect("/");

  const [playersM, playersF, champsM, champsF] = await Promise.all([
    getActivePlayers("M"),
    getActivePlayers("F"),
    getChampionshipsWithPlacements("M"),
    getChampionshipsWithPlacements("F"),
  ]);

  const allChamps = [...champsM, ...champsF].sort((a, b) =>
    b.playedOn.localeCompare(a.playedOn),
  );

  function PlayerSelect({
    id,
    name,
    category,
    required = false,
    placeholder,
  }: {
    id?: string;
    name: string;
    category: "M" | "F";
    required?: boolean;
    placeholder?: string;
  }) {
    const opts = category === "M" ? playersM : playersF;
    return (
      <select
        id={id}
        name={name}
        required={required}
        defaultValue=""
        className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-500"
      >
        {!required && <option value="">{placeholder ?? "Ninguno"}</option>}
        {opts.map((p) => (
          <option key={p.id} value={p.id}>
            {p.fullName} ({Number(p.points)} pts)
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5">
        <p className="text-sm font-medium text-emerald-700">Admin</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Campeonatos
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          Registrá un campeonato y su podio. Los bonus se aplican
          automáticamente al ranking según RN-12: +150 campeón, +75 finalista,
          +40 tercer lugar.
        </p>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Form */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">
            Registrar campeonato
          </h2>
          <form action={createChampionshipAction} className="mt-6 space-y-4">
            <label className="block space-y-2 text-sm text-slate-700">
              <span className="font-medium">Nombre</span>
              <input
                name="name"
                required
                placeholder="Copa Verano 2026"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-500"
              />
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="block space-y-2 text-sm text-slate-700">
                <span className="font-medium">Categoría</span>
                <select
                  name="category"
                  defaultValue="M"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-500"
                >
                  <option value="M">Hombres</option>
                  <option value="F">Mujeres</option>
                </select>
              </label>

              <label className="block space-y-2 text-sm text-slate-700">
                <span className="font-medium">Tipo</span>
                <select
                  name="type"
                  defaultValue="regular"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-500"
                >
                  <option value="regular">Regular</option>
                  <option value="clausura">Clausura</option>
                  <option value="especial">Especial</option>
                </select>
              </label>
            </div>

            <label className="block space-y-2 text-sm text-slate-700">
              <span className="font-medium">Fecha</span>
              <input
                type="date"
                name="playedOn"
                required
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-500"
              />
            </label>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Podio
              </p>

              <label
                htmlFor="champion-player"
                className="block space-y-2 text-sm text-slate-700"
              >
                <span className="font-medium">🥇 Campeón (+150 pts)</span>
                <PlayerSelect
                  id="champion-player"
                  name="player1Id"
                  category="M"
                  required
                />
              </label>

              <label
                htmlFor="runner-up-player"
                className="block space-y-2 text-sm text-slate-700"
              >
                <span className="font-medium">🥈 Finalista (+75 pts)</span>
                <PlayerSelect
                  id="runner-up-player"
                  name="player2Id"
                  category="M"
                  required
                />
              </label>

              <label
                htmlFor="third-place-player"
                className="block space-y-2 text-sm text-slate-700"
              >
                <span className="font-medium">
                  🥉 Tercer lugar (+40 pts){" "}
                  <span className="font-normal text-slate-400">opcional</span>
                </span>
                <PlayerSelect
                  id="third-place-player"
                  name="player3Id"
                  category="M"
                  placeholder="Sin tercer lugar"
                />
              </label>
            </div>

            <p className="text-xs text-slate-400">
              Los selects de jugadores muestran la categoría seleccionada
              arriba. Cambiá la categoría antes de elegir los jugadores.
            </p>

            <button
              type="submit"
              className="rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Registrar campeonato
            </button>
          </form>
        </section>

        {/* Bonus reference */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm self-start">
          <h2 className="text-lg font-semibold text-slate-950">
            Escala de bonus (RN-12)
          </h2>
          <div className="mt-4 space-y-3">
            {[
              { pos: "🥇 Campeón", pts: "+150", color: "text-amber-600" },
              { pos: "🥈 Finalista", pts: "+75", color: "text-slate-500" },
              {
                pos: "🥉 Tercer lugar",
                pts: "+40",
                color: "text-amber-700/70",
              },
            ].map(({ pos, pts, color }) => (
              <div
                key={pos}
                className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3"
              >
                <span className="text-sm text-slate-800">{pos}</span>
                <span className={`text-sm font-semibold ${color}`}>
                  {pts} pts
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-400">
            Los partidos jugados dentro del campeonato se registran con{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5">
              type=campeonato
            </code>{" "}
            desde Admin › Partidos y no cuentan para el límite semanal RN-04.
          </p>
        </section>
      </div>

      {/* Championship list */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">
          Campeonatos registrados
        </h2>

        {allChamps.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 px-6 py-8 text-center text-sm text-slate-500">
            Sin campeonatos registrados aún.
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {allChamps.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl border border-slate-100 p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-slate-950">{c.name}</p>
                    <p className="text-xs text-slate-400">
                      {formatDate(c.playedOn)} · {typeLabels[c.type] ?? c.type}
                    </p>
                  </div>
                </div>
                {c.placements.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {c.placements.map((p) => (
                      <div
                        key={p.position}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-slate-600">
                          {positionLabels[p.position] ?? `#${p.position}`}{" "}
                          <span className="font-medium text-slate-900">
                            {p.playerName}
                          </span>
                        </span>
                        <span className="text-xs font-semibold text-emerald-700">
                          +{p.delta} pts
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
