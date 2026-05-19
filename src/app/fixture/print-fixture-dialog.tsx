"use client";

import { PrinterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type PrintFixtureDialogProps = {
  weekId: string;
};

const printOptions = [
  {
    scope: "matches",
    title: "Partidos de la semana",
    description: "Abre el fixture publicado para imprimirlo.",
  },
  {
    scope: "previous-results",
    title: "Resultados semana anterior",
    description: "Abre los resultados de la semana previa.",
  },
  {
    scope: "both",
    title: "Ambos",
    description: "Incluye fixture actual y resultados anteriores.",
  },
] as const;

export function PrintFixtureDialog({ weekId }: PrintFixtureDialogProps) {
  const openPrintPage = (scope: (typeof printOptions)[number]["scope"]) => {
    const params = new URLSearchParams({ week: weekId, scope });
    window.open(`/fixture/imprimir?${params.toString()}`, "_blank", "noopener");
  };

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm">
            <PrinterIcon className="size-3.5" aria-hidden="true" />
            Imprimir
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Imprimir semana</DialogTitle>
          <DialogDescription>
            Elegí qué documento querés abrir para imprimir o guardar como PDF.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {printOptions.map((option) => (
            <button
              key={option.scope}
              type="button"
              className="rounded-lg border border-border bg-card p-3 text-left transition hover:border-court/40 hover:bg-muted"
              onClick={() => openPrintPage(option.scope)}
            >
              <span className="block text-sm font-semibold text-foreground">
                {option.title}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {option.description}
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
