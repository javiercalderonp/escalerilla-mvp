"use client";

import { CalendarCheckIcon, ChartBarIcon, SwordsIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const steps = [
  {
    step: "01",
    icon: CalendarCheckIcon,
    accentCls: "bg-[#e47a34]",
    badgeCls: "bg-[#e47a34]/15 ring-[#e47a34]/20 group-hover:bg-[#e47a34]/22",
    iconCls: "text-[#ff9b5f]",
    numCls: "text-[#ff9b5f]/35 group-hover:text-[#ff9b5f]/55",
    title: "Declara tu disponibilidad",
    description:
      "Cada semana eliges los días en que puedes jugar y cuántos partidos quieres disputar. El administrador define cuándo se abre y se cierra la inscripción.",
  },
  {
    step: "02",
    icon: SwordsIcon,
    accentCls: "bg-[#4aa3ff]",
    badgeCls: "bg-[#4aa3ff]/15 ring-[#4aa3ff]/20 group-hover:bg-[#4aa3ff]/22",
    iconCls: "text-[#74b9ff]",
    numCls: "text-[#74b9ff]/35 group-hover:text-[#74b9ff]/55",
    title: "Se publican los cruces",
    description:
      "La plataforma ayuda a ordenar partidos equilibrados, considerando el ranking, la disponibilidad informada y la regla de no repetir rival dentro de 30 días.",
  },
  {
    step: "03",
    icon: ChartBarIcon,
    accentCls: "bg-[#47c978]",
    badgeCls: "bg-[#47c978]/15 ring-[#47c978]/20 group-hover:bg-[#47c978]/22",
    iconCls: "text-[#68e092]",
    numCls: "text-[#68e092]/35 group-hover:text-[#68e092]/55",
    title: "Juega y actualiza el ranking",
    description:
      "Después del partido se registra el resultado y el ranking se recalcula automáticamente según el formato jugado. Todo queda guardado para revisión.",
  },
];

export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section>
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-widest text-clay">
          ¿Cómo funciona?
        </p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Así funciona cada semana
        </h2>
      </div>

      <div ref={ref} className="grid gap-6 md:grid-cols-3">
        {steps.map((s, index) => {
          const Icon = s.icon;
          return (
            <article
              key={s.step}
              className={`group relative overflow-hidden rounded-lg border border-white/12 bg-[#14263a] shadow-[0_18px_50px_rgba(0,0,0,0.18)] backdrop-blur-sm transition-all duration-700 ease-out hover:-translate-y-1 hover:border-white/20 hover:bg-[#19314a] hover:shadow-[0_22px_60px_rgba(0,0,0,0.26)] ${
                visible
                  ? "translate-y-0 opacity-100"
                  : "translate-y-8 opacity-0"
              }`}
              style={{
                transitionDelay: visible ? `${index * 160}ms` : "0ms",
              }}
            >
              {/* Colored top accent bar */}
              <div className={`absolute inset-x-0 top-0 h-1 ${s.accentCls}`} />

              {/* Connector arrow on desktop */}
              {index < steps.length - 1 && (
                <div className="absolute -right-4 top-1/2 z-10 hidden -translate-y-1/2 md:flex items-center">
                  <div className="h-px w-5 bg-white/20" />
                  <div className="size-0 border-y-4 border-l-4 border-y-transparent border-l-white/20" />
                </div>
              )}

              <div className="p-6">
                {/* Step number + icon row */}
                <div className="mb-4 flex items-center gap-3">
                  <div
                    className={`inline-flex size-12 items-center justify-center rounded-lg ring-1 transition-colors ${s.badgeCls}`}
                  >
                    <Icon className={`size-6 stroke-[2.3] ${s.iconCls}`} />
                  </div>
                  <span
                    className={`text-3xl font-black transition-colors ${s.numCls}`}
                  >
                    {s.step}
                  </span>
                </div>

                <h3 className="text-base font-bold text-white">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">
                  {s.description}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
