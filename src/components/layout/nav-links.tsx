"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string };

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`border-b-2 pb-0.5 transition ${
            isActive(item.href)
              ? "border-clay text-white"
              : "border-transparent text-white/60 hover:text-white"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </>
  );
}
