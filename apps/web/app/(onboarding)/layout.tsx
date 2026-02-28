import { AuthProvider } from "@/providers/auth-provider";
import { TenantProvider } from "@/providers/tenant-provider";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <TenantProvider>
        <div className="min-h-screen bg-background">
          <main className="flex min-h-screen items-start justify-center pt-12 pb-12 px-4">
            <div className="w-full max-w-2xl">{children}</div>
          </main>
        </div>
      </TenantProvider>
    </AuthProvider>
  );
}
