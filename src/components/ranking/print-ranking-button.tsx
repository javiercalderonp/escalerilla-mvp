"use client";

import {
  DownloadIcon,
  FileTextIcon,
  PrinterIcon,
  Share2Icon,
} from "lucide-react";
import { useState } from "react";

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
  const [isGenerating, setIsGenerating] = useState(false);

  function getPngFileName() {
    return `ranking-${categoryLabel.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.png`;
  }

  async function capturePngDataUrl() {
    const node = document.querySelector<HTMLElement>("[data-ranking-export]");
    if (!node) return null;

    const clone = node.cloneNode(true) as HTMLElement;
    const width = node.scrollWidth;
    clone.style.position = "fixed";
    clone.style.left = "-10000px";
    clone.style.top = "0";
    clone.style.width = `${width}px`;
    clone.style.maxWidth = "none";
    clone.style.setProperty("-webkit-text-size-adjust", "100%");
    clone.style.setProperty("text-size-adjust", "100%");
    clone.style.pointerEvents = "none";
    clone.style.zIndex = "-1";
    document.body.appendChild(clone);

    const { toPng } = await import("html-to-image");
    try {
      return await toPng(clone, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        width,
        height: clone.scrollHeight,
        style: {
          width: `${width}px`,
          maxWidth: "none",
        },
      });
    } finally {
      clone.remove();
    }
  }

  async function downloadPng() {
    setIsGenerating(true);
    try {
      const dataUrl = await capturePngDataUrl();
      if (!dataUrl) return;

      const link = document.createElement("a");
      link.download = getPngFileName();
      link.href = dataUrl;
      link.click();
    } finally {
      setIsGenerating(false);
    }
  }

  async function sharePng() {
    setIsGenerating(true);
    try {
      const dataUrl = await capturePngDataUrl();
      if (!dataUrl) return;

      const blob = await fetch(dataUrl).then((response) => response.blob());
      const file = new File([blob], getPngFileName(), { type: "image/png" });
      const title = `Ranking ${categoryLabel}`;

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title,
        });
        return;
      }

      if (navigator.share) {
        await navigator.share({
          title,
          text: "Ranking de la Escalerilla Tenis",
          url: window.location.href,
        });
        return;
      }

      const link = document.createElement("a");
      link.download = getPngFileName();
      link.href = dataUrl;
      link.click();
    } catch (error) {
      if (!(error instanceof Error) || error.name !== "AbortError") {
        console.error("Error compartiendo ranking:", error);
      }
    } finally {
      setIsGenerating(false);
    }
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
            Comparte el ranking como imagen, descárgalo en PNG o guárdalo como
            PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <button
            type="button"
            className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 text-left transition hover:border-court/40 hover:bg-muted disabled:cursor-wait disabled:opacity-60"
            onClick={sharePng}
            disabled={isGenerating}
          >
            <Share2Icon
              className="mt-0.5 size-4 text-court"
              aria-hidden="true"
            />
            <span>
              <span className="block text-sm font-semibold text-foreground">
                Compartir imagen
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Abre WhatsApp, AirDrop o la opción de guardar en Fotos si tu
                celular lo permite.
              </span>
            </span>
          </button>

          <button
            type="button"
            className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 text-left transition hover:border-court/40 hover:bg-muted disabled:cursor-wait disabled:opacity-60"
            onClick={downloadPng}
            disabled={isGenerating}
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
