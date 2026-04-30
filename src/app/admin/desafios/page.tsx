import { and, desc, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { matches, players, rankingEvents } from "@/lib/db/schema";
import { createChallengeAction } from "./actions";

type RankedPlayer = {
  id: string;
  fullName: string;
  gender: "M" | "F";
  points: number;
  rank: number;
};

async function getRanking(category: "M" | "F"): Promise<RankedPlayer[]> {
  if (!db) return [];
  const rows = await db
    .select({
      id: players.id,
      fullName: players.fullName,
      gender: players.gender,
      points: sql<number>`coalesce(sum(${rankingEvents.delta}), 0)`,
    })
    .from(players)
    .leftJoin(rankingEvents, eq(rankingEvents.playerId, players.id))
    .where(and(eq(players.status, "activo"), eq(players.gender, category)))
    .groupBy(players.id, players.fullName, players.gender)
    .orderBy(desc(sql<number>`coalesce(sum(${rankingEvents.delta}), 0)`));

  return rows.map((p, i) => ({ ...p, points: Number(p.points), rank: i + 1 }));
}

export default async function AdminDesafiosPage() {
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

  const [rankingM, rankingF] = await Promise.all([
    getRanking("M"),
    getRanking("F"),
  ]);

  // Recent desafios
  const recentDesafios = await db
    .select({
      id: matches.id,
      status: matches.status,
      player1Name: players.fullName,
      player2Name: sql<string>`players_p2.full_name`,
      createdAt: matches.createdAt,
    })
    .from(matches)
    .innerJoin(players, eq(matches.player1Id, players.id))
    .innerJoin(
      sql`players as players_p2`,
      sql`${matches.player2Id} = players_p2.id`,
    )
    .where(eq(matches.type, "desafio"))
    .orderBy(desc(matches.createdAt))
    .limit(20);

  const allActive = [...rankingM, ...rankingF];

  function RankingMini({
    rows,
    label,
  }: {
    rows: RankedPlayer[];
    label: string;
  }) {
    return (
      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">{label}</h3>
        <div className="space-y-1">
          {rows.slice(0, 15).map((p) => (
            <div key={p.id} className="flex items-center gap-2 text-sm">
              <span className="w-6 text-right text-xs text-slate-400">
                {p.rank}
              </span>
              <span className="flex-1 text-slate-800">{p.fullName}</span>
              <span className="text-xs text-slate-500">{p.points} pts</span>
            </div>
          ))}
          {rows.length > 15 && (
            <p className="pl-8 text-xs text-slate-400">
              …y {rows.length - 15} más
            </p>
          )}
        </div>
      </div>
    );
  }

  const statusStyles: Record<string, string> = {
    pendiente: "bg-slate-100 text-slate-600",
    confirmado: "bg-emerald-100 text-emerald-700",
    wo: "bg-rose-100 text-rose-700",
    empate: "bg-blue-100 text-blue-700",
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5">
        <p className="text-sm font-medium text-emerald-700">Admin</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Desafíos
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          Registrá partidos de tipo desafío. Se validan RN-06 (diferencia de
          posición ≤ 5) y RN-03 (sin enfrentamiento en los últimos 30 días).
          Podés hacer un override si completás la justificación.
        </p>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1fr_1.5fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">
            Ranking actual
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-6">
            <RankingMini rows={rankingM} label="Hombres" />
            <RankingMini rows={rankingF} label="Mujeres" />
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">
            Registrar desafío
          </h2>
          <form action={createChallengeAction} className="mt-6 space-y-4">
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
              <span className="font-medium">Retador (Jugador 1)</span>
              <select
                name="player1Id"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-500"
              >
                {allActive.map((p) => (
                  <option key={`p1-${p.id}`} value={p.id}>
                    #{p.rank} {p.fullName} ({p.points} pts) —{" "}
                    {p.gender === "M" ? "H" : "M"}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2 text-sm text-slate-700">
              <span className="font-medium">Retado (Jugador 2)</span>
              <select
                name="player2Id"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-500"
              >
                {allActive.map((p) => (
                  <option key={`p2-${p.id}`} value={p.id}>
                    #{p.rank} {p.fullName} ({p.points} pts) —{" "}
                    {p.gender === "M" ? "H" : "M"}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2 text-sm text-slate-700">
              <span className="font-medium">
                Justificación de override{" "}
                <span className="font-normal text-slate-400">
                  (solo si hay violación de RN-06 o RN-03)
                </span>
              </span>
              <textarea
                name="overrideNote"
                rows={2}
                placeholder="Ej: Ambos jugadores acordaron el cruce fuera de temporada"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-500"
              />
            </label>

            <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              El partido queda en estado <strong>pendiente</strong>. Registrá el
              resultado desde{" "}
              <Link href="/admin/partidos" className="underline">
                Admin › Partidos
              </Link>
              .
            </div>

            <button
              type="submit"
              className="rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Crear desafío
            </button>
          </form>
        </section>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">
          Desafíos recientes
        </h2>
        {recentDesafios.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 px-6 py-8 text-center text-sm text-slate-500">
            Sin desafíos registrados aún.
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {recentDesafios.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 px-4 py-3"
              >
                <p className="text-sm text-slate-800">
                  {d.player1Name} <span className="text-slate-400">vs</span>{" "}
                  {d.player2Name}
                </p>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    statusStyles[d.status] ?? "bg-slate-100 text-slate-600"
                  }`}
                >
                  {d.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
