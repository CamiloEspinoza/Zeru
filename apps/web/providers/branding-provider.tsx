'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useTenantContext } from './tenant-provider';
import { deriveColorScale } from '@/lib/color-utils';

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { tenant } = useTenantContext();
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const branding = tenant?.branding;
    if (!branding) return;

    const { primaryColor, secondaryColor, accentColor } = branding;

    // CSS color overrides
    let styleEl: HTMLStyleElement | null = null;
    if (primaryColor || secondaryColor || accentColor) {
      const styleId = 'branding-overrides';
      styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
      }

      const vars: { light: string[]; dark: string[] } = { light: [], dark: [] };

      if (primaryColor) {
        const scale = deriveColorScale(primaryColor);
        vars.light.push(
          `--primary: ${scale.light}`,
          `--primary-foreground: ${scale.lightForeground}`,
          `--sidebar-primary: ${scale.light}`,
          `--sidebar-primary-foreground: ${scale.lightForeground}`,
        );
        vars.dark.push(
          `--primary: ${scale.dark}`,
          `--primary-foreground: ${scale.darkForeground}`,
          `--sidebar-primary: ${scale.dark}`,
          `--sidebar-primary-foreground: ${scale.darkForeground}`,
        );
      }

      if (secondaryColor) {
        const scale = deriveColorScale(secondaryColor);
        vars.light.push(
          `--secondary: ${scale.light}`,
          `--secondary-foreground: ${scale.lightForeground}`,
        );
        vars.dark.push(
          `--secondary: ${scale.dark}`,
          `--secondary-foreground: ${scale.darkForeground}`,
        );
      }

      if (accentColor) {
        const scale = deriveColorScale(accentColor);
        vars.light.push(
          `--accent: ${scale.light}`,
          `--accent-foreground: ${scale.lightForeground}`,
          `--sidebar-accent: ${scale.light}`,
          `--sidebar-accent-foreground: ${scale.lightForeground}`,
        );
        vars.dark.push(
          `--accent: ${scale.dark}`,
          `--accent-foreground: ${scale.darkForeground}`,
          `--sidebar-accent: ${scale.dark}`,
          `--sidebar-accent-foreground: ${scale.darkForeground}`,
        );
      }

      styleEl.textContent = `
        :root { ${vars.light.map(v => `${v};`).join(' ')} }
        .dark { ${vars.dark.map(v => `${v};`).join(' ')} }
      `;
    }

    // Favicon injection
    const faviconUrl = branding.faviconUrl;
    const faviconId = 'branding-favicon';
    let faviconEl = document.querySelector(`link#${faviconId}`) as HTMLLinkElement | null;

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
      styleEl?.remove();
      document.querySelector('link#branding-favicon')?.remove();
    };
  }, [tenant?.branding, resolvedTheme]);

  return <>{children}</>;
}
