"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function LinkedInChatRedirect() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    const id = params.id as string;
    if (id === "new") {
      router.replace("/assistant/new");
    } else {
      router.replace(`/assistant/${id}`);
    }
  }, [params.id, router]);

  return null;
}
