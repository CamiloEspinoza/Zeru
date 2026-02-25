"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DashboardSquare01Icon,
  AiChat02Icon,
  File02Icon,
  BookOpen01Icon,
  Settings02Icon,
  PaintBrush04Icon,
  Building06Icon,
  UserMultipleIcon,
  ArrowRight01Icon,
  CheckListIcon,
  Key01Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";

interface NavSubItem {
  title: string;
  href: string;
}

interface NavItem {
  title: string;
  href: string;
  icon: IconSvgElement;
  items?: NavSubItem[];
}

const appNav: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: DashboardSquare01Icon },
  { title: "Asistente", href: "/assistant/new", icon: AiChat02Icon },
  { title: "Documentos", href: "/documents", icon: File02Icon },
  {
    title: "Contabilidad",
    href: "/accounting",
    icon: BookOpen01Icon,
    items: [
      { title: "Plan de Cuentas", href: "/accounting/chart-of-accounts" },
      { title: "Asientos", href: "/accounting/journal" },
      { title: "Períodos Fiscales", href: "/accounting/periods" },
      { title: "Reportes", href: "/accounting/reports" },
    ],
  },
];

const settingsNav: NavItem[] = [
  { title: "General", href: "/settings", icon: Settings02Icon },
  { title: "Apariencia", href: "/settings/appearance", icon: PaintBrush04Icon },
  { title: "Organización", href: "/settings/organization", icon: Building06Icon },
  { title: "Usuarios", href: "/settings/users", icon: UserMultipleIcon },
  { title: "Asistente IA", href: "/settings/ai", icon: AiChat02Icon },
  { title: "Memoria", href: "/settings/ai/memory", icon: AiChat02Icon },
  { title: "Skills", href: "/settings/ai/skills", icon: AiChat02Icon },
  { title: "Proceso Contable", href: "/settings/accounting-process", icon: CheckListIcon },
  { title: "API Keys", href: "/settings/api-keys", icon: Key01Icon },
];

export function NavMain() {
  const pathname = usePathname();
  const router = useRouter();
  const isSettings = pathname.startsWith("/settings");
  const items = isSettings ? settingsNav : appNav;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>
        {isSettings ? "Configuración" : "Aplicación"}
      </SidebarGroupLabel>
      <SidebarMenu>
        {isSettings && (
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => router.push("/dashboard")}
              tooltip="Volver a la app"
              className="text-muted-foreground"
            >
              <HugeiconsIcon icon={ArrowRight01Icon} className="rotate-180" />
              <span>Volver a la app</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )}

        {items.map((item) =>
          item.items ? (
            <Collapsible
              key={item.title}
              asChild
              defaultOpen={pathname.startsWith(item.href)}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip={item.title}>
                    <HugeiconsIcon icon={item.icon} />
                    <span>{item.title}</span>
                    <HugeiconsIcon
                      icon={ArrowRight01Icon}
                      className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
                    />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {item.items.map((sub) => {
                      const isActive = pathname === sub.href;
                      return (
                        <SidebarMenuSubItem key={sub.title}>
                          <SidebarMenuSubButton asChild isActive={isActive}>
                            <Link href={sub.href}>
                              <span>{sub.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      );
                    })}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          ) : (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                isActive={
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : item.href === "/assistant/new"
                    ? pathname.startsWith("/assistant")
                    : item.href === "/settings/ai"
                    ? pathname === "/settings/ai"
                    : pathname === item.href || pathname.startsWith(item.href + "/")
                }
                tooltip={item.title}
              >
                <Link href={item.href}>
                  <HugeiconsIcon icon={item.icon} />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        )}
      </SidebarMenu>
    </SidebarGroup>
  );
}
