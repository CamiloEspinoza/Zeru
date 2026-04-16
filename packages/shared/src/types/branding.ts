export const THEME_TOKEN_NAMES = [
  '--background', '--foreground',
  '--card', '--card-foreground',
  '--popover', '--popover-foreground',
  '--primary', '--primary-foreground',
  '--secondary', '--secondary-foreground',
  '--muted', '--muted-foreground',
  '--accent', '--accent-foreground',
  '--destructive',
  '--border', '--input', '--ring',
  '--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5',
  '--sidebar', '--sidebar-foreground',
  '--sidebar-primary', '--sidebar-primary-foreground',
  '--sidebar-accent', '--sidebar-accent-foreground',
  '--sidebar-border', '--sidebar-ring',
] as const;

export type ThemeTokenName = (typeof THEME_TOKEN_NAMES)[number];

export interface ThemeOverrides {
  light?: Record<string, string>;
  dark?: Record<string, string>;
}

export interface TenantBranding {
  id: string;
  tenantId: string;
  logoUrl: string | null;
  isotipoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  themeOverrides: ThemeOverrides | null;
  borderRadius: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantBrandingAssets {
  logoUrl: string | null;
  isotipoUrl: string | null;
  faviconUrl: string | null;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  } | null;
  fallbackInitial: string;
  tenantName: string;
}

export interface UpdateBrandingInput {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  themeOverrides?: ThemeOverrides;
  borderRadius?: string;
}

export interface GeneratePaletteInput {
  source: 'logo' | 'description';
  description?: string;
}

export interface GeneratePaletteResult {
  primary: string;
  secondary: string;
  accent: string;
}

export interface SuggestColorResult {
  hex: string;
}
