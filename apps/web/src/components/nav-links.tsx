"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 text-sm">
      {items.map((item) => {
        const active =
          item.href === pathname ||
          (item.href !== "/admin" && item.href !== "/teacher" && item.href !== "/parent" && pathname.startsWith(item.href + "/")) ||
          (item.href === "/admin/students" && pathname.startsWith("/admin/students"));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-md px-3 py-1.5 transition-colors ${
              active
                ? "bg-teal-50 font-medium text-teal-800"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
