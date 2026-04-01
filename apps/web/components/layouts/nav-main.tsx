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
  Building03Icon,
  Building06Icon,
  UserMultipleIcon,
  ArrowRight01Icon,
  CheckListIcon,
  Key01Icon,
  HardDriveIcon,
  Linkedin01Icon,
  Calendar02Icon,
  AnalysisTextLinkIcon,
  UserListIcon,
  HierarchySquare02Icon,
  Analytics02Icon,
  Dollar02Icon,
  MoneyReceive01Icon,
  Invoice01Icon,
  MicroscopeIcon,
  InboxIcon,
  MedicalFileIcon,
  BarCode01Icon,
  Plug01Icon,
  ChartColumnIcon,
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

interface NavLeafItem {
  title: string;
  href: string;
}

interface NavSubItem {
  title: string;
  href: string;
  icon?: IconSvgElement;
  items?: NavLeafItem[];
}

interface NavItem {
  title: string;
  href: string;
  icon: IconSvgElement;
  items?: NavSubItem[];
}

interface NavSection {
  label?: string;
  items: NavItem[];
}

const appNavSections: NavSection[] = [
  {
    items: [
      { title: "Inicio", href: "/dashboard", icon: DashboardSquare01Icon },
      { title: "Asistente", href: "/assistant/new", icon: AiChat02Icon },
      { title: "Calendario", href: "/calendar", icon: Calendar02Icon },
      { title: "Documentos", href: "/documents", icon: File02Icon },
    ],
  },
  {
    label: "Negocio",
    items: [
      { title: "Clientes", href: "/clients", icon: Building03Icon },
      {
        title: "Cobranzas",
        href: "/collections",
        icon: MoneyReceive01Icon,
        items: [
          { title: "Liquidaciones", href: "/collections/liquidations" },
          { title: "Seguimiento", href: "/collections/tracking" },
        ],
      },
      {
        title: "Facturación",
        href: "/invoicing",
        icon: Invoice01Icon,
        items: [
          { title: "DTEs", href: "/invoicing/dtes" },
          { title: "Libros", href: "/invoicing/books" },
        ],
      },
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
    ],
  },
  {
    label: "Personas",
    items: [
      { title: "Directorio", href: "/personas/directorio", icon: UserListIcon },
      { title: "Organigrama", href: "/personas/organigrama", icon: HierarchySquare02Icon },
      {
        title: "Inteligencia Org.",
        href: "/org-intelligence",
        icon: AnalysisTextLinkIcon,
        items: [
          { title: "Proyectos", href: "/org-intelligence/projects" },
          { title: "Knowledge Base", href: "/org-intelligence/knowledge-base" },
        ],
      },
    ],
  },
  {
    label: "Laboratorio",
    items: [
      { title: "Recepción", href: "/laboratory/reception", icon: InboxIcon },
      { title: "Procesamiento", href: "/laboratory/processing", icon: MicroscopeIcon },
      { title: "Informes", href: "/laboratory/reports", icon: MedicalFileIcon },
      { title: "Codificación", href: "/laboratory/coding", icon: BarCode01Icon },
    ],
  },
  {
    label: "Marketing",
    items: [
      {
        title: "LinkedIn",
        href: "/linkedin",
        icon: Linkedin01Icon,
        items: [
          { title: "Posts", href: "/linkedin/posts" },
          { title: "Configuración", href: "/settings/linkedin" },
        ],
      },
    ],
  },
  {
    label: "Sistema",
    items: [
      { title: "Integraciones", href: "/integrations", icon: Plug01Icon },
      { title: "Reportes", href: "/reports", icon: ChartColumnIcon },
      {
        title: "Administración",
        href: "/admin",
        icon: Dollar02Icon,
        items: [
          { title: "Costos IA (Global)", href: "/admin/ai-costs" },
          { title: "Precios IA", href: "/admin/ai-pricing" },
        ],
      },
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
  { title: "Google Gemini", href: "/settings/ai/gemini", icon: AiChat02Icon },
  { title: "Costos IA", href: "/settings/ai/costs", icon: Analytics02Icon },
  { title: "LinkedIn", href: "/settings/linkedin", icon: Linkedin01Icon },
  { title: "Almacenamiento y Email", href: "/settings/storage", icon: HardDriveIcon },
  { title: "Proceso Contable", href: "/settings/accounting-process", icon: CheckListIcon },
  { title: "API Keys", href: "/settings/api-keys", icon: Key01Icon },
  { title: "Documentación API", href: "/docs", icon: BookOpen01Icon },
];

function isItemActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/assistant/new") return pathname.startsWith("/assistant");
  if (href === "/settings/ai") return pathname === "/settings/ai";
  return pathname === href || pathname.startsWith(href + "/");
}

function NavItemRenderer({ item, pathname }: { item: NavItem; pathname: string }) {
  if (item.items) {
    return (
      <Collapsible
        asChild
        defaultOpen={
          pathname.startsWith(item.href) ||
          (item.items?.some((sub) => pathname.startsWith(sub.href)) ?? false)
        }
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
              {item.items.map((sub) =>
                sub.items ? (
                  <Collapsible
                    key={sub.title}
                    asChild
                    defaultOpen={
                      pathname.startsWith(sub.href) ||
                      (sub.items?.some((leaf) =>
                        pathname.startsWith(leaf.href)
                      ) ?? false)
                    }
                    className="group/sub-collapsible"
                  >
                    <SidebarMenuSubItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuSubButton className="cursor-pointer select-none">
                          {sub.icon && (
                            <HugeiconsIcon
                              icon={sub.icon}
                              className="size-3.5 shrink-0"
                            />
                          )}
                          <span>{sub.title}</span>
                          <HugeiconsIcon
                            icon={ArrowRight01Icon}
                            className="ml-auto size-3 transition-transform duration-200 group-data-[state=open]/sub-collapsible:rotate-90"
                          />
                        </SidebarMenuSubButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <ul className="border-sidebar-border mx-2 mt-0.5 flex flex-col gap-0.5 border-l pl-2.5">
                          {sub.items.map((leaf) => (
                            <li key={leaf.title}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={pathname === leaf.href || pathname.startsWith(leaf.href + "/")}
                                size="sm"
                              >
                                <Link href={leaf.href}>
                                  <span>{leaf.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </li>
                          ))}
                        </ul>
                      </CollapsibleContent>
                    </SidebarMenuSubItem>
                  </Collapsible>
                ) : (
                  <SidebarMenuSubItem key={sub.title}>
                    <SidebarMenuSubButton
                      asChild
                      isActive={pathname === sub.href}
                    >
                      <Link href={sub.href}>
                        {sub.icon && (
                          <HugeiconsIcon
                            icon={sub.icon}
                            className="size-3.5 shrink-0"
                          />
                        )}
                        <span>{sub.title}</span>
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                )
              )}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isItemActive(pathname, item.href)}
        tooltip={item.title}
      >
        <Link href={item.href}>
          <HugeiconsIcon icon={item.icon} />
          <span>{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function NavMain() {
  const pathname = usePathname();
  const router = useRouter();
  const isSettings = pathname.startsWith("/settings");

  if (isSettings) {
    return (
      <SidebarGroup>
        <SidebarGroupLabel>Configuración</SidebarGroupLabel>
        <SidebarMenu>
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
          {settingsNav.map((item) => (
            <NavItemRenderer key={item.title} item={item} pathname={pathname} />
          ))}
        </SidebarMenu>
      </SidebarGroup>
    );
  }

  return (
    <>
      {appNavSections.map((section, idx) => (
        <SidebarGroup key={section.label ?? `section-${idx}`}>
          {section.label && <SidebarGroupLabel>{section.label}</SidebarGroupLabel>}
          <SidebarMenu>
            {section.items.map((item) => (
              <NavItemRenderer key={item.title} item={item} pathname={pathname} />
            ))}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </>
  );
}
