'use client';

import { useEffect } from 'react';
import { useTenantContext } from './tenant-provider';
import {
  generateTheme,
  mergeThemeWithOverrides,
  themeToCSS,
  BORDER_RADIUS_MAP,
} from '@/lib/theme-generator';
import type { ThemeOverrides } from '@zeru/shared';

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { tenant } = useTenantContext();

  useEffect(() => {
    const branding = tenant?.branding;
    if (!branding?.primaryColor) return;

    const styleId = 'branding-overrides';
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    const generated = generateTheme(branding.primaryColor);
    const overrides = branding.themeOverrides as ThemeOverrides | null;
    const merged = mergeThemeWithOverrides(generated, overrides);
    const radiusValue = branding.borderRadius
      ? BORDER_RADIUS_MAP[branding.borderRadius]
      : undefined;

    styleEl.textContent = themeToCSS(merged, radiusValue);

    // Favicon injection
    const faviconUrl = branding.faviconUrl;
    const faviconId = 'branding-favicon';
    let faviconEl = document.querySelector(
      `link#${faviconId}`,
    ) as HTMLLinkElement | null;

    if (faviconUrl) {
      if (!faviconEl) {
        faviconEl = document.createElement('link');
        faviconEl.id = faviconId;
        faviconEl.rel = 'icon';
        faviconEl.type = 'image/png';
        document.head.appendChild(faviconEl);
      }
      faviconEl.href = faviconUrl;
    } else if (faviconEl) {
      faviconEl.remove();
    }

    return () => {
      document.getElementById(styleId)?.remove();
      document.querySelector('link#branding-favicon')?.remove();
    };
  }, [tenant?.branding]);

  return <>{children}</>;
}
