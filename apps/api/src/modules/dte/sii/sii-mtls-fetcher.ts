import { Agent, fetch as undiciFetch } from 'undici';
import type { Certificado } from '@devlas/dte-sii';

/**
 * Performs an HTTPS request against SII endpoints authenticated via mTLS
 * using the tenant's digital certificate (PEM key + cert).
 *
 * This is the canonical helper used by all SII REST/SOAP callers.
 * It relies on `undici.fetch` with a per-request Agent configured with
 * the client certificate via `connect: { key, cert }`.
 *
 * Node's global `fetch` does not support per-request TLS client auth
 * (the `dispatcher` field is non-standard). This helper centralises the
 * workaround and keeps call sites small.
 */
export interface MtlsFetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Uint8Array;
  cert: Certificado;
  /** If true, rejects untrusted certs. Defaults to true. */
  rejectUnauthorized?: boolean;
}

export interface MtlsResponse {
  ok: boolean;
  status: number;
  statusText: string;
  text(): Promise<string>;
}

export async function mtlsFetch(
  url: string,
  options: MtlsFetchOptions,
): Promise<MtlsResponse> {
  const agent = new Agent({
    connect: {
      key: options.cert.getPrivateKeyPEM(),
      cert: options.cert.getCertificatePEM(),
      rejectUnauthorized: options.rejectUnauthorized !== false,
    },
  });

  try {
    const response = await undiciFetch(url, {
      method: options.method ?? 'GET',
      headers: options.headers,
      body: options.body,
      dispatcher: agent,
    });

    const text = await response.text();

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      text: async () => text,
    };
  } finally {
    // Close the agent to free sockets after the request completes.
    await agent.close().catch(() => undefined);
  }
}
