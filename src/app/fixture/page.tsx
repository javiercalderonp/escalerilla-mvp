export default function FixturePage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <div className="w-full rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5">
        <p className="text-sm font-medium text-emerald-700">Fixture</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          Semana actual
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Esta vista mostrará el fixture publicado por categoría y destacará los partidos del
          jugador autenticado. Queda lista para conectarse con la capa de semanas y matches.
        </p>
      </div>
    </div>
  );
}
