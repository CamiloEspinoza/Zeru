"use client";

import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowUpDoubleIcon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuthContext } from "@/providers/auth-provider";
import { useTenantContext } from "@/providers/tenant-provider";

export function TeamSwitcher() {
  const { isMobile } = useSidebar();
  const { user, switchTenant } = useAuthContext();
  const { tenant } = useTenantContext();
  const [switching, setSwitching] = React.useState(false);

  const memberships = user?.memberships ?? [];
  const currentTenantId = tenant?.id;

  async function handleSwitch(tenantId: string) {
    if (tenantId === currentTenantId || switching) return;
    setSwitching(true);
    try {
      await switchTenant(tenantId);
    } catch {
      setSwitching(false);
    }
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="bg-black text-white flex size-8 items-center justify-center rounded-md text-sm font-bold shrink-0">
                Z
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {switching ? "Cambiando..." : (tenant?.name ?? "Cargando...")}
                </span>
                <span className="truncate text-xs text-sidebar-foreground/60">
                  Zeru
                </span>
              </div>
              <HugeiconsIcon
                icon={ArrowUpDoubleIcon}
                className="ml-auto size-4 opacity-60"
              />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Tus organizaciones
            </DropdownMenuLabel>
            {memberships.map((m) => (
              <DropdownMenuItem
                key={m.tenantId}
                onSelect={() => handleSwitch(m.tenantId)}
                className="gap-2 p-2"
                disabled={switching}
              >
                <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-sm text-xs font-bold shrink-0">
                  {m.tenant.name.charAt(0).toUpperCase()}
                </div>
                <span className={m.tenantId === currentTenantId ? "font-medium" : ""}>
                  {m.tenant.name}
                </span>
                {m.tenantId === currentTenantId && (
                  <svg className="ml-auto size-3.5 text-primary shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 p-2" disabled>
              <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                <HugeiconsIcon icon={PlusSignIcon} className="size-4" />
              </div>
              <div className="text-muted-foreground font-medium text-sm">
                Nueva organización
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
