"use client";

import { useState } from "react";

export function usePagination(
  initialPage = 1,
  initialPerPage = 20,
): {
  page: number;
  perPage: number;
  setPage: (page: number) => void;
  setPerPage: (perPage: number) => void;
  reset: () => void;
} {
  const [page, setPage] = useState(initialPage);
  const [perPage, setPerPage] = useState(initialPerPage);

  const reset = () => {
    setPage(initialPage);
    setPerPage(initialPerPage);
  };

  return { page, perPage, setPage, setPerPage, reset };
}
