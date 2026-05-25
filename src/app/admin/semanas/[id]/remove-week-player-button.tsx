"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { removePlayerFromWeekAvailabilityAction } from "../actions";

type RemoveWeekPlayerButtonProps = {
  weekId: string;
  playerId: string;
  playerName: string;
};

export function RemoveWeekPlayerButton({
  weekId,
  playerId,
  playerName,
}: RemoveWeekPlayerButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRemove() {
    setError(null);

    startTransition(async () => {
      try {
        await removePlayerFromWeekAvailabilityAction({ weekId, playerId });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "No se pudo quitar el jugador",
        );
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      {error && (
        <span className="max-w-48 text-right text-xs font-medium text-red-700">
          {error}
        </span>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={handleRemove}
        disabled={isPending}
        title={`Quitar a ${playerName}`}
        aria-label={`Quitar a ${playerName}`}
        className="text-slate-500 hover:bg-red-50 hover:text-red-700"
      >
        <Trash2 />
      </Button>
    </div>
  );
}
