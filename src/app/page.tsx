import Link from "next/link";

import { HowItWorks } from "@/components/landing/how-it-works";
import { MatchesCarousel } from "@/components/landing/matches-carousel";
import { RankingPreviewCard } from "@/components/landing/ranking-preview-card";
import { getRanking, getRecentPublicMatches } from "@/lib/ranking";

export default async function Home() {
  const [hombresRanking, mujeresRanking, recentMatches] = await Promise.all([
    getRanking("hombres"),
    getRanking("mujeres"),
    getRecentPublicMatches(10),
  ]);

  const topHombres = hombresRanking.slice(0, 10);
  const topMujeres = mujeresRanking.slice(0, 10);

  return (
    <div className="flex w-full flex-1 flex-col">
      {/* ── Hero ── */}
      <section className="relative -mt-2 min-h-[600px] w-full overflow-hidden lg:min-h-[680px]">
        {/* Background photo */}
        <div
          className="absolute inset-0 bg-[#b04d15]"
          style={{
            backgroundImage: "url('/images/foto-landing.png')",
            backgroundSize: "cover",
            backgroundPosition: "center top",
          }}
        />

        {/* Dark gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0d1b2a] via-[#0d1b2a]/75 to-[#0d1b2a]/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d1b2a]/60 via-transparent to-transparent" />

        {/* Content */}
        <div className="relative mx-auto flex h-full min-h-[600px] max-w-6xl flex-col justify-center gap-8 px-4 py-16 sm:px-6 lg:min-h-[680px] lg:flex-row lg:items-center">
          {/* Left: text + CTAs */}
          <div className="flex-1 space-y-6 lg:max-w-xl">
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-white/60">
                Club La Dehesa · Tenis
              </p>
              <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
                Escalerilla
                <br />
                <span className="text-clay">de Tenis</span>
              </h1>
              <p className="max-w-md text-base leading-7 text-white/70">
                Ranking en vivo, programación semanal y registro de resultados
                para los socios. Declara tu disponibilidad, juega tus cruces y
                sigue tu posición en tiempo real.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/ranking/hombres"
                className="rounded-full bg-clay px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-clay/90 hover:shadow-clay/30 hover:shadow-xl"
              >
                Ver ranking hombres
              </Link>
              <Link
                href="/ranking/mujeres"
                className="rounded-full border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                Ver ranking mujeres
              </Link>
            </div>

            {/* Quick stats */}
            <div className="flex flex-wrap gap-6 pt-2">
              <div>
                <p className="text-2xl font-bold text-white">
                  {hombresRanking.length}
                </p>
                <p className="text-xs text-white/50">Jugadores hombres</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {mujeresRanking.length}
                </p>
                <p className="text-xs text-white/50">Jugadoras mujeres</p>
              </div>
            </div>
          </div>

          {/* Right: Top 10 ranking card */}
          <div className="w-full lg:translate-x-16 lg:w-96 xl:translate-x-28 xl:w-[28rem]">
            <RankingPreviewCard hombres={topHombres} mujeres={topMujeres} />
          </div>
        </div>
      </section>

      {/* ── Recent matches carousel ── */}
      {recentMatches.length > 0 && (
        <section className="bg-muted/60 py-12">
          <div className="mx-auto mb-6 max-w-6xl px-4 sm:px-6">
            <p className="text-xs font-bold uppercase tracking-widest text-clay">
              Resultados
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
              Últimos partidos
            </h2>
          </div>
          <MatchesCarousel matches={recentMatches} />
        </section>
      )}

      {/* ── How it works ── */}
      <section className="w-full bg-[#0d1b2a] py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <HowItWorks />
        </div>
      </section>
    </div>
  );
}
