import Image from "next/image";
import Link from "next/link";

import { auth } from "@/lib/auth";
import { MobileNav } from "./mobile-nav";
import { NavLinks } from "./nav-links";

export async function Header() {
  const session = await auth();
  const isAdmin = session?.user?.role === "admin";

  const navItems = [
    { href: "/", label: "Inicio" },
    { href: "/ranking/hombres", label: "Ranking" },
    { href: "/fixture", label: "Partidos" },
    ...(isAdmin
      ? [
          { href: "/admin/semanas", label: "Programación" },
          { href: "/admin/jugadores", label: "Jugadores" },
        ]
      : []),
  ];

  return (
    <header className="relative z-10 bg-[#0d1b2a]">
      <div className="mx-auto flex w-full max-w-6xl items-center px-4 py-3 sm:px-6">
        {/* Logo + club name */}
        <Link href="/" className="flex shrink-0 items-center gap-3">
          <Image
            src="/logo.png"
            alt="Club La Dehesa"
            width={44}
            height={44}
            className="object-contain"
          />
          <div className="flex flex-col leading-none">
            <span className="text-sm font-bold tracking-wide text-white">
              CLUB DE GOLF LA DEHESA
            </span>
            <span className="text-[11px] font-bold tracking-widest text-clay">
              ESCALERILLA TENIS
            </span>
          </div>
        </Link>

        {/* Nav centered */}
        <nav className="hidden flex-1 items-center justify-center gap-7 text-sm md:flex">
          <NavLinks items={navItems} />
          {session?.user && (
            <div className="flex items-center gap-3">
              <Link
                href="/mi-perfil"
                className="max-w-48 truncate text-white/60 transition hover:text-white"
              >
                {session.user.name ?? session.user.email}
              </Link>
              <span className="rounded-full bg-clay/20 px-3 py-1 text-xs font-medium text-clay">
                {session.user.role}
              </span>
            </div>
          )}
        </nav>

        {/* Right: Ingresar button */}
        <div className="hidden shrink-0 md:flex">
          {session?.user ? null : (
            <Link
              href="/login"
              className="rounded-lg bg-clay px-4 py-2 text-sm font-semibold text-white transition hover:bg-clay/90"
            >
              Ingresar →
            </Link>
          )}
        </div>

        <MobileNav
          items={[
            ...navItems,
            ...(session?.user ? [] : [{ href: "/login", label: "Ingresar" }]),
          ]}
          profileItem={
            session?.user
              ? {
                  href: "/mi-perfil",
                  label: session.user.name ?? session.user.email ?? "Mi perfil",
                }
              : null
          }
        />
      </div>
    </header>
  );
}
