"use client";

import type { ReactNode } from "react";
import { usePermissions } from "@/hooks/use-permissions";

interface CanProps {
  module: string;
  action: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function Can({ module, action, children, fallback = null }: CanProps) {
  const { can, loading } = usePermissions();

  if (loading) return null;
  if (!can(module, action)) return <>{fallback}</>;
  return <>{children}</>;
}
