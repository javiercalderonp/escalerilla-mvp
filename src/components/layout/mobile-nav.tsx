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
    <div className="relative md:hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/70 transition hover:border-clay/50 hover:text-white"
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
      >
        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-11 z-20 w-52 rounded-2xl border border-white/10 bg-[#0d1b2a] py-2 shadow-lg">
            {profileItem ? (
              <Link
                href={profileItem.href}
                onClick={() => setOpen(false)}
                className="block border-b border-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/5"
              >
                {profileItem.label}
              </Link>
            ) : null}
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 text-sm text-white/60 transition hover:bg-white/5 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
