"use client";

import { Plus, Search } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { addPlayersToWeekAvailabilityAction } from "../actions";

export type AddablePlayer = {
  id: string;
  fullName: string;
  isAdded: boolean;
};

type AddPlayersDialogProps = {
  weekId: string;
  label: string;
  players: AddablePlayer[];
  defaultOpen?: boolean;
  triggerLabel?: string;
};

export function AddPlayersDialog({
  weekId,
  label,
  players,
  defaultOpen = false,
  triggerLabel,
}: AddPlayersDialogProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [maxMatches, setMaxMatches] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredPlayers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return players;

    return players.filter((player) =>
      player.fullName.toLowerCase().includes(normalizedQuery),
    );
  }, [players, query]);

  const selectedCount = selectedIds.size;

  function togglePlayer(playerId: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(playerId);
      } else {
        next.delete(playerId);
      }
      return next;
    });
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setQuery("");
      setSelectedIds(new Set());
      setMaxMatches("1");
      setError(null);
    }
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        await addPlayersToWeekAvailabilityAction({
          weekId,
          playerIds: [...selectedIds],
          maxMatches: Number(maxMatches),
        });
        handleOpenChange(false);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "No se pudieron agregar jugadores",
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button
        type="button"
        size={triggerLabel ? "default" : "icon-sm"}
        variant="outline"
        className={triggerLabel ? "rounded-full" : undefined}
        onClick={() => setOpen(true)}
        aria-label={`Agregar jugadores a ${label}`}
        title={`Agregar jugadores a ${label}`}
      >
        <Plus />
        {triggerLabel}
      </Button>

      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Agregar jugadores</DialogTitle>
          <DialogDescription>{label}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label className="block space-y-2 text-sm">
            <span className="font-medium text-slate-700">
              Máximo de partidos
            </span>
            <select
              value={maxMatches}
              onChange={(event) => setMaxMatches(event.target.value)}
              className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-500"
            >
              <option value="1">1 partido</option>
              <option value="2">2 partidos</option>
              <option value="3">3 partidos</option>
            </select>
          </label>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar jugador"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-emerald-500"
            />
          </div>

          <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200">
            {filteredPlayers.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">
                No hay jugadores con ese nombre.
              </p>
            ) : (
              filteredPlayers.map((player) => (
                <label
                  key={player.id}
                  className={`flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-sm last:border-0 ${
                    player.isAdded
                      ? "bg-slate-50 text-slate-400"
                      : "cursor-pointer text-slate-800 hover:bg-emerald-50"
                  }`}
                >
                  <span className="font-medium">{player.fullName}</span>
                  <span className="flex items-center gap-3">
                    {player.isAdded && (
                      <span className="text-xs font-medium">Agregado</span>
                    )}
                    <input
                      type="checkbox"
                      disabled={player.isAdded || isPending}
                      checked={selectedIds.has(player.id)}
                      onChange={(event) =>
                        togglePlayer(player.id, event.target.checked)
                      }
                      className="size-4 accent-emerald-600"
                    />
                  </span>
                </label>
              ))
            )}
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || selectedCount === 0}
          >
            {isPending ? "Agregando" : `Agregar ${selectedCount || ""}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
