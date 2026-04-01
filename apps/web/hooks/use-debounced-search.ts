"use client";

import { useState, useEffect } from "react";

export function useDebouncedSearch(delay = 300): {
  search: string;
  debouncedSearch: string;
  setSearch: (value: string) => void;
} {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), delay);
    return () => clearTimeout(timer);
  }, [search, delay]);

  return { search, debouncedSearch, setSearch };
}
