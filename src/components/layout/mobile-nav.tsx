"use client";

import {
  BarChart2Icon,
  CalendarIcon,
  CheckCircle2,
  HomeIcon,
  LogInIcon,
  type LucideIcon,
  Menu,
  TrophyIcon,
  UserIcon,
  UsersIcon,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

type NavItem = { href: string; label: string };

const navIcons: Record<string, LucideIcon> = {
  "/": HomeIcon,
  "/ranking/hombres": BarChart2Icon,
  "/fixture": CalendarIcon,
  "/ingresar-resultado": CheckCircle2,
  "/admin/semanas": TrophyIcon,
  "/admin/jugadores": UsersIcon,
  "/login": LogInIcon,
  "/mi-perfil": UserIcon,
};

function iconForItem(item: NavItem) {
  return navIcons[item.href] ?? TrophyIcon;
}

export function MobileNav({
  items,
  profileItem,
}: {
  items: NavItem[];
  profileItem?: NavItem | null;
}) {
  const [open, setOpen] = useState(false);
  const loginItem = items.find((item) => item.href === "/login");
  const mainItems = items.filter((item) => item.href !== "/login");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/70 transition hover:border-clay/50 hover:text-white"
        aria-label="Abrir menú"
      >
        <Menu className="h-4 w-4" />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setOpen(false)}
            aria-label="Cerrar menú"
          />

          {/* Side drawer */}
          <div className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-[#0d1b2a] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <span className="text-sm font-semibold text-white">Menú</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-white/70 transition hover:border-clay/50 hover:text-white"
                aria-label="Cerrar menú"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav className="flex flex-1 flex-col py-2">
              {profileItem && (
                <Link
                  href={profileItem.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 border-b border-white/10 px-6 py-4 text-sm font-medium text-white transition hover:bg-white/5"
                >
                  <UserIcon className="size-4 shrink-0 text-clay" />
                  {profileItem.label}
                </Link>
              )}
              {mainItems.map((item) => {
                const Icon = iconForItem(item);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-6 py-4 text-sm text-white/60 transition hover:bg-white/5 hover:text-white"
                  >
                    <Icon className="size-4 shrink-0 text-white/45" />
                    {item.label}
                  </Link>
                );
              })}

              {loginItem && (
                <Link
                  href={loginItem.href}
                  onClick={() => setOpen(false)}
                  className="mt-auto flex items-center gap-3 border-t border-white/10 px-6 py-5 text-sm font-semibold text-white transition hover:bg-white/5"
                >
                  <LogInIcon className="size-4 shrink-0 text-clay" />
                  {loginItem.label}
                </Link>
              )}
            </nav>
          </div>
        </>
      )}
    </>
  );
}
