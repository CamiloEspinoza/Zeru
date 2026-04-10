export interface TenantBranding {
  id: string;
  tenantId: string;
  logoUrl: string | null;
  isotipoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantBrandingAssets {
  logoUrl: string | null;
  isotipoUrl: string | null;
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
