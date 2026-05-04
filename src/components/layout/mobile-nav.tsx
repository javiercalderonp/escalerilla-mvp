"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

type NavItem = { href: string; label: string };

export function MobileNav({
  items,
  profileItem,
}: {
  items: NavItem[];
  profileItem?: NavItem | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/70 transition hover:border-clay/50 hover:text-white"
        aria-label="Abrir menú"
      >
        <Menu className="h-4 w-4" />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setOpen(false)}
          />

          {/* Side drawer */}
          <div className="fixed inset-y-0 left-0 z-50 w-72 bg-[#0d1b2a] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <span className="text-sm font-semibold text-white">Menú</span>
              <button
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-white/70 transition hover:border-clay/50 hover:text-white"
                aria-label="Cerrar menú"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav className="flex flex-col py-2">
              {profileItem && (
                <Link
                  href={profileItem.href}
                  onClick={() => setOpen(false)}
                  className="border-b border-white/10 px-6 py-4 text-sm font-medium text-white transition hover:bg-white/5"
                >
                  {profileItem.label}
                </Link>
              )}
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="px-6 py-4 text-sm text-white/60 transition hover:bg-white/5 hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </>
      )}
    </>
  );
}
