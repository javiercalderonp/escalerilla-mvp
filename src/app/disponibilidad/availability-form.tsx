"use client";

import {
  CalendarCheck,
  CalendarDays,
  Check,
  Eraser,
  Hand,
  Save,
} from "lucide-react";
import { type KeyboardEvent, useState } from "react";

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
type AvailabilitySlots = Record<DayKey, boolean[]>;

type AvailabilityFormProps = {
  existing: Record<DayKey, boolean> | null;
};

const START_HOUR = 8;
const END_HOUR = 23;
const SLOT_MINUTES = 30;
const SLOT_COUNT = ((END_HOUR - START_HOUR) * 60) / SLOT_MINUTES;
const HOURS = Array.from(
  { length: END_HOUR - START_HOUR + 1 },
  (_, index) => START_HOUR + index,
);
const SLOTS = Array.from({ length: SLOT_COUNT }, (_, index) => ({
  id: `slot-${index}`,
  index,
}));

const DEFAULT_RANGES: Record<DayKey, Array<[number, number]>> = {
  availMonday: [
    [8, 10],
    [16, 20],
  ],
  availTuesday: [[18, 20]],
  availWednesday: [[18, 21]],
  availThursday: [[18, 20]],
  availFriday: [[17, 20]],
  availSaturday: [[10, 13]],
  availSunday: [[10, 12]],
};
const WEEK_TABS = [
  { label: "Disponibilidad base", active: true },
  { label: "Esta semana", active: false },
  { label: "Próxima semana", active: false },
] as const;

function emptySlots() {
  return Array.from({ length: SLOT_COUNT }, () => false);
}

function hourToSlot(hour: number) {
  return (hour - START_HOUR) * (60 / SLOT_MINUTES);
}

function buildSlots(day: DayKey, isAvailable: boolean) {
  const slots = emptySlots();

  if (!isAvailable) return slots;

  for (const [start, end] of DEFAULT_RANGES[day]) {
    for (let index = hourToSlot(start); index < hourToSlot(end); index += 1) {
      slots[index] = true;
    }
  }

  return slots;
}

function buildInitialAvailability(existing: Record<DayKey, boolean> | null) {
  return DAYS.reduce((acc, { key }) => {
    acc[key] = buildSlots(key, existing?.[key] ?? false);
    return acc;
  }, {} as AvailabilitySlots);
}

