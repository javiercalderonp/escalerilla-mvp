import { DownloadIcon, ExternalLinkIcon, FileTextIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

const reglamentoUrl = "/reglamento-escalerilla-2026.pdf";

export const metadata: Metadata = {
  title: "Reglamento | Escalerilla La Dehesa",
  description: "Reglamento oficial de la Escalerilla de Tenis 2026.",
};

export default function ReglamentoPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8 lg:py-9">
      <section className="rounded-3xl border border-white/70 bg-card/95 p-5 shadow-2xl shadow-court/10 ring-1 ring-border/70 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-5">
            <div className="inline-flex size-16 shrink-0 items-center justify-center rounded-2xl bg-clay/10 text-clay ring-1 ring-clay/15">
              <FileTextIcon className="size-8" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium text-clay">
                Club de Golf La Dehesa
              </p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
                Reglamento Escalerilla 2026
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                Reglamento oficial de la escalerilla de tenis.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={reglamentoUrl}
              target="_blank"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted"
            >
              <ExternalLinkIcon className="size-4" aria-hidden="true" />
              Abrir PDF
            </Link>
            <Link
              href={reglamentoUrl}
              download
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-clay px-4 py-2 text-sm font-semibold text-white transition hover:bg-clay/90"
            >
              <DownloadIcon className="size-4" aria-hidden="true" />
              Descargar
            </Link>
          </div>
        </div>
      </section>

      <section className="min-h-[70vh] overflow-hidden rounded-3xl border border-white/70 bg-card shadow-2xl shadow-court/10 ring-1 ring-border/70">
        <object
          data={reglamentoUrl}
          type="application/pdf"
          className="h-[78vh] min-h-[620px] w-full"
        >
          <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 p-8 text-center">
            <p className="max-w-md text-sm text-muted-foreground">
              Tu navegador no puede mostrar el PDF embebido.
            </p>
            <Link
              href={reglamentoUrl}
              target="_blank"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-clay px-4 py-2 text-sm font-semibold text-white transition hover:bg-clay/90"
            >
              <ExternalLinkIcon className="size-4" aria-hidden="true" />
              Abrir reglamento
            </Link>
          </div>
        </object>
      </section>
    </main>
  );
}
