"use client";

import { CalendarPlus, Plus, Swords } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { createWeekAction } from "@/app/admin/semanas/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createMatchAction } from "./match-admin-actions";

type PlayerOption = {
  id: string;
  fullName: string;
  gender: "M" | "F";
};

type CreateMode = "programming" | "match" | null;

function formatCategory(value: "M" | "F") {
  return value === "M" ? "Hombres" : "Mujeres";
}

export function AdminMatchesCreateMenu({
  playerOptions,
  programmingHref,
  nextWeekStartsOn,
}: {
  playerOptions: PlayerOption[];
  programmingHref: string | null;
  nextWeekStartsOn: string;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<CreateMode>(null);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setMode(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button
        type="button"
        size="icon-lg"
        className="rounded-full bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
        onClick={() => setOpen(true)}
        aria-label="Crear programación o partido"
        title="Crear programación o partido"
      >
        <Plus />
      </Button>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "programming"
              ? "Crear programación"
              : mode === "match"
                ? "Agregar partido"
                : "Nuevo"}
          </DialogTitle>
          <DialogDescription>
            {mode === "match"
              ? "Seleccioná dos jugadores y marca si corresponde a desafío."
              : "Elegí qué querés crear desde partidos."}
          </DialogDescription>
        </DialogHeader>

        {mode === null ? (
          <div className="grid gap-3">
            {programmingHref ? (
              <Link
                href={programmingHref}
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50"
              >
                <span className="flex size-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                  <CalendarPlus className="size-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-slate-950">
                    Crear programación
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">
                    Abrir jugadores de la semana y sorteo.
                  </span>
                </span>
              </Link>
            ) : (
              <button
                type="button"
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50"
                onClick={() => setMode("programming")}
              >
                <span className="flex size-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                  <CalendarPlus className="size-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-slate-950">
                    Crear programación
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">
                    Crear semana y abrir jugadores.
                  </span>
                </span>
              </button>
            )}

            <button
              type="button"
              className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:border-slate-300 hover:bg-slate-50"
              onClick={() => setMode("match")}
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                <Swords className="size-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-950">
                  Agregar partido
                </span>
                <span className="mt-1 block text-xs text-slate-500">
                  Crear un partido pendiente manualmente.
                </span>
              </span>
            </button>
          </div>
        ) : null}

        {mode === "programming" ? (
          <form action={createWeekAction} className="space-y-4">
            <label className="block space-y-2 text-sm text-slate-700">
              <span className="font-medium">Inicio de semana</span>
              <input
                name="startsOn"
                type="date"
                defaultValue={nextWeekStartsOn}
                required
                className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-emerald-500"
              />
            </label>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setMode(null)}
              >
                Volver
              </Button>
              <Button type="submit">Crear y agregar jugadores</Button>
            </DialogFooter>
          </form>
        ) : null}

        {mode === "match" ? (
          <form action={createMatchAction} className="space-y-4">
            <label className="block space-y-2 text-sm text-slate-700">
              <span className="font-medium">Jugador 1</span>
              <select
                name="player1Id"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-emerald-500"
              >
                {playerOptions.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.fullName} · {formatCategory(player.gender)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2 text-sm text-slate-700">
              <span className="font-medium">Jugador 2</span>
              <select
                name="player2Id"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-emerald-500"
              >
                {playerOptions.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.fullName} · {formatCategory(player.gender)}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
              <span className="font-medium">Es desafío</span>
              <input
                name="isChallenge"
                type="checkbox"
                value="1"
                className="size-4 accent-emerald-600"
              />
            </label>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setMode(null)}
              >
                Volver
              </Button>
              <Button type="submit" disabled={playerOptions.length < 2}>
                Crear partido
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
