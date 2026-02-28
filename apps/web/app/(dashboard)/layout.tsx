import { AuthProvider } from "@/providers/auth-provider";
import { TenantProvider } from "@/providers/tenant-provider";
import { OnboardingGuard } from "@/components/onboarding-guard";
import { AppSidebar } from "@/components/layouts/app-sidebar";
import { Breadcrumbs } from "@/components/layouts/breadcrumbs";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <TenantProvider>
        <OnboardingGuard>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
              <header className="flex h-16 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
                <div className="flex items-center gap-2 px-4">
                  <SidebarTrigger className="-ml-1" />
                  <Separator
                    orientation="vertical"
                    className="mr-2 data-[orientation=vertical]:h-4"
                  />
                  <Breadcrumbs />
                </div>
              </header>
              <div className="flex flex-1 flex-col gap-4 p-6 min-h-0 overflow-y-auto">
                {children}
              </div>
            </SidebarInset>
          </SidebarProvider>
        </OnboardingGuard>
      </TenantProvider>
    </AuthProvider>
  );
}
