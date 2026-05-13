"use client";

import { CalendarCheck2, CalendarPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { setNextWeekAvailabilityAction } from "@/app/disponibilidad/actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function AvailabilityToggle({
  isMarked,
  variant = "desktop",
  onClose,
}: {
  isMarked: boolean;
  variant?: "desktop" | "mobile";
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleOpen() {
    setOpen(true);
  }

  function handleConfirm() {
    startTransition(async () => {
      await setNextWeekAvailabilityAction(!isMarked);
      setOpen(false);
      onClose?.();
      if (!isMarked) {
        router.push("/disponibilidad");
      }
      router.refresh();
    });
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
          isPending={isPending}
          onConfirm={handleConfirm}
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
        isPending={isPending}
        onConfirm={handleConfirm}
      />
    </>
  );
}

function AvailabilityDialog({
  open,
  onOpenChange,
  isMarked,
  isPending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMarked: boolean;
  isPending: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-sm">
        <DialogHeader>
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-clay/10">
            {isMarked ? (
              <CalendarCheck2 className="size-6 text-emerald-400" />
            ) : (
              <CalendarPlus className="size-6 text-clay" />
            )}
          </div>
          <DialogTitle className="text-center text-base">
            {isMarked
              ? "Estás disponible para la próxima semana"
              : "¿Disponible para la próxima semana?"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {isMarked
              ? "El admin ya te tiene en la lista de programación. ¿Quieres retirarte?"
              : "¿Quieres marcarte como disponible para jugar la próxima semana? Quedarás en la lista para la programación."}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="border-t-0 bg-transparent px-0 pb-0 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className={`inline-flex h-10 flex-1 items-center justify-center rounded-xl px-5 text-sm font-semibold transition disabled:opacity-60 sm:flex-none sm:min-w-32 ${
              isMarked
                ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                : "bg-clay text-white hover:bg-clay/90"
            }`}
          >
            {isPending
              ? "Guardando..."
              : isMarked
                ? "Sí, retirarme"
                : "Sí, quiero jugar"}
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            className="inline-flex h-10 flex-1 items-center justify-center rounded-xl border border-border bg-background px-5 text-sm font-semibold text-muted-foreground transition hover:text-foreground disabled:opacity-60 sm:flex-none sm:min-w-24"
          >
            No
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
