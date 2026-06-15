"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cx } from "@nlr/ui";

const NAV = [
  { label: "Board", href: "/" },
  { label: "Allocation", href: "/allocation" },
  { label: "Bookings", href: "/bookings" },
  { label: "Subcontractor", href: "/subcontractor" },
  { label: "Roster", href: "/roster" },
];

export function NavLinks({ isManager }: { isManager: boolean }) {
  const pathname = usePathname();
  const nav = isManager ? [...NAV, { label: "Manage", href: "/manage" }] : NAV;

  return (
    <nav aria-label="Main" className="flex items-center gap-1 rounded-full bg-slate-100 p-1">
      {nav.map((item) => {
        const active =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "min-h-9 rounded-full px-4 py-1.5 text-sm font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
              active
                ? "bg-white text-brand-900 shadow-sm"
                : "text-slate-600 hover:text-brand-900",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
