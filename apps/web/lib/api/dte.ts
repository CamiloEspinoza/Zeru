import { api } from "@/lib/api-client";
import { TENANT_HEADER } from "@zeru/shared";

// ─── Types ───────────────────────────────────────

export interface DteConfig {
  id: string;
  rut: string;
  razonSocial: string;
  giro: string;
  actividadEco: number;
  direccion: string;
  comuna: string;
  ciudad: string;
  codigoSucursal?: number | null;
  environment: "CERTIFICATION" | "PRODUCTION";
  resolutionNum: number;
  resolutionDate: string;
  exchangeEmail?: string | null;
  imapHost?: string | null;
  imapPort?: number | null;
  imapUser?: string | null;
  imapPass?: string | null;
  imapEnabled: boolean;
  autoCreateJournalEntry: boolean;
  autoPostJournalEntry: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  tenantId: string;
}

export interface DteConfigInput {
  rut: string;
  razonSocial: string;
  giro: string;
  actividadEco: number;
  direccion: string;
  comuna: string;
  ciudad: string;
  codigoSucursal?: number;
  environment: "CERTIFICATION" | "PRODUCTION";
  resolutionNum: number;
  resolutionDate: string;
  exchangeEmail?: string;
  imapHost?: string;
  imapPort?: number;
  imapUser?: string;
  imapPass?: string;
  imapEnabled?: boolean;
  autoCreateJournalEntry?: boolean;
  autoPostJournalEntry?: boolean;
}

export interface DteCertificate {
  id: string;
  subjectName: string;
  subjectRut: string;
  issuer: string;
  validFrom: string;
  validUntil: string;
  status: "ACTIVE" | "EXPIRED" | "REVOKED";
  isPrimary: boolean;
  sha256Fingerprint: string;
  createdAt: string;
}

export interface DteFolio {
  id: string;
  dteType: string;
  environment: "CERTIFICATION" | "PRODUCTION";
  rangeFrom: number;
  rangeTo: number;
  nextFolio: number;
  authorizedAt: string;
  expiresAt: string;
  isActive: boolean;
  isExhausted: boolean;
  alertThreshold: number;
  createdAt: string;
}

export interface DteAccountMapping {
  id: string;
  dteTypeCode: number;
  dteTypeName: string;
  direction: "EMITTED" | "RECEIVED";
  receivableAccountId?: string | null;
  payableAccountId?: string | null;
  cashAccountId?: string | null;
  revenueAccountId?: string | null;
  revenueExemptAccountId?: string | null;
  purchaseAccountId?: string | null;
  ivaDebitoAccountId?: string | null;
  ivaCreditoAccountId?: string | null;
  salesReturnAccountId?: string | null;
  purchaseReturnAccountId?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  tenantId: string;
}

// ─── Helpers ─────────────────────────────────────

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3017/api";

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const tenantId =
    typeof window !== "undefined"
      ? (localStorage.getItem("tenantId") ?? undefined)
      : undefined;
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("access_token")
      : null;
  if (tenantId) headers[TENANT_HEADER] = tenantId;
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

// ─── API ─────────────────────────────────────────

export const dteApi = {
  // ── Config ──
  getConfig: () => api.get<DteConfig | null>("/dte/config"),

  upsertConfig: (data: DteConfigInput) =>
    api.put<DteConfig>("/dte/config", data),

  // ── Certificates ──
  listCertificates: () => api.get<DteCertificate[]>("/dte/certificates"),

  uploadCertificate: async (
    file: File,
    password: string,
    isPrimary: boolean,
  ): Promise<DteCertificate> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("password", password);
    formData.append("isPrimary", String(isPrimary));

    const res = await fetch(`${API_BASE}/dte/certificates`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: formData,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(
        (error as { message?: string }).message ?? "Error al subir certificado",
      );
    }

    return res.json();
  },

  deleteCertificate: (id: string) =>
    api.delete<void>(`/dte/certificates/${id}`),

  setPrimaryCertificate: (id: string) =>
    api.patch<{ id: string; isPrimary: boolean }>(
      `/dte/certificates/${id}/set-primary`,
      {},
    ),

  // ── Folios ──
  listFolios: () => api.get<DteFolio[]>("/dte/folios"),

  uploadCaf: (cafXml: string) =>
    api.post<DteFolio>("/dte/folios", { cafXml }),

  // ── Account Mappings ──
  listMappings: () =>
    api.get<DteAccountMapping[]>("/dte/account-mappings"),

  upsertMapping: (data: {
    dteTypeCode: number;
    direction: "EMITTED" | "RECEIVED";
    receivableAccountId?: string | null;
    payableAccountId?: string | null;
    cashAccountId?: string | null;
    revenueAccountId?: string | null;
    revenueExemptAccountId?: string | null;
    purchaseAccountId?: string | null;
    ivaDebitoAccountId?: string | null;
    ivaCreditoAccountId?: string | null;
    salesReturnAccountId?: string | null;
    purchaseReturnAccountId?: string | null;
  }) => api.put<DteAccountMapping>("/dte/account-mappings", data),

  seedMappings: () =>
    api.post<DteAccountMapping[]>("/dte/account-mappings/seed", {}),
};
