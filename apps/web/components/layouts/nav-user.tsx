"use client";

import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowUpDoubleIcon,
  Settings02Icon,
  PaintBrush04Icon,
  Logout01Icon,
  Sun03Icon,
  Moon02Icon,
} from "@hugeicons/core-free-icons";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
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

function ThemeItem() {
  const { theme, setTheme } = useTheme();
  const emptySubscribe = () => () => {};
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  if (!mounted) return null;

  const isDark = theme === "dark";

  return (
    <DropdownMenuItem onSelect={() => setTheme(isDark ? "light" : "dark")}>
      <HugeiconsIcon icon={isDark ? Sun03Icon : Moon02Icon} />
      {isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
    </DropdownMenuItem>
  );
}

export function NavUser() {
  const { isMobile } = useSidebar();
  const { user, logout } = useAuthContext();
  const router = useRouter();

  const fullName = user ? `${user.firstName} ${user.lastName}` : "";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <UserAvatar userId={user?.id} name={fullName} className="h-8 w-8 rounded-lg" />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{fullName}</span>
                <span className="truncate text-xs text-sidebar-foreground/60">
                  {user?.email ?? ""}
                </span>
              </div>
              <HugeiconsIcon icon={ArrowUpDoubleIcon} className="ml-auto size-4 opacity-60" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <UserAvatar userId={user?.id} name={fullName} className="h-8 w-8 rounded-lg" />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{fullName}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user?.email ?? ""}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={() => router.push("/settings")}>
                <HugeiconsIcon icon={Settings02Icon} />
                Configuración
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => router.push("/settings/appearance")}>
                <HugeiconsIcon icon={PaintBrush04Icon} />
                Apariencia
              </DropdownMenuItem>
              <ThemeItem />
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => { logout(); router.push("/login"); }}
              className="text-destructive focus:text-destructive focus:bg-destructive/10"
            >
              <HugeiconsIcon icon={Logout01Icon} />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
