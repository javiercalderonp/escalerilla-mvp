import { Trophy } from "lucide-react";
import Link from "next/link";

import { auth } from "@/lib/auth";
import { MobileNav } from "./mobile-nav";

export async function Header() {
  const session = await auth();
  const isAdmin = session?.user?.role === "admin";

  const navItems = [
    { href: "/ranking/hombres", label: "Ranking" },
    { href: "/fixture", label: "Fixture" },
    ...(session?.user
      ? [
          { href: "/mi-perfil", label: "Mi perfil" },
          { href: "/disponibilidad", label: "Disponibilidad" },
        ]
      : [{ href: "/login", label: "Ingresar" }]),
    ...(isAdmin
      ? [
          { href: "/admin/semanas", label: "Semanas" },
          { href: "/admin/partidos", label: "Partidos" },
          { href: "/admin/campeonatos", label: "Campeonatos" },
        ]
      : []),
  ];

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

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 text-sm text-slate-600 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="transition hover:text-slate-950"
            >
              {item.label}
            </Link>
          ))}
          {session?.user && (
            <div className="flex items-center gap-3">
              <span className="text-slate-500">
                {session.user.name ?? session.user.email}
              </span>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                {session.user.role}
              </span>
            </div>
          )}
        </nav>

        {/* Mobile nav */}
        <MobileNav items={navItems} />
      </div>
    </header>
  );
}
