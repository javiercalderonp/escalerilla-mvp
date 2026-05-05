"use client";

import { CalendarCheck, CalendarDays, Hand } from "lucide-react";
import { type KeyboardEvent, useState } from "react";

import {
  AVAILABILITY_DAYS,
  type AvailabilityDayKey,
  type AvailabilitySlots,
  END_HOUR,
  formatAvailabilityTime,
  SLOT_COUNT,
  START_HOUR,
  summarizeAvailabilityDay,
} from "@/lib/availability";

type AvailabilityGridProps = {
  availability: AvailabilitySlots;
  onChange: (availability: AvailabilitySlots) => void;
  showTabs?: boolean;
  showHint?: boolean;
  showSummary?: boolean;
};

const HOURS = Array.from(
  { length: END_HOUR - START_HOUR + 1 },
  (_, index) => START_HOUR + index,
);
const SLOTS = Array.from({ length: SLOT_COUNT }, (_, index) => ({
  id: `slot-${index}`,
  index,
}));

const WEEK_TABS = [
  { label: "Disponibilidad base", active: true },
  { label: "Esta semana", active: false },
] as const;

export function AvailabilityGrid({
  availability,
  onChange,
  showTabs = true,
  showHint = true,
  showSummary = true,
}: AvailabilityGridProps) {
  const [dragMode, setDragMode] = useState<{
    day: AvailabilityDayKey;
    value: boolean;
  } | null>(null);

  function setSlot(day: AvailabilityDayKey, slotIndex: number, value: boolean) {
    onChange({
      ...availability,
      [day]: availability[day].map((slot, index) =>
        index === slotIndex ? value : slot,
      ),
    });
  }

  function handlePointerDown(day: AvailabilityDayKey, slotIndex: number) {
    const value = !availability[day][slotIndex];
    setDragMode({ day, value });
    setSlot(day, slotIndex, value);
  }

  function handlePointerEnter(day: AvailabilityDayKey, slotIndex: number) {
    if (!dragMode || dragMode.day !== day) return;
    setSlot(day, slotIndex, dragMode.value);
  }

  function handleSlotKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    day: AvailabilityDayKey,
    slotIndex: number,
  ) {
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    setSlot(day, slotIndex, !availability[day][slotIndex]);
  }

  const selectedDays = AVAILABILITY_DAYS.filter(({ key }) =>
    availability[key].some(Boolean),
  );

  return (
    <div className="space-y-6">
      {showTabs ? (
        <div className="grid overflow-hidden rounded-2xl border border-border bg-background/70 shadow-sm md:grid-cols-2">
          {WEEK_TABS.map(({ label, active }) => (
            <button
              key={label}
              type="button"
              aria-pressed={active}
              className={[
                "inline-flex h-12 items-center justify-center gap-2 border-border px-4 text-sm font-semibold transition md:border-l md:first:border-l-0",
                active
                  ? "bg-card text-clay shadow-inner"
                  : "bg-background/40 text-muted-foreground hover:bg-card",
              ].join(" ")}
            >
              <CalendarDays className="size-4" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {showHint ? (
        <div className="rounded-xl border border-clay/15 bg-clay/5 px-4 py-3 text-sm font-medium text-clay">
          <span className="inline-flex items-center gap-2">
            <Hand className="size-4" aria-hidden="true" />
            Haz clic y arrastra sobre los horarios para marcar disponibilidad.
          </span>
        </div>
      ) : null}

      <div className="overflow-x-auto pb-1">
        <div
          className="min-w-[900px] select-none overflow-hidden rounded-2xl border border-border bg-card"
          onPointerLeave={() => setDragMode(null)}
          onPointerUp={() => setDragMode(null)}
        >
          <div className="grid grid-cols-[72px_repeat(7,minmax(105px,1fr))] border-b border-border bg-card">
            <div aria-hidden="true" />
            {AVAILABILITY_DAYS.map(({ key, label }) => (
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

            {AVAILABILITY_DAYS.map(({ key, short }) => (
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
                      aria-label={`${short} ${formatAvailabilityTime(slotIndex)}`}
                      aria-pressed={isSelected}
                      onPointerDown={() => handlePointerDown(key, slotIndex)}
                      onPointerEnter={() => handlePointerEnter(key, slotIndex)}
                      onKeyDown={(event) =>
                        handleSlotKeyDown(event, key, slotIndex)
                      }
                      className={[
                        "border-b border-dashed border-border/60 transition focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50",
                        slotIndex % 2 === 0 ? "bg-background/35" : "bg-card",
                        isSelected
                          ? "mx-1 border-b-clay/35 bg-clay/85 shadow-sm hover:bg-clay"
                          : "hover:bg-clay/10",
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
          <span className="size-5 rounded-md bg-clay" />
          Disponible
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-5 rounded-md border border-border bg-card" />
          Bloque libre
        </span>
      </div>

      {showSummary ? (
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-clay/10 text-clay">
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
                      <span className="size-2 shrink-0 rounded-full bg-clay" />
                      <span className="truncate">
                        <span className="font-semibold text-foreground">
                          {label}:
                        </span>{" "}
                        {summarizeAvailabilityDay(availability[key])}
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
      ) : null}
    </div>
  );
}
