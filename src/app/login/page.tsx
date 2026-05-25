import Link from "next/link";
import { redirect } from "next/navigation";

import { signIn } from "@/lib/auth";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 items-center px-4 py-10 sm:px-6">
      <div className="w-full rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5">
        <p className="text-sm font-medium text-emerald-700">Club La Dehesa</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          Inicia sesión con tu cuenta
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Accede al ranking, declara tu disponibilidad semanal, revisa la
          programación y consulta tus partidos, todo en un solo lugar.
        </p>

        {error && (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error === "CredentialsSignin"
              ? "Email o contraseña incorrectos."
              : "Error al ingresar. Intenta de nuevo."}
          </p>
        )}

        <form
          className="mt-6 space-y-4"
          action={async (formData) => {
            "use server";
            try {
              await signIn("credentials", {
                email: formData.get("email"),
                password: formData.get("password"),
                redirectTo: "/onboarding",
              });
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              if (msg.includes("NEXT_REDIRECT")) throw e;
              redirect("/login?error=CredentialsSignin");
            }
          }}
        >
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-700"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700"
            >
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              placeholder="Tu contraseña"
            />
          </div>

          <button
            type="submit"
            className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Ingresar
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          ¿No tienes cuenta?{" "}
          <Link
            href="/register"
            className="font-medium text-emerald-700 hover:underline"
          >
            Crea una aquí
          </Link>
        </p>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs text-slate-400">
            <span className="bg-white px-3">o también puedes</span>
          </div>
        </div>

        <GoogleSignInButton />
      </div>
    </div>
  );
}
