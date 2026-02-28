"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    api
      .get<{ completed: boolean }>("/tenants/current/onboarding-status")
      .then((status) => {
        if (!status.completed) {
          router.replace("/onboarding");
        } else {
          setChecked(true);
        }
      })
      .catch(() => {
        // Fail open — don't block dashboard if endpoint errors
        setChecked(true);
      });
  }, [router]);

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
