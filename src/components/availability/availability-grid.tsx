"use client";

import { CalendarCheck, CalendarDays, Clock, Hand, Trash2 } from "lucide-react";
import { type KeyboardEvent, useState } from "react";

import {
  AVAILABILITY_DAYS,
  type AvailabilityDayKey,
  type AvailabilitySlots,
  END_HOUR,
  formatAvailabilityTime,
  getDayRanges,
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

function formatRangeLabel(start: number, end: number) {
  return `${formatAvailabilityTime(start)} - ${formatAvailabilityTime(end)}`;
}

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
  const [activeDay, setActiveDay] = useState<AvailabilityDayKey>(
    () =>
      AVAILABILITY_DAYS.find(({ key }) => availability[key].some(Boolean))
        ?.key ?? AVAILABILITY_DAYS[0].key,
  );

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

  function clearDay(day: AvailabilityDayKey) {
    onChange({
      ...availability,
      [day]: availability[day].map(() => false),
    });
  }

  const selectedDays = AVAILABILITY_DAYS.filter(({ key }) =>
    availability[key].some(Boolean),
  );
  const activeDayMeta =
    AVAILABILITY_DAYS.find(({ key }) => key === activeDay) ??
    AVAILABILITY_DAYS[0];
  const activeRanges = getDayRanges(availability[activeDay]);

  return (
    <div className="space-y-6">
      {showTabs ? (
        <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-border bg-background/70 shadow-sm">
          {WEEK_TABS.map(({ label, active }) => (
            <button
              key={label}
              type="button"
              aria-pressed={active}
              className={[
                "inline-flex h-11 items-center justify-center gap-2 border-l border-border px-2 text-xs font-semibold transition first:border-l-0 sm:h-12 sm:px-4 sm:text-sm",
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

      <div className="space-y-5 md:hidden">
        <fieldset className="grid grid-cols-4 gap-2">
          <legend className="sr-only">Seleccionar día</legend>
          {AVAILABILITY_DAYS.map(({ key, short }) => {
            const isActive = key === activeDay;
            const hasSelection = availability[key].some(Boolean);

            return (
              <button
                key={key}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActiveDay(key)}
                className={[
                  "h-10 min-w-0 rounded-full border px-2 text-sm font-bold transition",
                  isActive
                    ? "border-clay bg-clay text-clay-foreground shadow-lg shadow-clay/20"
                    : "border-border bg-card text-foreground shadow-sm hover:border-clay/30",
                  hasSelection && !isActive ? "text-clay" : "",
                ].join(" ")}
              >
                {short}
              </button>
            );
          })}
        </fieldset>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl border border-clay/10 bg-clay/10 text-clay">
                <CalendarDays className="size-6" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold tracking-tight text-foreground">
                  {activeDayMeta.label}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {activeRanges.length === 1
                    ? "1 bloque disponible"
                    : `${activeRanges.length} bloques disponibles`}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => clearDay(activeDay)}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-clay/15 bg-card px-3 text-xs font-bold text-clay shadow-sm transition hover:border-clay/30 hover:bg-clay/5"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              Borrar día
            </button>
          </div>

          <div
            className="select-none overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
            onPointerLeave={() => setDragMode(null)}
            onPointerUp={() => setDragMode(null)}
          >
            <div className="grid grid-cols-[80px_minmax(0,1fr)] grid-rows-[repeat(30,22px)]">
              {HOURS.slice(0, -1).map((hour, index) => (
                <div
                  key={hour}
                  className="col-start-1 border-r border-border bg-card px-3 pt-1.5 text-right text-sm text-muted-foreground"
                  style={{ gridRow: `${index * 2 + 1} / span 2` }}
                >
                  {String(hour).padStart(2, "0")}:00
                </div>
              ))}

              {SLOTS.map(({ id, index: slotIndex }) => {
                const isSelected = availability[activeDay][slotIndex];
                const isFirst =
                  isSelected &&
                  (slotIndex === 0 || !availability[activeDay][slotIndex - 1]);
                const isLast =
                  isSelected &&
                  (slotIndex === SLOT_COUNT - 1 ||
                    !availability[activeDay][slotIndex + 1]);

                return (
                  <button
                    key={`${activeDay}-${id}`}
                    type="button"
                    aria-label={`${activeDayMeta.short} ${formatAvailabilityTime(slotIndex)}`}
                    aria-pressed={isSelected}
                    onPointerDown={() =>
                      handlePointerDown(activeDay, slotIndex)
                    }
                    onPointerEnter={() =>
                      handlePointerEnter(activeDay, slotIndex)
                    }
                    onKeyDown={(event) =>
                      handleSlotKeyDown(event, activeDay, slotIndex)
                    }
                    className={[
                      "relative col-start-2 border-b border-dashed border-border/60 px-3 text-left transition focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50",
                      slotIndex % 2 === 0 ? "bg-background/25" : "bg-card",
                      isSelected
                        ? "mx-2 border-b-clay/20 bg-clay/90 text-clay-foreground shadow-sm hover:bg-clay"
                        : "hover:bg-clay/10",
                      isFirst ? "mt-1 rounded-t-md" : "",
                      isLast ? "mb-1 rounded-b-md" : "",
                    ].join(" ")}
                  >
                    {isFirst ? (
                      <span className="pointer-events-none absolute left-3 top-2 z-10 text-sm font-bold leading-none">
                        {formatAvailabilityTime(slotIndex)}
                      </span>
                    ) : null}
                    {isLast ? (
                      <span className="pointer-events-none absolute bottom-2 left-3 z-10 text-sm font-bold leading-none">
                        {formatAvailabilityTime(slotIndex + 1)}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {showSummary ? (
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-clay/10 text-clay">
                  <Clock className="size-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-foreground">
                    Resumen del día
                  </h3>
                  {activeRanges.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {activeRanges.map(([start, end]) => (
                        <span
                          key={`${start}-${end}`}
                          className="rounded-full bg-clay/10 px-3 py-1 text-sm font-bold text-clay"
                        >
                          {formatRangeLabel(start, end)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Aún no hay horarios seleccionados.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <div className="hidden overflow-x-auto pb-1 md:block">
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

      <div className="hidden flex-wrap items-center justify-end gap-5 text-sm text-muted-foreground md:flex">
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
        <div className="hidden rounded-2xl border border-border bg-card p-4 sm:p-5 md:block">
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
