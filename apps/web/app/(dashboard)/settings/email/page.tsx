"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function EmailSettingsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/settings/storage");
  }, [router]);

  return null;
}
