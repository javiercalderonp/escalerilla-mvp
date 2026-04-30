"use client";

import Link from "next/link";

export default function AppError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 items-center px-4 py-20 sm:px-6">
      <div className="w-full text-center">
        <p className="text-sm font-medium text-rose-600">Error inesperado</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          Algo salió mal
        </h1>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          Ocurrió un error inesperado. Podés intentar de nuevo o volver al
          inicio.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            Intentar de nuevo
          </button>
          <Link
            href="/"
            className="rounded-full border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400"
          >
            Ir al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
