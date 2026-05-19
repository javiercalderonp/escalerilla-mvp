"use client";

import { PrinterIcon } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export function AutoPrint() {
  useEffect(() => {
    window.print();
  }, []);

  return null;
}

export function PrintNowButton() {
  return (
    <Button type="button" onClick={() => window.print()}>
      <PrinterIcon className="size-4" aria-hidden="true" />
      Imprimir
    </Button>
  );
}
