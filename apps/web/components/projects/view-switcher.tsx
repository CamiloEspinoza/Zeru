"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import { DashboardSpeed02Icon, Menu01Icon, Settings02Icon } from "@hugeicons/core-free-icons";

interface ViewSwitcherProps {
  projectId: string;
}

export function ViewSwitcher({ projectId }: ViewSwitcherProps) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;

  const views = [
    { href: `${base}/board`, label: "Board", icon: DashboardSpeed02Icon },
    { href: `${base}/list`, label: "Lista", icon: Menu01Icon },
    { href: `${base}/settings`, label: "Configuración", icon: Settings02Icon },
  ];

  return (
    <nav className="flex items-center gap-1 border-b">
      {views.map((view) => {
        const active = pathname === view.href;
        return (
          <Link
            key={view.href}
            href={view.href}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <HugeiconsIcon icon={view.icon} className="size-4" />
            {view.label}
          </Link>
        );
      })}
    </nav>
  );
}
