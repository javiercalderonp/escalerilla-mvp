"use client";

import {
  DownloadIcon,
  FileTextIcon,
  PrinterIcon,
  Share2Icon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type PrintRankingButtonProps = {
  categoryLabel: string;
  className?: string;
};

export function PrintRankingButton({
  categoryLabel,
  className,
}: PrintRankingButtonProps) {
  async function downloadPng() {
    const node = document.querySelector<HTMLElement>("[data-ranking-export]");
    if (!node) return;

    const { toPng } = await import("html-to-image");
    const dataUrl = await toPng(node, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: "#ffffff",
    });

    const link = document.createElement("a");
    link.download = `ranking-${categoryLabel.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = dataUrl;
    link.click();
  }

  function printRanking() {
    window.print();
  }

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="lg"
            className={cn(
              "border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white",
              className,
            )}
            title={`Exportar ranking ${categoryLabel}`}
          >
            <Share2Icon className="size-4" aria-hidden="true" />
            Exportar
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar ranking</DialogTitle>
          <DialogDescription>
            Descarga el ranking en PNG, guárdalo como PDF o imprímelo.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <button
            type="button"
            className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 text-left transition hover:border-court/40 hover:bg-muted"
            onClick={downloadPng}
          >
            <DownloadIcon
              className="mt-0.5 size-4 text-court"
              aria-hidden="true"
            />
            <span>
              <span className="block text-sm font-semibold text-foreground">
                PNG
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Imagen en una página con dos columnas.
              </span>
            </span>
          </button>

          <button
            type="button"
            className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 text-left transition hover:border-court/40 hover:bg-muted"
            onClick={printRanking}
          >
            <FileTextIcon
              className="mt-0.5 size-4 text-court"
              aria-hidden="true"
            />
            <span>
              <span className="block text-sm font-semibold text-foreground">
                PDF
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Usa “Guardar como PDF” en el diálogo del navegador.
              </span>
            </span>
          </button>

          <button
            type="button"
            className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 text-left transition hover:border-court/40 hover:bg-muted"
            onClick={printRanking}
          >
            <PrinterIcon
              className="mt-0.5 size-4 text-court"
              aria-hidden="true"
            />
            <span>
              <span className="block text-sm font-semibold text-foreground">
                Imprimir
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Abre la versión lista para una hoja.
              </span>
            </span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
