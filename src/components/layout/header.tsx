import { Trophy } from "lucide-react";
import Link from "next/link";

import { auth } from "@/lib/auth";
import { MobileNav } from "./mobile-nav";

export async function Header() {
  const session = await auth();
  const isAdmin = session?.user?.role === "admin";

  const navItems = [
    { href: "/ranking/hombres", label: "Ranking" },
    { href: "/fixture", label: "Partidos" },
    ...(session?.user ? [] : [{ href: "/login", label: "Ingresar" }]),
    ...(isAdmin
      ? [
          { href: "/admin/semanas", label: "Programación" },
          { href: "/admin/jugadores", label: "Jugadores" },
        ]
      : []),
  ];

  return (
    <header className="border-b border-border/80 bg-card/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-3 font-semibold text-foreground"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-court text-court-foreground shadow-sm">
            <Trophy className="h-4 w-4" />
          </span>
          <span className="tracking-tight">Escalerilla La Dehesa</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="transition hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
          {session?.user && (
            <div className="flex items-center gap-3">
              <Link
                href="/mi-perfil"
                className="max-w-48 truncate text-muted-foreground transition hover:text-foreground"
              >
                {session.user.name ?? session.user.email}
              </Link>
              <span className="rounded-full bg-court/10 px-3 py-1 text-xs font-medium text-court">
                {session.user.role}
              </span>
            </div>
          )}
        </nav>

        <MobileNav
          items={navItems}
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
