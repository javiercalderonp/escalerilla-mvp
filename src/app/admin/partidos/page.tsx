import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  createMatchAction,
  registerDrawAction,
  registerResultAction,
  registerWalkoverAction,
} from "@/app/admin/partidos/actions";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { matches, players } from "@/lib/db/schema";

type AdminMatchesPageProps = {
  searchParams?: Promise<{
    status?: string;
    categoria?: string;
  }>;
};

type MatchRow = {
  id: string;
  category: "M" | "F";
  status: "pendiente" | "reportado" | "confirmado" | "wo" | "empate";
  format: "mr3" | "set_largo" | null;
  playedOn: string | null;
  confirmedAt: Date | null;
  player1Id: string;
  player2Id: string;
  player1Name: string;
  player2Name: string;
  winnerName: string | null;
};

type PlayerOption = {
  id: string;
  fullName: string;
  gender: "M" | "F";
};

const statusOptions = [
  "todos",
  "pendiente",
  "reportado",
  "confirmado",
  "wo",
  "empate",
] as const;
const categoryOptions = ["todas", "M", "F"] as const;

function statusBadge(status: MatchRow["status"]) {
  const styles = {
    pendiente: "bg-slate-200 text-slate-700",
    reportado: "bg-amber-100 text-amber-800",
    confirmado: "bg-emerald-100 text-emerald-800",
    wo: "bg-rose-100 text-rose-800",
    empate: "bg-blue-100 text-blue-800",
  } as const;

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${styles[status]}`}
    >
      {status}
    </span>
  );
}

function formatCategory(value: "M" | "F") {
  return value === "M" ? "Hombres" : "Mujeres";
}

function formatDate(value: string | Date | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function ResultSetsFields() {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3">
        <p className="text-sm font-medium text-slate-900">Set 1</p>
        <div className="grid grid-cols-2 gap-2">
          <input
            name="set1p1"
            type="number"
            min={0}
            className="rounded-xl border border-slate-300 px-3 py-2"
            placeholder="P1"
          />
          <input
            name="set1p2"
            type="number"
            min={0}
            className="rounded-xl border border-slate-300 px-3 py-2"
            placeholder="P2"
          />
        </div>
      </div>
      <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3">
        <p className="text-sm font-medium text-slate-900">Set 2</p>
        <div className="grid grid-cols-2 gap-2">
          <input
            name="set2p1"
            type="number"
            min={0}
            className="rounded-xl border border-slate-300 px-3 py-2"
            placeholder="P1"
          />
          <input
            name="set2p2"
            type="number"
            min={0}
            className="rounded-xl border border-slate-300 px-3 py-2"
            placeholder="P2"
          />
        </div>
      </div>
      <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3">
        <p className="text-sm font-medium text-slate-900">Set 3</p>
        <div className="grid grid-cols-2 gap-2">
          <input
            name="set3p1"
            type="number"
            min={0}
            className="rounded-xl border border-slate-300 px-3 py-2"
            placeholder="P1"
          />
          <input
            name="set3p2"
            type="number"
            min={0}
            className="rounded-xl border border-slate-300 px-3 py-2"
            placeholder="P2"
          />
        </div>
      </div>
    </div>
  );
}

async function getSummary() {
  if (!db) {
    return {
      total: 0,
      pending: 0,
      confirmed: 0,
      women: 0,
    };
  }

  const [totalRow] = await db.select({ value: count() }).from(matches);
  const [pendingRow] = await db
    .select({ value: count() })
    .from(matches)
    .where(eq(matches.status, "pendiente"));
  const [confirmedRow] = await db
    .select({ value: count() })
    .from(matches)
    .where(eq(matches.status, "confirmado"));
  const [womenRow] = await db
    .select({ value: count() })
    .from(matches)
    .where(eq(matches.category, "F"));

  return {
    total: totalRow?.value ?? 0,
    pending: pendingRow?.value ?? 0,
    confirmed: confirmedRow?.value ?? 0,
    women: womenRow?.value ?? 0,
  };
}

async function getPlayerOptions() {
  if (!db) {
    return [] as PlayerOption[];
  }

  const rows = await db
    .select({
      id: players.id,
      fullName: players.fullName,
      gender: players.gender,
    })
    .from(players)
    .where(eq(players.status, "activo"))
    .orderBy(asc(players.gender), asc(players.fullName));

  return rows as PlayerOption[];
}

async function getMatches(filters: { status: string; category: string }) {
  if (!db) {
    return [] as MatchRow[];
  }

  const p1 = players;
  const conditions = [];

  if (filters.status !== "todos") {
    conditions.push(eq(matches.status, filters.status as MatchRow["status"]));
  }

  if (filters.category !== "todas") {
    conditions.push(eq(matches.category, filters.category as "M" | "F"));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const query = db
    .select({
      id: matches.id,
      category: matches.category,
      status: matches.status,
      format: matches.format,
      playedOn: matches.playedOn,
      confirmedAt: matches.confirmedAt,
      player1Id: matches.player1Id,
      player2Id: matches.player2Id,
      player1Name: p1.fullName,
      player2Name: sql<string>`players_p2.full_name`,
      winnerName: sql<string | null>`players_winner.full_name`,
    })
    .from(matches)
    .innerJoin(p1, eq(matches.player1Id, p1.id))
    .innerJoin(
      sql`players as players_p2`,
      sql`${matches.player2Id} = players_p2.id`,
    )
    .leftJoin(
      sql`players as players_winner`,
      sql`${matches.winnerId} = players_winner.id`,
    )
    .orderBy(
      desc(matches.confirmedAt),
      desc(matches.createdAt),
      asc(p1.fullName),
    );

  const rows = whereClause ? await query.where(whereClause) : await query;
  return rows as MatchRow[];
}

export default async function AdminMatchesPage({
  searchParams,
}: AdminMatchesPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "admin") {
    redirect("/");
  }

  const query = searchParams ? await searchParams : undefined;
  const status = statusOptions.includes(
    (query?.status as (typeof statusOptions)[number]) ?? "todos",
  )
    ? (query?.status ?? "todos")
    : "todos";
  const category = categoryOptions.includes(
    (query?.categoria as (typeof categoryOptions)[number]) ?? "todas",
  )
    ? (query?.categoria ?? "todas")
    : "todas";

  const [summary, rows, playerOptions] = await Promise.all([
    getSummary(),
    getMatches({ status, category }),
    getPlayerOptions(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-700">Admin</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              Partidos
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Base real de partidos cargados, lista para registrar resultados,
              empates y W.O. dentro de la app.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link
              href="/admin/jugadores"
              className="rounded-full border border-slate-300 px-4 py-2 font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-950"
            >
              Ir a jugadores
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Total partidos</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">
            {summary.total}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Pendientes</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">
            {summary.pending}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Confirmados</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">
            {summary.confirmed}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Partidos mujeres</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">
            {summary.women}
          </p>
        </article>
      </section>

      <section className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">
            Crear partido pendiente
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Primer paso simple para dejar partidos listos antes de registrar el
            resultado.
          </p>

          <form action={createMatchAction} className="mt-6 space-y-4">
            <label className="space-y-2 text-sm text-slate-700">
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

            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Jugador 1</span>
              <select
                name="player1Id"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-500"
              >
                {playerOptions.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.fullName} · {formatCategory(player.gender)}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Jugador 2</span>
              <select
                name="player2Id"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-500"
              >
                {playerOptions.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.fullName} · {formatCategory(player.gender)}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              className="rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Crear partido
            </button>
          </form>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Listado</h2>
              <p className="mt-1 text-sm text-slate-600">
                Filtros base para navegar y resolver partidos.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              {statusOptions.map((option) => (
                <Link
                  key={option}
                  href={`/admin/partidos?status=${option}&categoria=${category}`}
                  className={`rounded-full px-3 py-1.5 font-medium transition ${
                    status === option
                      ? "bg-slate-950 text-white"
                      : "border border-slate-300 text-slate-700 hover:border-slate-400"
                  }`}
                >
                  {option}
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            {categoryOptions.map((option) => (
              <Link
                key={option}
                href={`/admin/partidos?status=${status}&categoria=${option}`}
                className={`rounded-full px-3 py-1.5 font-medium transition ${
                  category === option
                    ? "bg-emerald-600 text-white"
                    : "border border-slate-300 text-slate-700 hover:border-slate-400"
                }`}
              >
                {option}
              </Link>
            ))}
          </div>

          <div className="mt-6 space-y-4">
            {rows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-500">
                No hay partidos para este filtro.
              </div>
            ) : (
              rows.map((row) => (
                <div
                  key={row.id}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {statusBadge(row.status)}
                        <span className="text-xs text-slate-500">
                          {formatCategory(row.category)} ·{" "}
                          {row.format ?? "sin formato"}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-950">
                        {row.player1Name} vs {row.player2Name}
                      </p>
                      <p className="text-xs text-slate-500">
                        Ganador: {row.winnerName ?? "—"} · Fecha:{" "}
                        {formatDate(row.playedOn ?? row.confirmedAt)}
                      </p>
                    </div>
                  </div>

                  {row.status === "pendiente" || row.status === "reportado" ? (
                    <div className="mt-4 space-y-4 rounded-2xl bg-slate-50 p-4">
                      <form action={registerResultAction} className="space-y-4">
                        <input type="hidden" name="matchId" value={row.id} />

                        <div className="grid gap-4 md:grid-cols-2">
                          <label className="space-y-2 text-sm text-slate-700">
                            <span className="font-medium">Formato</span>
                            <select
                              name="format"
                              defaultValue="mr3"
                              className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-500"
                            >
                              <option value="mr3">MR3</option>
                              <option value="set_largo">Set largo</option>
                            </select>
                          </label>
                          <label className="space-y-2 text-sm text-slate-700">
                            <span className="font-medium">Fecha jugada</span>
                            <input
                              name="playedOn"
                              type="date"
                              className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-500"
                            />
                          </label>
                        </div>

                        <ResultSetsFields />

                        <button
                          type="submit"
                          className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-700"
                        >
                          Confirmar resultado
                        </button>
                      </form>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <form
                          action={registerDrawAction}
                          className="space-y-4 rounded-2xl border border-blue-200 bg-blue-50 p-4"
                        >
                          <input type="hidden" name="matchId" value={row.id} />
                          <div>
                            <h3 className="text-sm font-semibold text-slate-900">
                              Registrar empate
                            </h3>
                            <p className="mt-1 text-xs text-slate-600">
                              MVP: pensado para MR3 1-1. Ambos jugadores suman
                              35.
                            </p>
                          </div>

                          <input type="hidden" name="format" value="mr3" />

                          <label className="space-y-2 text-sm text-slate-700">
                            <span className="font-medium">Fecha jugada</span>
                            <input
                              name="playedOn"
                              type="date"
                              className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500"
                            />
                          </label>

                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3">
                              <p className="text-sm font-medium text-slate-900">
                                Set 1
                              </p>
                              <div className="grid grid-cols-2 gap-2">
                                <input
                                  name="set1p1"
                                  type="number"
                                  min={0}
                                  className="rounded-xl border border-slate-300 px-3 py-2"
                                  placeholder="P1"
                                />
                                <input
                                  name="set1p2"
                                  type="number"
                                  min={0}
                                  className="rounded-xl border border-slate-300 px-3 py-2"
                                  placeholder="P2"
                                />
                              </div>
                            </div>
                            <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3">
                              <p className="text-sm font-medium text-slate-900">
                                Set 2
                              </p>
                              <div className="grid grid-cols-2 gap-2">
                                <input
                                  name="set2p1"
                                  type="number"
                                  min={0}
                                  className="rounded-xl border border-slate-300 px-3 py-2"
                                  placeholder="P1"
                                />
                                <input
                                  name="set2p2"
                                  type="number"
                                  min={0}
                                  className="rounded-xl border border-slate-300 px-3 py-2"
                                  placeholder="P2"
                                />
                              </div>
                            </div>
                          </div>

                          <button
                            type="submit"
                            className="rounded-full bg-blue-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-blue-700"
                          >
                            Marcar empate
                          </button>
                        </form>

                        <form
                          action={registerWalkoverAction}
                          className="space-y-4 rounded-2xl border border-rose-200 bg-rose-50 p-4"
                        >
                          <input type="hidden" name="matchId" value={row.id} />
                          <div>
                            <h3 className="text-sm font-semibold text-slate-900">
                              Registrar W.O.
                            </h3>
                            <p className="mt-1 text-xs text-slate-600">
                              El ganador suma 60 y quien pierde por W.O. recibe
                              -20.
                            </p>
                          </div>

                          <label className="space-y-2 text-sm text-slate-700">
                            <span className="font-medium">
                              Ganador por W.O.
                            </span>
                            <select
                              name="winnerId"
                              defaultValue={row.player1Id}
                              className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-rose-500"
                            >
                              <option value={row.player1Id}>
                                {row.player1Name}
                              </option>
                              <option value={row.player2Id}>
                                {row.player2Name}
                              </option>
                            </select>
                          </label>

                          <label className="space-y-2 text-sm text-slate-700">
                            <span className="font-medium">
                              Fecha registrada
                            </span>
                            <input
                              name="playedOn"
                              type="date"
                              className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-rose-500"
                            />
                          </label>

                          <button
                            type="submit"
                            className="rounded-full bg-rose-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-rose-700"
                          >
                            Marcar W.O.
                          </button>
                        </form>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
