"use client";

import { usePathname } from "next/navigation";
import { AvatarStack } from "./avatar-stack";

export function ViewPresence() {
  const pathname = usePathname();
  return <AvatarStack viewPath={pathname} />;
}
