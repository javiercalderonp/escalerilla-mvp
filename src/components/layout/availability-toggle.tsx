"use client";

import { CalendarCheck2, CalendarPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { setNextWeekAvailabilityAction } from "@/app/disponibilidad/actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function AvailabilityToggle({
  isMarked,
  wantsMultipleMatches = false,
  alwaysAvailable = false,
  variant = "desktop",
  onClose,
}: {
  isMarked: boolean;
  wantsMultipleMatches?: boolean;
  alwaysAvailable?: boolean;
  variant?: "desktop" | "mobile";
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleOpen() {
    setError(null);
    setOpen(true);
  }

  async function handleConfirm(
    wantsToPlay: boolean,
    wantsMultiple: boolean,
    alwaysAvail: boolean,
  ) {
    setIsSaving(true);
    setError(null);

    try {
      await setNextWeekAvailabilityAction(wantsToPlay, wantsMultiple, alwaysAvail);
      setOpen(false);
      onClose?.();
      if (wantsToPlay) {
        router.push("/disponibilidad");
      }
      router.refresh();
    } catch {
      setError("No se pudo guardar. Inténtalo de nuevo.");
    } finally {
      setIsSaving(false);
    }
  }

  if (variant === "mobile") {
    return (
      <>
        <button
          type="button"
          onClick={handleOpen}
          className={`flex w-full items-center gap-3 px-6 py-4 text-sm transition hover:bg-white/5 ${
            isMarked
              ? "text-emerald-400 hover:text-emerald-300"
              : "text-white/60 hover:text-white"
          }`}
        >
          {isMarked ? (
            <CalendarCheck2 className="size-4 shrink-0 text-emerald-400" />
          ) : (
            <CalendarPlus className="size-4 shrink-0 text-white/45" />
          )}
          {isMarked ? "Disponible próxima semana ✓" : "Marcarme disponible"}
        </button>

        <AvailabilityDialog
          open={open}
          onOpenChange={setOpen}
          isMarked={isMarked}
          isPending={isSaving}
          error={error}
          onConfirm={handleConfirm}
          wantsMultipleMatches={wantsMultipleMatches}
          alwaysAvailable={alwaysAvailable}
        />
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
          isMarked
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
            : "border-white/20 bg-white/5 text-white/60 hover:border-clay/50 hover:text-white"
        }`}
      >
        {isMarked ? (
          <CalendarCheck2 className="size-3.5" />
        ) : (
          <CalendarPlus className="size-3.5" />
        )}
        {isMarked ? "Disponible" : "Disponibilidad"}
      </button>

      <AvailabilityDialog
        open={open}
        onOpenChange={setOpen}
        isMarked={isMarked}
        isPending={isSaving}
        error={error}
        onConfirm={handleConfirm}
        wantsMultipleMatches={wantsMultipleMatches}
        alwaysAvailable={alwaysAvailable}
      />
    </>
  );
}

function AvailabilityDialog({
  open,
  onOpenChange,
  isMarked,
  isPending,
  error,
  onConfirm,
  wantsMultipleMatches: initialWantsMultiple,
  alwaysAvailable: initialAlwaysAvailable,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMarked: boolean;
  isPending: boolean;
  error: string | null;
  onConfirm: (
    wantsToPlay: boolean,
    wantsMultiple: boolean,
    alwaysAvailable: boolean,
  ) => void | Promise<void>;
  wantsMultipleMatches: boolean;
  alwaysAvailable: boolean;
}) {
  const [wantsToPlay, setWantsToPlay] = useState(true);
  const [wantsMultiple, setWantsMultiple] = useState(initialWantsMultiple);
  const [alwaysAvail, setAlwaysAvail] = useState(initialAlwaysAvailable);

  useEffect(() => {
    if (open) {
      setWantsToPlay(true);
      setWantsMultiple(initialWantsMultiple);
      setAlwaysAvail(initialAlwaysAvailable);
    }
  }, [open, initialWantsMultiple, initialAlwaysAvailable]);

  function updateWantsToPlay(nextWantsToPlay: boolean) {
    setWantsToPlay(nextWantsToPlay);
    if (!nextWantsToPlay) {
      setWantsMultiple(false);
      setAlwaysAvail(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[min(calc(100%-2rem),26rem)] gap-4 rounded-2xl bg-white p-5 text-slate-950"
      >
        <DialogHeader className="gap-2">
          <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-clay/10">
            {isMarked ? (
              <CalendarCheck2 className="size-5 text-emerald-400" />
            ) : (
              <CalendarPlus className="size-5 text-clay" />
            )}
          </div>
          <DialogTitle className="text-center text-base font-semibold leading-snug">
            {isMarked
              ? "¿Cambiar tu disponibilidad?"
              : "¿Disponible para la próxima semana?"}
          </DialogTitle>
          <DialogDescription className="text-center text-sm leading-relaxed text-slate-600">
            {isMarked
              ? "Elige si sigues en la lista o si no estás disponible para la programación."
              : "Quedarás en la lista para que el admin te programe la próxima semana."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col divide-y divide-slate-200 rounded-xl border border-slate-200 bg-slate-50">
          <label className="flex cursor-pointer items-start gap-3 p-3.5">
            <input
              type="checkbox"
              checked={wantsToPlay}
              onChange={(e) => updateWantsToPlay(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-clay"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium leading-snug text-slate-950">
                Sí, quiero jugar
              </span>
              <span className="text-xs leading-relaxed text-slate-500">
                Me pueden considerar para la próxima semana.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 p-3.5">
            <input
              type="checkbox"
              checked={!wantsToPlay}
              onChange={(e) => updateWantsToPlay(!e.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-clay"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium leading-snug text-slate-950">
                No estoy disponible
              </span>
              <span className="text-xs leading-relaxed text-slate-500">
                Quedo fuera de la programación de la próxima semana.
              </span>
            </span>
          </label>
        </div>

        {wantsToPlay && (
          <div className="flex flex-col divide-y divide-slate-200 rounded-xl border border-slate-200 bg-slate-50">
            <label className="flex cursor-pointer items-start gap-3 p-3.5">
              <input
                type="checkbox"
                checked={wantsMultiple}
                onChange={(e) => setWantsMultiple(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-clay"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium leading-snug text-slate-950">
                  Jugar más de un partido
                </span>
                <span className="text-xs leading-relaxed text-slate-500">
                  Si hay jugadores impares, puedo entrar dos veces.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 p-3.5">
              <input
                type="checkbox"
                checked={alwaysAvail}
                onChange={(e) => setAlwaysAvail(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-clay"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium leading-snug text-slate-950">
                  Disponible automáticamente
                </span>
                <span className="text-xs leading-relaxed text-slate-500">
                  Marcarme disponible cada semana sin tener que confirmarlo.
                </span>
              </span>
            </label>
          </div>
        )}

        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-center text-xs text-red-400">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            className="flex h-10 flex-1 items-center justify-center rounded-xl border border-slate-200 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-950 disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirm(wantsToPlay, wantsMultiple, alwaysAvail)}
            disabled={isPending}
            className={`flex h-10 flex-1 items-center justify-center rounded-xl text-sm font-semibold transition disabled:opacity-60 ${
              !wantsToPlay
                ? "bg-red-500/15 text-red-400 hover:bg-red-500/25"
                : "bg-clay text-white hover:bg-clay/90"
            }`}
          >
            {isPending
              ? "Guardando..."
              : !wantsToPlay
                ? "Guardar no disponible"
                : "Sí, quiero jugar"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
