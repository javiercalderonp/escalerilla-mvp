"use client";

import { Check, Eraser, Save } from "lucide-react";
import { useState } from "react";

import { AvailabilityGrid } from "@/components/availability/availability-grid";
import {
  AVAILABILITY_DAYS,
  type AvailabilitySlots,
  buildSlots,
  emptySlots,
} from "@/lib/availability";
import { upsertAvailabilityAction } from "./actions";

type AvailabilityFormProps = {
  existing: { slots: AvailabilitySlots } | null;
};

function buildInitialAvailability(
  existing: { slots: AvailabilitySlots } | null,
) {
  if (existing) return existing.slots;

  return AVAILABILITY_DAYS.reduce((acc, { key }) => {
    acc[key] = buildSlots(key, false);
    return acc;
  }, {} as AvailabilitySlots);
}

export function AvailabilityForm({ existing }: AvailabilityFormProps) {
  const [availability, setAvailability] = useState<AvailabilitySlots>(() =>
    buildInitialAvailability(existing),
  );

  function clearSelection() {
    setAvailability(
      AVAILABILITY_DAYS.reduce((acc, { key }) => {
        acc[key] = emptySlots();
        return acc;
      }, {} as AvailabilitySlots),
    );
  }

  const hasExisting = existing !== null;

  return (
    <form action={upsertAvailabilityAction} className="space-y-6">
      {AVAILABILITY_DAYS.map(({ key }) => (
        <input
          key={key}
          type="hidden"
          name={key}
          value={availability[key].some(Boolean) ? "1" : "0"}
        />
      ))}
      <input
        type="hidden"
        name="availabilitySlots"
        value={JSON.stringify(availability)}
      />

      <AvailabilityGrid
        availability={availability}
        onChange={setAvailability}
      />

      <div className="sticky bottom-0 z-20 -mx-4 border-t border-border/70 bg-background/95 px-4 py-4 shadow-2xl shadow-court/10 backdrop-blur sm:static sm:mx-0 sm:flex sm:flex-wrap sm:gap-3 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-none">
        <button
          type="submit"
          className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-clay px-7 text-base font-bold text-clay-foreground shadow-lg shadow-clay/20 transition hover:bg-clay/90 sm:h-12 sm:w-auto sm:min-w-64 sm:rounded-2xl sm:text-sm"
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
          className="mt-3 hidden h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-card px-7 text-sm font-semibold text-muted-foreground shadow-sm transition hover:border-clay/30 hover:text-foreground sm:mt-0 sm:inline-flex sm:min-w-52"
        >
          <Eraser className="size-4" aria-hidden="true" />
          Limpiar selección
        </button>
      </div>
    </form>
  );
}
