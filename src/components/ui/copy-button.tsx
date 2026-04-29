"use client";

import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="mt-3 rounded-full border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-700 transition hover:border-emerald-400 hover:bg-emerald-50"
    >
      {copied ? "¡Copiado!" : "Copiar mensaje"}
    </button>
  );
}
