"use client";

import { Minus, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { updateWeekPlayerMaxMatchesAction } from "../actions";

type WeekPlayerMatchLimitControlsProps = {
  weekId: string;
  playerId: string;
  playerName: string;
  maxMatches: number;
};

const MIN_MATCHES = 1;
const MAX_MATCHES = 3;

export function WeekPlayerMatchLimitControls({
  weekId,
  playerId,
  playerName,
  maxMatches,
}: WeekPlayerMatchLimitControlsProps) {
  const router = useRouter();
  const [currentMaxMatches, setCurrentMaxMatches] = useState(maxMatches);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateMaxMatches(nextMaxMatches: number) {
    const clampedMaxMatches = Math.max(
      MIN_MATCHES,
      Math.min(MAX_MATCHES, nextMaxMatches),
    );

    if (clampedMaxMatches === currentMaxMatches) return;

    setError(null);
    const previousMaxMatches = currentMaxMatches;
    setCurrentMaxMatches(clampedMaxMatches);

    startTransition(async () => {
      try {
        await updateWeekPlayerMaxMatchesAction({
          weekId,
          playerId,
          maxMatches: clampedMaxMatches,
        });
        router.refresh();
      } catch (err) {
        setCurrentMaxMatches(previousMaxMatches);
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo actualizar el máximo de partidos",
        );
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={() => updateMaxMatches(currentMaxMatches - 1)}
          disabled={isPending || currentMaxMatches <= MIN_MATCHES}
          title={`Bajar partidos de ${playerName}`}
          aria-label={`Bajar partidos de ${playerName}`}
        >
          <Minus />
        </Button>
        <span className="min-w-20 text-center text-xs text-slate-500">
          {currentMaxMatches} partido{currentMaxMatches !== 1 ? "s" : ""}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={() => updateMaxMatches(currentMaxMatches + 1)}
          disabled={isPending || currentMaxMatches >= MAX_MATCHES}
          title={`Subir partidos de ${playerName}`}
          aria-label={`Subir partidos de ${playerName}`}
        >
          <Plus />
        </Button>
      </div>
      {error && (
        <span className="max-w-56 text-right text-xs font-medium text-red-700">
          {error}
        </span>
      )}
    </div>
  );
}
