"use client";

import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { deleteWeekAction } from "./actions";

type DeleteWeekButtonProps = {
  weekId: string;
  weekLabel: string;
};

export function DeleteWeekButton({ weekId, weekLabel }: DeleteWeekButtonProps) {
  return (
    <form
      action={deleteWeekAction}
      onSubmit={(event) => {
        if (
          !window.confirm(
            `¿Eliminar la programación ${weekLabel}? Se borrará la disponibilidad asociada.`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="weekId" value={weekId} />
      <Button
        type="submit"
        variant="destructive"
        className="rounded-full"
        title="Eliminar programación"
      >
        <Trash2 data-icon="inline-start" />
        Eliminar
      </Button>
    </form>
  );
}
