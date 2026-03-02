"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const nav = [
  {
    group: "Introducción",
    items: [
      { label: "Getting Started", href: "/docs" },
      { label: "Autenticación", href: "/docs/authentication" },
      { label: "Rate Limiting", href: "/docs/rate-limits" },
      { label: "Errores", href: "/docs/errors" },
    ],
  },
  {
    group: "Endpoints",
    items: [
      { label: "Plan de Cuentas", href: "/docs/accounts" },
      { label: "Asientos Contables", href: "/docs/journal-entries" },
      { label: "Períodos Fiscales", href: "/docs/fiscal-periods" },
      { label: "Reportes", href: "/docs/reports" },
    ],
  },
  {
    group: "Guías",
    items: [
      { label: "Obtener credenciales", href: "/docs/setup-credentials" },
    ],
  },
];

export function DocsNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-6">
      {nav.map((section) => (
        <div key={section.group}>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-2 px-2">
            {section.group}
          </p>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const isActive =
                item.href === "/docs"
                  ? pathname === "/docs"
                  : pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "block rounded-md px-2 py-1.5 text-sm transition-colors",
                      isActive
                        ? "bg-white/10 text-white font-medium"
                        : "text-white/50 hover:text-white/80 hover:bg-white/5"
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
