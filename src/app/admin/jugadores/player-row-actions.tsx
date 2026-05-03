"use client";

import {
  Check,
  EllipsisVertical,
  Pencil,
  Trash2,
  Undo2,
  UserMinus,
} from "lucide-react";
import { useState } from "react";

import {
  approvePlayerAction,
  deletePlayerAction,
  toggleRetiredPlayerAction,
  updatePlayerAction,
} from "@/app/admin/jugadores/actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type PlayerRowActionData = {
  id: string;
  fullName: string;
  email: string | null;
  gender: "M" | "F";
  initialPoints: number;
  level: string | null;
  status: "pendiente" | "activo" | "congelado" | "retirado";
  notes: string | null;
};

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-500";

function PlayerFields({ player }: { player: PlayerRowActionData }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="space-y-2 text-sm text-slate-700 sm:col-span-2">
        <span className="font-medium">Nombre completo</span>
        <input
          name="fullName"
          defaultValue={player.fullName}
          required
          className={inputClass}
        />
      </label>

      <label className="space-y-2 text-sm text-slate-700">
        <span className="font-medium">Email</span>
        <input
          name="email"
          type="email"
          defaultValue={player.email ?? ""}
          className={inputClass}
        />
      </label>

      <label className="space-y-2 text-sm text-slate-700">
        <span className="font-medium">Categoría</span>
        <select
          name="gender"
          defaultValue={player.gender}
          className={inputClass}
        >
          <option value="M">Hombres</option>
          <option value="F">Mujeres</option>
        </select>
      </label>

      <label className="space-y-2 text-sm text-slate-700">
        <span className="font-medium">Puntos iniciales</span>
        <input
          name="initialPoints"
          type="number"
          min={0}
          defaultValue={player.initialPoints}
          className={inputClass}
        />
      </label>

      <label className="space-y-2 text-sm text-slate-700">
        <span className="font-medium">Nivel</span>
        <select
          name="level"
          defaultValue={player.level ?? ""}
          className={inputClass}
        >
          <option value="">Sin definir</option>
          <option value="principiante">Principiante</option>
          <option value="intermedio_bajo">Intermedio bajo</option>
          <option value="intermedio_alto">Intermedio alto</option>
          <option value="avanzado">Avanzado</option>
        </select>
      </label>

      <label className="space-y-2 text-sm text-slate-700">
        <span className="font-medium">Estado</span>
        <select
          name="status"
          defaultValue={player.status}
          className={inputClass}
        >
          {player.status === "pendiente" ? (
            <option value="pendiente">Pendiente</option>
          ) : null}
          <option value="activo">Activo</option>
          <option value="congelado">Congelado</option>
          <option value="retirado">Retirado</option>
        </select>
      </label>

      <label className="space-y-2 text-sm text-slate-700 sm:col-span-2">
        <span className="font-medium">Notas</span>
        <textarea
          name="notes"
          rows={3}
          defaultValue={player.notes ?? ""}
          className={inputClass}
        />
      </label>
    </div>
  );
}

function EditPlayerDialog({
  player,
  open,
  onOpenChange,
}: {
  player: PlayerRowActionData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar jugador</DialogTitle>
          <DialogDescription>{player.fullName}</DialogDescription>
        </DialogHeader>

        <form action={updatePlayerAction} className="space-y-5">
          <input type="hidden" name="playerId" value={player.id} />
          <PlayerFields player={player} />
          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Guardar cambios
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeletePlayerDialog({
  player,
  open,
  onOpenChange,
}: {
  player: PlayerRowActionData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar jugador</DialogTitle>
          <DialogDescription>
            Esto borra definitivamente a {player.fullName}. Si el jugador ya
            tiene historial, la acción se bloqueará y conviene retirarlo.
          </DialogDescription>
        </DialogHeader>

        <form action={deletePlayerAction}>
          <input type="hidden" name="playerId" value={player.id} />
          <DialogFooter>
            <button
              type="submit"
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-red-600/20"
            >
              Eliminar definitivamente
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PlayerRowActions({ player }: { player: PlayerRowActionData }) {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isRetired = player.status === "retirado";
  const nextStatus = isRetired ? "activo" : "retirado";
  const retireLabel = isRetired ? "Reactivar" : "Retirar";

  return (
    <div className="relative flex justify-end">
      <button
        type="button"
        aria-label={`Opciones de ${player.fullName}`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex size-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-slate-950/10"
      >
        <EllipsisVertical className="size-4" />
      </button>

      {open ? (
        <div className="absolute right-0 top-9 z-30 w-40 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          {player.status === "pendiente" ? (
            <form action={approvePlayerAction}>
              <input type="hidden" name="playerId" value={player.id} />
              <button
                type="submit"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-emerald-700 transition hover:bg-emerald-50"
              >
                <Check className="size-4" />
                Aprobar
              </button>
            </form>
          ) : null}

          <button
            type="button"
            onClick={() => {
              setEditOpen(true);
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
          >
            <Pencil className="size-4" />
            Editar
          </button>

          <form action={toggleRetiredPlayerAction}>
            <input type="hidden" name="playerId" value={player.id} />
            <input type="hidden" name="nextStatus" value={nextStatus} />
            <button
              type="submit"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-amber-50 hover:text-amber-700"
            >
              {isRetired ? (
                <Undo2 className="size-4" />
              ) : (
                <UserMinus className="size-4" />
              )}
              {retireLabel}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setDeleteOpen(true);
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-700 transition hover:bg-red-50"
          >
            <Trash2 className="size-4" />
            Eliminar
          </button>
        </div>
      ) : null}

      <EditPlayerDialog
        player={player}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <DeletePlayerDialog
        player={player}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </div>
  );
}
