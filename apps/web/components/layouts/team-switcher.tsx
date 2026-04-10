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
import { CreateOrgDialog } from "@/components/organizations/create-org-dialog";

export function TeamSwitcher() {
  const { isMobile } = useSidebar();
  const { user, switchTenant } = useAuthContext();
  const { tenant } = useTenantContext();
  const [switching, setSwitching] = React.useState(false);
  const [showCreateOrg, setShowCreateOrg] = React.useState(false);

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
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                {tenant?.branding?.isotipoUrl ? (
                  <img
                    src={tenant.branding.isotipoUrl}
                    alt={tenant.name}
                    className="size-8 rounded-md object-cover shrink-0"
                  />
                ) : (
                  <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md text-sm font-bold shrink-0">
                    {tenant?.name?.charAt(0).toUpperCase() ?? "Z"}
                  </div>
                )}
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">
                    {switching ? "Cambiando..." : (tenant?.name ?? "Cargando...")}
                  </span>
                  {tenant?.rut ? (
                    <span
                      role="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(tenant.rut!);
                      }}
                      className="flex items-center gap-1 truncate text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground/80 transition-colors cursor-pointer"
                      title="Copiar RUT"
                    >
                      <span>{tenant.rut}</span>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-3 shrink-0">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                      </svg>
                    </span>
                  ) : (
                    <span className="truncate text-xs text-sidebar-foreground/60">
                      Zeru
                    </span>
                  )}
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
              <DropdownMenuItem
                className="gap-2 p-2"
                onSelect={() => setShowCreateOrg(true)}
              >
                <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                  <HugeiconsIcon icon={PlusSignIcon} className="size-4" />
                </div>
                <div className="font-medium text-sm">
                  Nueva organización
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <CreateOrgDialog open={showCreateOrg} onOpenChange={setShowCreateOrg} />
    </>
  );
}
