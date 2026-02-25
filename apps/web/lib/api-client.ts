import { TENANT_HEADER } from "@zeru/shared";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3017/api";

interface FetchOptions extends RequestInit {
  tenantId?: string;
}

async function request<T>(
  endpoint: string,
  options: FetchOptions = {},
): Promise<T> {
  const { tenantId: explicitTenantId, headers: customHeaders, ...rest } =
    options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(customHeaders as Record<string, string>),
  };

  const tenantId =
    explicitTenantId ??
    (typeof window !== "undefined"
      ? (localStorage.getItem("tenantId") ?? undefined)
      : undefined);

  if (tenantId) {
    headers[TENANT_HEADER] = tenantId;
  }

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("access_token")
      : null;
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers,
    ...rest,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message ?? "Request failed");
  }

  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return undefined as T;
  }

  return res.json();
}

export const api = {
  get: <T>(url: string, opts?: FetchOptions) =>
    request<T>(url, { ...opts, method: "GET" }),

  post: <T>(url: string, body: unknown, opts?: FetchOptions) =>
    request<T>(url, { ...opts, method: "POST", body: JSON.stringify(body) }),

  put: <T>(url: string, body: unknown, opts?: FetchOptions) =>
    request<T>(url, { ...opts, method: "PUT", body: JSON.stringify(body) }),

  patch: <T>(url: string, body: unknown, opts?: FetchOptions) =>
    request<T>(url, { ...opts, method: "PATCH", body: JSON.stringify(body) }),

  delete: <T>(url: string, opts?: FetchOptions) =>
    request<T>(url, { ...opts, method: "DELETE" }),
};
