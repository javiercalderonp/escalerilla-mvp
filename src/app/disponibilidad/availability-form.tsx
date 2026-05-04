"use client";

import { Check, Save } from "lucide-react";
import { useState } from "react";

import { upsertAvailabilityAction } from "./actions";

const DAYS = [
  { key: "availMonday" as const, short: "Lun", label: "Lunes" },
  { key: "availTuesday" as const, short: "Mar", label: "Martes" },
  { key: "availWednesday" as const, short: "Mié", label: "Miércoles" },
  { key: "availThursday" as const, short: "Jue", label: "Jueves" },
  { key: "availFriday" as const, short: "Vie", label: "Viernes" },
  { key: "availSaturday" as const, short: "Sáb", label: "Sábado" },
  { key: "availSunday" as const, short: "Dom", label: "Domingo" },
] as const;

type DayKey = (typeof DAYS)[number]["key"];

type AvailabilityFormProps = {
  existing: Record<DayKey, boolean> | null;
};

export function AvailabilityForm({ existing }: AvailabilityFormProps) {
  const [selected, setSelected] = useState<Record<DayKey, boolean>>(
    () =>
      existing ?? {
        availMonday: false,
        availTuesday: false,
        availWednesday: false,
        availThursday: false,
        availFriday: false,
        availSaturday: false,
        availSunday: false,
      },
  );

  function toggle(day: DayKey) {
    setSelected((prev) => ({ ...prev, [day]: !prev[day] }));
  }

  const selectedDays = DAYS.filter(({ key }) => selected[key]);
  const hasExisting = existing !== null;

  return (
    <form action={upsertAvailabilityAction} className="space-y-6">
      {DAYS.map(({ key }) => (
        <input
          key={key}
          type="hidden"
          name={key}
          value={selected[key] ? "1" : "0"}
        />
      ))}

      <div className="grid grid-cols-4 gap-3 sm:grid-cols-7">
        {DAYS.map(({ key, short, label }) => (
          <button
            key={key}
            type="button"
            aria-pressed={selected[key]}
            onClick={() => toggle(key)}
            className={[
              "flex flex-col items-center justify-center gap-0.5 rounded-2xl border py-4 text-center transition",
              selected[key]
                ? "border-court bg-court text-court-foreground"
                : "border-border bg-card text-muted-foreground hover:border-court/40",
            ].join(" ")}
          >
            <span className="text-sm font-semibold">{short}</span>
            <span className="hidden text-[11px] opacity-70 sm:block">
              {label}
            </span>
          </button>
        ))}
      </div>

      {selectedDays.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Disponible los{" "}
          <span className="font-medium text-foreground">
            {selectedDays.map(({ label }) => label).join(", ")}
          </span>
          .
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-court px-6 text-sm font-semibold text-court-foreground shadow-lg shadow-court/15 transition hover:bg-court/90"
        >
          {hasExisting ? (
            <Check className="size-4" aria-hidden="true" />
          ) : (
            <Save className="size-4" aria-hidden="true" />
          )}
          {hasExisting ? "Actualizar disponibilidad" : "Guardar disponibilidad"}
        </button>
      </div>
    </form>
  );
}
