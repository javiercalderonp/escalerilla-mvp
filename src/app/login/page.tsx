import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

export default function LoginPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 items-center px-4 py-10 sm:px-6">
      <div className="w-full rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5">
        <p className="text-sm font-medium text-emerald-700">Club La Dehesa</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          Ingresá con tu cuenta
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Accedé al ranking, declaré tu disponibilidad semanal, revisá el
          fixture y consultá tus partidos — todo en un lugar.
        </p>
        <div className="mt-6">
          <GoogleSignInButton />
        </div>
        <div className="mt-6 space-y-2 text-xs text-slate-400">
          <p>
            Solo socios con email registrado por el administrador pueden acceder.
            Si tu cuenta no aparece vinculada, contactá al organizador.
          </p>
        </div>
      </div>
    </div>
  );
}
