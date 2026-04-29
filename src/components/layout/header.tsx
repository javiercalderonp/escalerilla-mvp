import { Trophy } from "lucide-react";
import Link from "next/link";

import { auth } from "@/lib/auth";

export async function Header() {
  const session = await auth();

  return (
    <header className="border-b border-black/5 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold text-slate-900"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white">
            <Trophy className="h-4 w-4" />
          </span>
          Escalerilla La Dehesa
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-slate-600 md:flex">
          <Link
            href="/ranking/hombres"
            className="transition hover:text-slate-950"
          >
            Ranking
          </Link>
          <Link href="/fixture" className="transition hover:text-slate-950">
            Fixture
          </Link>
          {session?.user && (
            <>
              <Link
                href="/mi-perfil"
                className="transition hover:text-slate-950"
              >
                Mi perfil
              </Link>
              <Link
                href="/disponibilidad"
                className="transition hover:text-slate-950"
              >
                Disponibilidad
              </Link>
            </>
          )}
          {session?.user && (
            <Link href="/mi-perfil" className="transition hover:text-slate-950">
              Mi perfil
            </Link>
          )}
          {session?.user?.role === "admin" && (
            <Link
              href="/admin/semanas"
              className="transition hover:text-slate-950"
            >
              Semanas
            </Link>
          )}
          {session?.user?.role === "admin" && (
            <Link href="/admin/partidos" className="transition hover:text-slate-950">
              Partidos
            </Link>
          )}
          {session?.user ? (
            <div className="flex items-center gap-3">
              <span className="text-slate-500">
                {session.user.name ?? session.user.email}
              </span>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                {session.user.role}
              </span>
            </div>
          ) : (
            <Link href="/login" className="transition hover:text-slate-950">
              Ingresar
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
