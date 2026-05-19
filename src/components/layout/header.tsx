import { eq, or } from "drizzle-orm";
import {
  CalendarClockIcon,
  FileTextIcon,
  LogInIcon,
  LogOutIcon,
  UserIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { auth, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import { players } from "@/lib/db/schema";
import { formatPersonName } from "@/lib/format/name";
import { AvailabilityToggle } from "./availability-toggle";
import { MobileNav } from "./mobile-nav";
import { NavLinks } from "./nav-links";

async function signOutAction() {
  "use server";

  await signOut({ redirectTo: "/" });
}

function getDisplayName({
  firstName,
  lastName,
  fullName,
  sessionName,
}: {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  sessionName?: string | null;
}) {
  const explicitName = [firstName, lastName]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" ");
  const candidate = explicitName || fullName?.trim() || sessionName?.trim();

  if (!candidate || candidate.includes("@")) return "Mi perfil";

  return formatPersonName(candidate);
}

export async function Header() {
  const session = await auth();
  const isAdmin = session?.user?.role === "admin";
  const isPlayer =
    session?.user?.role === "player" || session?.user?.role === "admin";

  let wantsToPlayNextWeek = false;
  let wantsMultipleMatches = false;
  let alwaysAvailable = false;
  let displayName = getDisplayName({ sessionName: session?.user?.name });
  if (isPlayer && session?.user?.email && db) {
    try {
      const [player] = await db
        .select({
          firstName: players.firstName,
          lastName: players.lastName,
          fullName: players.fullName,
          wantsToPlayNextWeek: players.wantsToPlayNextWeek,
          wantsMultipleMatches: players.wantsMultipleMatches,
          alwaysAvailable: players.alwaysAvailable,
        })
        .from(players)
        .where(
          or(
            session.user.playerId
              ? eq(players.id, session.user.playerId)
              : undefined,
            eq(players.email, session.user.email.toLowerCase()),
          ),
        )
        .limit(1);
      displayName = getDisplayName({
        firstName: player?.firstName,
        lastName: player?.lastName,
        fullName: player?.fullName,
        sessionName: session.user.name,
      });
      wantsToPlayNextWeek = player?.wantsToPlayNextWeek ?? false;
      wantsMultipleMatches = player?.wantsMultipleMatches ?? false;
      alwaysAvailable = player?.alwaysAvailable ?? false;
    } catch {
      // Column may not exist yet if migration is pending
    }
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
    ...(session?.user ? [{ href: "/reglamento", label: "Reglamento" }] : []),
    ...(session?.user ? [] : [{ href: "/login", label: "Ingresar" }]),
  ];

  const profileItem = session?.user
    ? {
        href: "/mi-perfil",
        label: displayName,
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
              ? {
                  isMarked: wantsToPlayNextWeek,
                  wantsMultipleMatches,
                  alwaysAvailable,
                }
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
                {displayName}
              </Link>
              {isAdmin && (
                <span className="rounded-full bg-clay/20 px-3 py-1 text-xs font-medium text-clay">
                  admin
                </span>
              )}
              <div className="invisible absolute left-0 top-full z-50 min-w-60 pt-2 opacity-0 transition group-hover:visible group-hover:opacity-100">
                <div className="rounded-lg border border-white/10 bg-[#142235] p-1 shadow-xl shadow-black/20">
                  <Link
                    href="/mi-perfil"
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold text-white/85 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/70"
                  >
                    <UserIcon className="size-4 text-clay" aria-hidden="true" />
                    Ver Perfil
                  </Link>
                  <Link
                    href="/disponibilidad"
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold text-white/85 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/70"
                  >
                    <CalendarClockIcon
                      className="size-4 text-clay"
                      aria-hidden="true"
                    />
                    Ajustar Disponibilidad
                  </Link>
                  <Link
                    href="/reglamento"
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold text-white/85 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/70"
                  >
                    <FileTextIcon
                      className="size-4 text-clay"
                      aria-hidden="true"
                    />
                    Ver Reglamento
                  </Link>
                  <form action={signOutAction}>
                    <button
                      type="submit"
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold text-white/85 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/70"
                    >
                      <LogOutIcon
                        className="size-4 text-clay"
                        aria-hidden="true"
                      />
                      Cerrar Sesión
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          {isPlayer && (
            <AvailabilityToggle
              isMarked={wantsToPlayNextWeek}
              wantsMultipleMatches={wantsMultipleMatches}
              alwaysAvailable={alwaysAvailable}
              variant="desktop"
            />
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
