import { ArrowRight } from "lucide-react";
import { Oswald } from "next/font/google";
import Link from "next/link";

import { HowItWorks } from "@/components/landing/how-it-works";
import { MatchesCarousel } from "@/components/landing/matches-carousel";
import { RankingPreviewCard } from "@/components/landing/ranking-preview-card";
import { getRanking, getRecentPublicMatches } from "@/lib/ranking";

const oswald = Oswald({ subsets: ["latin"], weight: ["700"] });

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
      <section className="relative -mt-2 min-h-screen w-full overflow-hidden lg:min-h-[680px]">
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
        <div className="relative mx-auto flex h-full min-h-screen max-w-6xl flex-col justify-center gap-8 px-4 py-16 sm:px-6 lg:min-h-[680px] lg:flex-row lg:items-center">
          {/* Left: text + CTAs */}
          <div className="flex flex-1 flex-col lg:max-w-xl lg:gap-6">
            {/* Title — stays near top */}
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-white/60">
                Club La Dehesa · Tenis
              </p>
              <h1
                className={`${oswald.className} text-5xl uppercase leading-none tracking-wide text-white sm:text-[3.375rem] lg:text-6xl`}
              >
                Escalerilla
                <br />
                <span className="text-clay">de Tenis</span>
              </h1>
              <p className="hidden sm:block max-w-md text-base leading-7 text-white/70">
                Ranking en vivo, programación semanal y registro de resultados
                para los socios. Declara tu disponibilidad, juega tus cruces y
                sigue tu posición en tiempo real.
              </p>
            </div>

            {/* Buttons + stats — pushed to bottom on mobile */}
            <div className="mt-auto space-y-6 pb-8 lg:mt-0 lg:pb-0">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link
                  href="/ranking/hombres"
                  className="rounded-full bg-clay px-6 py-3 text-center text-sm font-semibold text-white shadow-lg transition hover:bg-clay/90 hover:shadow-clay/30 hover:shadow-xl"
                >
                  Ver ranking hombres
                </Link>
                <Link
                  href="/ranking/mujeres"
                  className="rounded-full border border-white/30 bg-white/10 px-6 py-3 text-center text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
                >
                  Ver ranking mujeres
                </Link>
              </div>
            </div>
          </div>

          {/* Right: Top 10 ranking card — desktop only inside hero */}
          <div className="hidden lg:block lg:translate-x-16 lg:w-96 xl:translate-x-28 xl:w-[28rem]">
            <RankingPreviewCard hombres={topHombres} mujeres={topMujeres} />
          </div>
        </div>
      </section>

      {/* Ranking card — mobile only, below hero so it requires scrolling */}
      <div className="bg-[#0d1b2a] px-4 pb-8 pt-6 lg:hidden">
        <RankingPreviewCard hombres={topHombres} mujeres={topMujeres} />
      </div>

      {/* ── Recent matches carousel ── */}
      {recentMatches.length > 0 && (
        <section className="relative overflow-hidden bg-muted/60 pb-24 pt-24">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#0d1b2a] via-[#0d1b2a]/35 to-transparent"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent via-[#0d1b2a]/25 to-[#0d1b2a]"
          />
          <div className="relative mx-auto mb-6 flex max-w-6xl flex-col gap-4 px-4 sm:flex-row sm:items-end sm:justify-between sm:px-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-clay">
                Resultados
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
                Últimos partidos
              </h2>
            </div>
            <Link
              href="/fixture"
              className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              Ver todos
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="relative">
            <MatchesCarousel matches={recentMatches} />
          </div>
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
