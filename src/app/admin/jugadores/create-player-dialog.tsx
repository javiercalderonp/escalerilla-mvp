"use client";

import { Check, Loader2, Plus } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { createPlayerAction } from "@/app/admin/jugadores/actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-500";

function SaveToast({
  status,
  onDismiss,
}: {
  status: "saving" | "saved";
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (status !== "saved") return;
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
  }, [status, onDismiss]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl bg-slate-950 px-4 py-3 text-sm font-medium text-white shadow-lg">
      {status === "saving" ? (
        <Loader2 className="size-4 animate-spin text-slate-400" />
      ) : (
        <Check className="size-4 text-emerald-400" />
      )}
      {status === "saving" ? "Guardando..." : "Jugador guardado exitosamente"}
    </div>
  );
}

export function CreatePlayerDialog() {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<"saving" | "saved" | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setOpen(false);
    setToast("saving");
    startTransition(async () => {
      await createPlayerAction(formData);
      setToast("saved");
    });
  }

  return (
    <>
      {toast !== null && (
        <SaveToast status={toast} onDismiss={() => setToast(null)} />
      )}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-slate-950/20"
      >
        <Plus className="size-5" />
        Nuevo jugador
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Agregar jugador</DialogTitle>
            <DialogDescription>
              Crea un alta individual para el plantel.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-700 sm:col-span-2">
                <span className="font-medium">Nombre completo</span>
                <input
                  name="fullName"
                  required
                  className={inputClass}
                />
              </label>

              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-medium">Email</span>
                <input name="email" type="email" className={inputClass} />
              </label>

              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-medium">Categoría</span>
                <select name="gender" defaultValue="M" className={inputClass}>
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
                  defaultValue={0}
                  className={inputClass}
                />
              </label>

              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-medium">Nivel</span>
                <select name="level" defaultValue="" className={inputClass}>
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
                  defaultValue="activo"
                  className={inputClass}
                >
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
                  className={inputClass}
                />
              </label>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                Guardar jugador
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
