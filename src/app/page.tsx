import Link from "next/link";

import { RankingTable } from "@/components/ranking/ranking-table";
import { getRanking, getRankingSummary } from "@/lib/ranking";

const steps = [
  {
    step: "01",
    title: "Declarás disponibilidad",
    description:
      "Cada semana marcás los días que podés jugar y cuántos partidos querés. El admin abre y cierra la ventana.",
  },
  {
    step: "02",
    title: "El admin publica el fixture",
    description:
      "El sistema propone cruces minimizando la diferencia de ranking y respetando el límite de 30 días entre rivales.",
  },
  {
    step: "03",
    title: "Jugás y el ranking se actualiza",
    description:
      "Reportan el resultado, el ganador suma 60 pts y el perdedor suma entre 10 y 30 según el formato. Todo queda auditado.",
  },
];

export default async function Home() {
  const [summary, featuredEntries] = await Promise.all([
    getRankingSummary(),
    getRanking("hombres"),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 px-4 py-10 sm:px-6">
      {/* Hero */}
      <section className="grid gap-8 rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-6">
          <div className="space-y-3">
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Escalerilla de Tenis Club La Dehesa
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-slate-600">
              Ranking, fixture semanal y registro de resultados para los socios
              del club. Declaré disponibilidad, jugá tus cruces y seguí tu
              posición en tiempo real.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/ranking/hombres"
              className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              Ver ranking hombres
            </Link>
            <Link
              href="/ranking/mujeres"
              className="rounded-full border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-950"
            >
              Ver ranking mujeres
            </Link>
          </div>
        </div>

        <div className="rounded-2xl bg-slate-950 p-6 text-slate-50">
          <p className="text-sm font-medium text-emerald-300">Ranking live</p>
          <div className="mt-4 space-y-4 rounded-2xl bg-white/5 p-4">
            {summary.categories.map((category) => (
              <div
                key={category.category}
                className="flex items-center justify-between gap-4 text-sm"
              >
                <div>
                  <p className="font-medium text-white">{category.label}</p>
                  <p className="text-slate-400">
                    Líder: {category.leader?.fullName ?? "—"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-emerald-300">
                    {category.leader?.points ?? 0} pts
                  </p>
                  <p className="text-slate-400">{category.players} jugadores</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-400">{summary.updatedLabel}</p>
        </div>
      </section>

      {/* Cómo funciona */}
      <section>
        <div className="mb-6">
          <p className="text-sm font-medium text-emerald-700">
            ¿Cómo funciona?
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            El ciclo semanal de la escalerilla
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {steps.map((s) => (
            <article
              key={s.step}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <span className="text-xs font-semibold text-emerald-600">
                Paso {s.step}
              </span>
              <h3 className="mt-3 text-lg font-semibold text-slate-950">
                {s.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {s.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Ranking preview */}
      <section className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-emerald-700">
              Ranking hombres
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Posiciones actuales
            </h2>
          </div>
          <Link
            href="/ranking/hombres"
            className="text-sm font-medium text-emerald-700 transition hover:text-emerald-800"
          >
            Ver completo →
          </Link>
        </div>
        <RankingTable category="hombres" entries={featuredEntries} />
      </section>
    </div>
  );
}
