"use client";

import { PrinterIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PrintRankingButtonProps = {
  categoryLabel: string;
  className?: string;
};

export function PrintRankingButton({
  categoryLabel,
  className,
}: PrintRankingButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className={cn(
        "border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white",
        className,
      )}
      onClick={() => window.print()}
      title={`Imprimir ranking ${categoryLabel} o guardarlo como PDF`}
    >
      <PrinterIcon className="size-4" aria-hidden="true" />
      Imprimir PDF
    </Button>
  );
}
