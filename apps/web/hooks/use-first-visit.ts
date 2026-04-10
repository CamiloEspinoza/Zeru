'use client';
import { useState, useCallback } from 'react';

function getIsFirstVisit(key: string): boolean {
  if (typeof window === 'undefined') return true;
  return !localStorage.getItem(key);
}

export function useFirstVisit(sectionId: string) {
  const key = `zeru_firstVisit_${sectionId}`;
  const [isFirstVisit, setIsFirstVisit] = useState(() => getIsFirstVisit(key));

  const markVisited = useCallback(() => {
    localStorage.setItem(key, 'true');
    setIsFirstVisit(false);
  }, [key]);

  return { isFirstVisit, markVisited };
}
