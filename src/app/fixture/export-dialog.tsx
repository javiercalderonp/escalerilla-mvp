"use client";

import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const exportOptions = [
  {
    type: "proximos",
    title: "Próximos Partidos",
    description: "Partidos programados para los próximos 8 días. Ideal para compartir el fixture de la semana.",
    emoji: "📅",
  },
  {
    type: "resultados",
    title: "Resultados Recientes",
    description: "Resultados confirmados de los últimos 8 días agrupados por día.",
    emoji: "🏆",
  },
] as const;

export function ExportDialog() {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm">
            <Share2 className="size-3.5" aria-hidden="true" />
            Exportar
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar</DialogTitle>
          <DialogDescription>
            Genera una imagen o PDF optimizado para compartir por WhatsApp.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {exportOptions.map((option) => (
            <button
              key={option.type}
              type="button"
              className="rounded-lg border border-border bg-card p-4 text-left transition hover:border-court/40 hover:bg-muted"
              onClick={() =>
                window.open(
                  `/fixture/exportar?type=${option.type}`,
                  "_blank",
                  "noopener",
                )
              }
            >
              <div className="flex items-start gap-3">
                <span className="text-xl leading-none">{option.emoji}</span>
                <div>
                  <span className="block text-sm font-semibold text-foreground">
                    {option.title}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {option.description}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
