"use client";

import { CalendarPlus, ChevronDown, Swords } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = {
  href: string;
  label: string;
  children?: {
    href: string;
    label: string;
    icon?: "calendar-plus" | "swords";
  }[];
};

const childIcons = {
  "calendar-plus": CalendarPlus,
  swords: Swords,
};

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <>
      {items.map((item) => (
        <div key={item.href} className="group relative">
          <Link
            href={item.href}
            className={`flex items-center gap-1 border-b-2 pb-0.5 transition ${
              isActive(item.href)
                ? "border-clay text-white"
                : "border-transparent text-white/60 hover:text-white"
            }`}
          >
            {item.label}
            {item.children ? (
              <ChevronDown
                className="size-3.5 transition group-hover:rotate-180"
                aria-hidden="true"
              />
            ) : null}
          </Link>
          {item.children ? (
            <div className="invisible absolute left-1/2 top-full z-50 min-w-56 -translate-x-1/2 pt-3 opacity-0 transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
              <div className="rounded-lg border border-white/10 bg-[#142235] p-1 shadow-xl shadow-black/20">
                {item.children.map((child) => {
                  const Icon = child.icon ? childIcons[child.icon] : null;

                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold text-white/85 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/70"
                    >
                      {Icon ? (
                        <Icon
                          className="size-4 text-clay"
                          aria-hidden="true"
                        />
                      ) : null}
                      {child.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ))}
    </>
  );
}
