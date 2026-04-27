import { signIn } from "@/lib/auth";

export function GoogleSignInButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("google", {
          redirectTo: "/",
        });
      }}
    >
      <button
        type="submit"
        className="inline-flex w-full items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
      >
        Entrar con Google
      </button>
    </form>
  );
}