function formatTime(slotIndex: number) {
  const totalMinutes = START_HOUR * 60 + slotIndex * SLOT_MINUTES;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function getDayRanges(slots: boolean[]) {
  const ranges: Array<[number, number]> = [];
  let start: number | null = null;

  slots.forEach((isSelected, index) => {
    if (isSelected && start === null) {
      start = index;
    }

    if ((!isSelected || index === slots.length - 1) && start !== null) {
      const end = isSelected && index === slots.length - 1 ? index + 1 : index;
      ranges.push([start, end]);
      start = null;
    }
  });

  return ranges;
}

function summarizeDay(slots: boolean[]) {
  return getDayRanges(slots)
    .map(([start, end]) => `${formatTime(start)}-${formatTime(end)}`)
    .join(", ");
}

export function AvailabilityForm({ existing }: AvailabilityFormProps) {
  const [availability, setAvailability] = useState<AvailabilitySlots>(() =>
    buildInitialAvailability(existing),
  );
  const [dragMode, setDragMode] = useState<{
    day: DayKey;
    value: boolean;
  } | null>(null);

  function setSlot(day: DayKey, slotIndex: number, value: boolean) {
    setAvailability((prev) => ({
      ...prev,
      [day]: prev[day].map((slot, index) =>
        index === slotIndex ? value : slot,
      ),
    }));
  }

  function handlePointerDown(day: DayKey, slotIndex: number) {
    const value = !availability[day][slotIndex];
    setDragMode({ day, value });
    setSlot(day, slotIndex, value);
  }

  function handlePointerEnter(day: DayKey, slotIndex: number) {
    if (!dragMode || dragMode.day !== day) return;
    setSlot(day, slotIndex, dragMode.value);
  }

  function handleSlotKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    day: DayKey,
    slotIndex: number,
  ) {
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    setSlot(day, slotIndex, !availability[day][slotIndex]);
  }

  function clearSelection() {
    setAvailability(
      DAYS.reduce((acc, { key }) => {
        acc[key] = emptySlots();
        return acc;
      }, {} as AvailabilitySlots),
    );
  }

  const selectedDays = DAYS.filter(({ key }) =>
    availability[key].some(Boolean),
  );
  const hasExisting = existing !== null;

  return (
    <form action={upsertAvailabilityAction} className="space-y-6">
      {DAYS.map(({ key }) => (
        <input
          key={key}
          type="hidden"
          name={key}
          value={availability[key].some(Boolean) ? "1" : "0"}
        />
      ))}

      <div className="grid overflow-hidden rounded-2xl border border-border bg-background/70 shadow-sm md:grid-cols-3">
        {WEEK_TABS.map(({ label, active }) => (
          <button
            key={label}
            type="button"
            aria-pressed={active}
            className={[
              "inline-flex h-12 items-center justify-center gap-2 border-border px-4 text-sm font-semibold transition md:border-l md:first:border-l-0",
              active
                ? "bg-card text-grass shadow-inner"
                : "bg-background/40 text-muted-foreground hover:bg-card",
            ].join(" ")}
          >
            <CalendarDays className="size-4" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-grass/15 bg-grass/5 px-4 py-3 text-sm font-medium text-grass">
        <span className="inline-flex items-center gap-2">
          <Hand className="size-4" aria-hidden="true" />
          Haz clic y arrastra sobre los horarios para marcar disponibilidad.
        </span>
      </div>

      <div className="overflow-x-auto pb-1">
        <div
          className="min-w-[900px] select-none overflow-hidden rounded-2xl border border-border bg-card"
          onPointerLeave={() => setDragMode(null)}
          onPointerUp={() => setDragMode(null)}
        >
          <div className="grid grid-cols-[72px_repeat(7,minmax(105px,1fr))] border-b border-border bg-card">
            <div aria-hidden="true" />
            {DAYS.map(({ key, label }) => (
              <div
                key={key}
                className="border-l border-border px-3 py-3 text-center text-sm font-bold text-foreground"
              >
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-[72px_repeat(7,minmax(105px,1fr))]">
            <div className="grid grid-rows-[repeat(15,36px)] border-r border-border bg-card">
              {HOURS.slice(0, -1).map((hour) => (
                <div
                  key={hour}
                  className="border-b border-border/70 px-3 pt-1.5 text-right text-sm text-muted-foreground last:border-b-0"
                >
                  {String(hour).padStart(2, "0")}:00
                </div>
              ))}
            </div>

            {DAYS.map(({ key, short }) => (
              <div
                key={key}
                className="grid grid-rows-[repeat(30,18px)] border-r border-border last:border-r-0"
              >
                {SLOTS.map(({ id, index: slotIndex }) => {
                  const isSelected = availability[key][slotIndex];
                  const isFirst =
                    isSelected &&
                    (slotIndex === 0 || !availability[key][slotIndex - 1]);
                  const isLast =
                    isSelected &&
                    (slotIndex === SLOT_COUNT - 1 ||
                      !availability[key][slotIndex + 1]);

                  return (
                    <button
                      key={`${key}-${id}`}
                      type="button"
                      aria-label={`${short} ${formatTime(slotIndex)}`}
                      aria-pressed={isSelected}
                      onPointerDown={() => handlePointerDown(key, slotIndex)}
                      onPointerEnter={() => handlePointerEnter(key, slotIndex)}
                      onKeyDown={(event) =>
                        handleSlotKeyDown(event, key, slotIndex)
                      }
                      className={[
                        "border-b border-dashed border-border/60 transition focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grass/50",
                        slotIndex % 2 === 0 ? "bg-background/35" : "bg-card",
                        isSelected
                          ? "mx-1 border-b-grass/35 bg-grass/85 shadow-sm hover:bg-grass"
                          : "hover:bg-grass/10",
                        isFirst ? "mt-1 rounded-t-md" : "",
                        isLast ? "mb-1 rounded-b-md" : "",
                      ].join(" ")}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-5 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <span className="size-5 rounded-md bg-grass" />
          Disponible
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-5 rounded-md border border-border bg-card" />
          Bloque libre
        </span>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-grass/10 text-grass">
            <CalendarCheck className="size-6" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              Resumen
            </h2>
            {selectedDays.length > 0 ? (
              <div className="mt-3 grid gap-3 text-sm text-muted-foreground lg:grid-cols-2 xl:grid-cols-4">
                {selectedDays.map(({ key, label }) => (
                  <p key={key} className="flex min-w-0 items-center gap-2">
                    <span className="size-2 shrink-0 rounded-full bg-grass" />
                    <span className="truncate">
                      <span className="font-semibold text-foreground">
                        {label}:
                      </span>{" "}
                      {summarizeDay(availability[key])}
                    </span>
                  </p>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Aún no hay horarios seleccionados.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button
          type="submit"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-grass px-7 text-sm font-bold text-grass-foreground shadow-lg shadow-grass/20 transition hover:bg-grass/90 sm:min-w-64"
        >
          {hasExisting ? (
            <Check className="size-4" aria-hidden="true" />
          ) : (
            <Save className="size-4" aria-hidden="true" />
          )}
          {hasExisting ? "Actualizar disponibilidad" : "Guardar disponibilidad"}
        </button>
        <button
          type="button"
          onClick={clearSelection}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-card px-7 text-sm font-semibold text-muted-foreground shadow-sm transition hover:border-grass/30 hover:text-foreground sm:min-w-52"
        >
          <Eraser className="size-4" aria-hidden="true" />
          Limpiar selección
        </button>
      </div>
    </form>
  );
}
