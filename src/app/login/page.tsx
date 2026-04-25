export default function LoginPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 items-center px-4 py-10 sm:px-6">
      <div className="w-full rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5">
        <p className="text-sm font-medium text-emerald-700">Acceso</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          Inicia sesión para continuar
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          El acceso del MVP usará Google Sign-In. En esta etapa ya quedó preparado el
          esqueleto de autenticación y faltan las credenciales del entorno para activarlo.
        </p>
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
          Cuando estén disponibles AUTH_GOOGLE_ID y AUTH_GOOGLE_SECRET, este flujo quedará
          conectado a Auth.js.
        </div>
      </div>
    </div>
  );
}
