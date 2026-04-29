import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 items-center px-4 py-20 sm:px-6">
      <div className="w-full text-center">
        <p className="text-sm font-medium text-emerald-700">Error 404</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          Página no encontrada
        </h1>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          La página que buscás no existe o fue movida.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/"
            className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            Volver al inicio
          </Link>
          <Link
            href="/ranking/hombres"
            className="rounded-full border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400"
          >
            Ver ranking
          </Link>
        </div>
      </div>
    </div>
  );
}
