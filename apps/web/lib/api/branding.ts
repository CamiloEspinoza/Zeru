import { api } from "@/lib/api-client";
import type { TenantBranding, GeneratePaletteResult } from "@zeru/shared";

export const brandingApi = {
  get: () => api.get<TenantBranding | null>("/tenants/current/branding"),

  updateColors: (colors: {
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
  }) => api.patch<TenantBranding>("/tenants/current/branding", colors),

  uploadLogo: (file: File) =>
    api.uploadFile<TenantBranding>("/tenants/current/branding/logo", file),

  uploadIsotipo: (file: File) =>
    api.uploadFile<TenantBranding>("/tenants/current/branding/isotipo", file),

  deleteLogo: () => api.delete<void>("/tenants/current/branding/logo"),

  deleteIsotipo: () => api.delete<void>("/tenants/current/branding/isotipo"),

  uploadFavicon: (file: File) =>
    api.uploadFile<TenantBranding>("/tenants/current/branding/favicon", file),

  deleteFavicon: () => api.delete<void>("/tenants/current/branding/favicon"),

  setFaviconFromIsotipo: () =>
    api.post<TenantBranding>(
      "/tenants/current/branding/favicon/from-isotipo",
      {},
    ),

  generateFavicon: () =>
    api.post<TenantBranding>(
      "/tenants/current/branding/favicon/generate",
      {},
    ),

  generatePalette: (
    input: { source: "logo" } | { source: "description"; description: string },
  ) =>
    api.post<GeneratePaletteResult>(
      "/tenants/current/branding/generate-palette",
      input,
    ),
};
