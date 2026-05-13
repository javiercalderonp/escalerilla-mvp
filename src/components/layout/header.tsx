import { eq } from "drizzle-orm";
import { LogInIcon, LogOutIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { auth, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import { players } from "@/lib/db/schema";
import { AvailabilityToggle } from "./availability-toggle";
import { MobileNav } from "./mobile-nav";
import { NavLinks } from "./nav-links";

async function signOutAction() {
  "use server";

  await signOut({ redirectTo: "/" });
}

export async function Header() {
  const session = await auth();
  const isAdmin = session?.user?.role === "admin";
  const isPlayer =
    session?.user?.role === "player" || session?.user?.role === "admin";

  let wantsToPlayNextWeek = false;
  if (isPlayer && session?.user?.email && db) {
    const [player] = await db
      .select({ wantsToPlayNextWeek: players.wantsToPlayNextWeek })
      .from(players)
      .where(eq(players.email, session.user.email.toLowerCase()))
      .limit(1);
    wantsToPlayNextWeek = player?.wantsToPlayNextWeek ?? false;
  }

  const navItems = [
    { href: "/ranking/hombres", label: "Ranking" },
    { href: "/fixture", label: "Partidos" },
    ...(isPlayer
      ? [{ href: "/ingresar-resultado", label: "Ingresar resultado" }]
      : []),
    ...(isAdmin ? [{ href: "/admin/jugadores", label: "Jugadores" }] : []),
  ];

  const mobileNavItems = [
    ...navItems,
    ...(session?.user ? [] : [{ href: "/login", label: "Ingresar" }]),
  ];

  const profileItem = session?.user
    ? {
        href: "/mi-perfil",
        label: session.user.name ?? session.user.email ?? "Mi perfil",
      }
    : null;

  return (
    <header className="sticky top-0 z-50 bg-[#0d1b2a]">
      {/* Mobile layout: hamburger left | logo center | spacer right */}
      <div className="flex items-center px-4 py-3 md:hidden">
        <MobileNav
          items={mobileNavItems}
          profileItem={profileItem}
          signOutAction={session?.user ? signOutAction : undefined}
          availabilityToggle={
            isPlayer
              ? { isMarked: wantsToPlayNextWeek }
              : undefined
          }
        />
        <Link
          href="/"
          className="flex flex-1 items-center justify-center gap-3"
        >
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
        {session?.user ? (
          <form action={signOutAction} className="w-9 shrink-0">
            <button
              type="submit"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/70 transition hover:border-clay/50 hover:text-white"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
            >
              <LogOutIcon className="h-4 w-4" />
            </button>
          </form>
        ) : (
          <Link
            href="/login"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/70 transition hover:border-clay/50 hover:text-white"
            aria-label="Iniciar sesión"
          >
            <LogInIcon className="h-4 w-4" />
          </Link>
        )}
      </div>

      {/* Desktop layout */}
      <div className="mx-auto hidden w-full max-w-6xl items-center px-6 py-3 lg:px-8 md:flex">
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

        <nav className="flex flex-1 items-center justify-center gap-7 text-sm">
          <NavLinks items={navItems} />
          {session?.user && (
            <div className="group relative flex items-center gap-3">
              <Link
                href="/mi-perfil"
                className="max-w-48 truncate text-white/60 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/70 focus-visible:ring-offset-4 focus-visible:ring-offset-[#0d1b2a]"
              >
                {session.user.name ?? session.user.email}
              </Link>
              <span className="rounded-full bg-clay/20 px-3 py-1 text-xs font-medium text-clay">
                {session.user.role}
              </span>
              <div className="invisible absolute left-0 top-full z-50 min-w-48 pt-2 opacity-0 transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                <form
                  action={signOutAction}
                  className="rounded-lg border border-white/10 bg-[#142235] p-1 shadow-xl shadow-black/20"
                >
                  <button
                    type="submit"
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold text-white/85 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/70"
                  >
                    <LogOutIcon
                      className="size-4 text-clay"
                      aria-hidden="true"
                    />
                    Cerrar Sesion
                  </button>
                </form>
              </div>
            </div>
          )}
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          {isPlayer && (
            <AvailabilityToggle isMarked={wantsToPlayNextWeek} variant="desktop" />
          )}
          {!session?.user && (
            <Link
              href="/login"
              className="rounded-lg bg-clay px-4 py-2 text-sm font-semibold text-white transition hover:bg-clay/90"
            >
              Ingresar →
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
