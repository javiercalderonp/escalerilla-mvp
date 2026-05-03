"use client";

import {
  CalendarDays,
  Check,
  ClipboardList,
  Eraser,
  Hand,
  Save,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { upsertAvailabilityAction } from "./actions";

const DAYS = [
  { key: "monday", label: "Lunes", short: "Lun" },
  { key: "tuesday", label: "Martes", short: "Mar" },
  { key: "wednesday", label: "Miércoles", short: "Mié" },
  { key: "thursday", label: "Jueves", short: "Jue" },
  { key: "friday", label: "Viernes", short: "Vie" },
  { key: "saturday", label: "Sábado", short: "Sáb" },
  { key: "sunday", label: "Domingo", short: "Dom" },
] as const;

type DayKey = (typeof DAYS)[number]["key"];

type AvailabilityFormProps = {
  weekId: string;
  existing:
    | ({
        maxMatches: number;
      } & Record<DayKey, boolean>)
    | null;
};

const HOURS = Array.from({ length: 16 }, (_, index) => index + 8);

function formatHour(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function AvailabilityForm({ weekId, existing }: AvailabilityFormProps) {
  const [selectedDays, setSelectedDays] = useState<Set<DayKey>>(
    () =>
      new Set(
        DAYS.filter(({ key }) => existing?.[key] ?? false).map(
          ({ key }) => key,
        ),
      ),
  );
  const [maxMatches, setMaxMatches] = useState(existing?.maxMatches ?? 1);
  const dragModeRef = useRef<boolean | null>(null);

  const selectedSummary = useMemo(
    () => DAYS.filter(({ key }) => selectedDays.has(key)),
    [selectedDays],
  );

  function setDay(day: DayKey, selected: boolean) {
    setSelectedDays((current) => {
      const next = new Set(current);
      if (selected) {
        next.add(day);
      } else {
        next.delete(day);
      }
      return next;
    });
  }

  function beginSelection(day: DayKey) {
    const shouldSelect = !selectedDays.has(day);
    dragModeRef.current = shouldSelect;
    setDay(day, shouldSelect);
  }

  function enterSelection(day: DayKey) {
    if (dragModeRef.current === null) return;
    setDay(day, dragModeRef.current);
  }

  function endSelection() {
    dragModeRef.current = null;
  }

  function clearSelection() {
    setSelectedDays(new Set());
  }

  return (
    <form
      action={upsertAvailabilityAction}
      className="space-y-6"
      onPointerLeave={endSelection}
      onPointerUp={endSelection}
    >
      <input type="hidden" name="weekId" value={weekId} />
      {DAYS.map(({ key }) => (
        <input
          key={key}
          type="hidden"
          name={key}
          value={selectedDays.has(key) ? "1" : "0"}
        />
      ))}
      <input type="hidden" name="maxMatches" value={maxMatches} />

      <div className="rounded-lg border border-court/20 bg-court/5 px-4 py-3 text-sm font-medium text-court shadow-sm">
        <div className="flex items-center gap-2">
          <Hand className="size-4" aria-hidden="true" />
          <span>
            Haz clic o arrastra sobre los días para marcar disponibilidad.
          </span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
        <div className="min-w-[880px]">
          <div className="grid grid-cols-[76px_repeat(7,minmax(104px,1fr))] border-b border-border">
            <div className="bg-card" />
            {DAYS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setDay(key, !selectedDays.has(key))}
                className="h-10 border-l border-border bg-card px-2 text-sm font-semibold text-foreground transition hover:bg-muted/60"
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-[76px_repeat(7,minmax(104px,1fr))] select-none">
            {HOURS.map((hour) => (
              <div key={`time-${hour}`} className="contents">
                <div className="flex h-9 items-start justify-center border-t border-border/50 bg-card pt-2 text-xs font-medium tabular-nums text-muted-foreground">
                  {formatHour(hour)}
                </div>
                {DAYS.map(({ key }, dayIndex) => {
                  const isSelected = selectedDays.has(key);
                  const isFirst = hour === HOURS[0];
                  const isLast = hour === HOURS[HOURS.length - 1];

                  return (
                    <button
                      key={`${key}-${hour}`}
                      type="button"
                      aria-label={`${isSelected ? "Quitar" : "Marcar"} ${key}`}
                      aria-pressed={isSelected}
                      onPointerDown={(event) => {
                        event.preventDefault();
                        beginSelection(key);
                      }}
                      onPointerEnter={() => enterSelection(key)}
                      className={[
                        "relative h-9 border-l border-t border-border/50 transition",
                        dayIndex === DAYS.length - 1 ? "border-r" : "",
                        isSelected
                          ? "bg-grass/80 hover:bg-grass"
                          : "bg-card hover:bg-muted/60",
                        isSelected && isFirst ? "rounded-t-md" : "",
                        isSelected && isLast ? "rounded-b-md" : "",
                      ].join(" ")}
                    >
                      <span className="absolute inset-x-2 top-1/2 border-t border-dashed border-current text-border/80" />
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-3 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <span className="size-4 rounded bg-grass/80" />
          Disponible
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-4 rounded border border-border bg-card" />
          Bloque libre
        </span>
      </div>

      <div className="rounded-lg border border-border bg-card px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="flex items-center gap-3 lg:w-48">
            <span className="inline-flex size-11 items-center justify-center rounded-lg bg-court/10 text-court">
              <ClipboardList className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-semibold text-foreground">Resumen</p>
              <p className="text-xs text-muted-foreground">
                {selectedDays.size} días seleccionados
              </p>
            </div>
          </div>

          <div className="flex flex-1 flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {selectedSummary.length > 0 ? (
              selectedSummary.map(({ key, label }) => (
                <span key={key} className="inline-flex items-center gap-2">
                  <span className="size-2 rounded-full bg-grass" />
                  <span>
                    <strong className="text-foreground">{label}:</strong>{" "}
                    08:00-23:00
                  </span>
                </span>
              ))
            ) : (
              <span className="text-muted-foreground">
                Aún no hay días marcados.
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-2">
          <div>
            <p className="text-sm font-semibold text-foreground">
              Partidos que quieres jugar esta semana
            </p>
            <p className="text-xs text-muted-foreground">
              El sorteo usará este cupo si hace falta repetir jugadores.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-1 shadow-sm">
            <div className="grid grid-cols-4 gap-1">
              {[0, 1, 2, 3].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMaxMatches(value)}
                  aria-pressed={maxMatches === value}
                  className={[
                    "inline-flex h-10 items-center justify-center rounded-md px-3 text-sm font-medium transition",
                    maxMatches === value
                      ? "bg-court text-court-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  ].join(" ")}
                >
                  {value === 0 ? "0" : value}
                  <span className="ml-1 hidden sm:inline">
                    {value === 1 ? "partido" : "partidos"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={clearSelection}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-border bg-card px-6 text-sm font-semibold text-muted-foreground shadow-sm transition hover:bg-muted hover:text-foreground"
          >
            <Eraser className="size-4" aria-hidden="true" />
            Limpiar selección
          </button>
          <button
            type="submit"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-court px-7 text-sm font-semibold text-court-foreground shadow-lg shadow-court/15 transition hover:bg-court/90"
          >
            {existing ? (
              <Check className="size-4" aria-hidden="true" />
            ) : (
              <Save className="size-4" aria-hidden="true" />
            )}
            {existing ? "Actualizar disponibilidad" : "Guardar disponibilidad"}
          </button>
        </div>
      </div>

      <div className="sr-only" aria-live="polite">
        {selectedSummary.map(({ short }) => short).join(", ")}
      </div>
      <CalendarDays className="hidden" aria-hidden="true" />
    </form>
  );
}
