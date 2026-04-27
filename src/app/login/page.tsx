import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

export default function LoginPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 items-center px-4 py-10 sm:px-6">
      <div className="w-full rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5">
        <p className="text-sm font-medium text-emerald-700">Acceso</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          Inicia sesión para continuar
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Entra con tu cuenta Google para ver el ranking, fixture y las herramientas del club.
        </p>
        <div className="mt-6">
          <GoogleSignInButton />
        </div>
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          El flujo ya está conectado a Google Auth. Si el deploy aún no tiene variables cargadas en
          Vercel, el siguiente paso es completar ese entorno para habilitar producción.
        </div>
      </div>
    </div>
  );
}
