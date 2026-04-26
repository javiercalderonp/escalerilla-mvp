import Link from "next/link";

import { RankingTable } from "@/components/ranking/ranking-table";
import { getRanking, getRankingSummary } from "@/lib/ranking";

const milestones = [
  {
    title: "Ranking base",
    description:
      "Importar seed inicial, calcular puntos vigentes desde ranking_events y publicar ranking H/M.",
  },
  {
    title: "Disponibilidad semanal",
    description:
      "Abrir semanas, declarar días disponibles y consolidar respuestas para el organizador.",
  },
  {
    title: "Fixture asistido",
    description:
      "Proponer cruces respetando 30 días, cupos y cercanía de ranking antes de publicar.",
  },
];

export default async function Home() {
  const summary = await getRankingSummary();
  const featuredCategory = "hombres" as const;
  const featuredEntries = await getRanking(featuredCategory);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 px-4 py-10 sm:px-6">
      <section className="grid gap-8 rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-6">
          <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
            MVP interno en construcción
          </span>
          <div className="space-y-3">
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Escalerilla de Tenis Club La Dehesa
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-slate-600">
              Web app interna para ordenar el ranking, levantar disponibilidad semanal,
              proponer fixture y registrar resultados sin romper la coordinación social por
              WhatsApp.
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
          <p className="text-sm font-medium text-emerald-300">Estado actual</p>
          <div className="mt-4 space-y-4 text-sm leading-6 text-slate-300">
            <p>Base del proyecto inicializada en Next.js 16 + TypeScript + Tailwind.</p>
            <p>Stack objetivo: Auth Google, Neon Postgres, Drizzle y reglas de ranking auditables.</p>
            <p>Primer slice visible: ranking público por categoría con base lista para conectar DB.</p>
          </div>
          <div className="mt-6 space-y-3 rounded-2xl bg-white/5 p-4">
            {summary.categories.map((category) => (
              <div key={category.category} className="flex items-center justify-between gap-4 text-sm">
                <div>
                  <p className="font-medium text-white">{category.label}</p>
                  <p className="text-slate-400">Líder: {category.leader.fullName}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-emerald-300">{category.leader.points} pts</p>
                  <p className="text-slate-400">{category.players} jugadores</p>
                </div>
              </div>
            ))}
            <p className="pt-1 text-xs text-slate-400">{summary.updatedLabel}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {milestones.map((milestone) => (
          <article
            key={milestone.title}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <p className="text-sm font-medium text-emerald-700">En foco</p>
            <h2 className="mt-3 text-xl font-semibold text-slate-950">{milestone.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{milestone.description}</p>
          </article>
        ))}
      </section>

      <section className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-emerald-700">Slice visible</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Ranking público inicial
            </h2>
          </div>
          <Link
            href="/ranking/hombres"
            className="text-sm font-medium text-emerald-700 transition hover:text-emerald-800"
          >
            Ir al detalle →
          </Link>
        </div>
        <RankingTable category={featuredCategory} entries={featuredEntries} />
      </section>
    </div>
  );
}
