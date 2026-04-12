"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api-client";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const LABELS: Record<string, string> = {
  accounting: "Contabilidad",
  "chart-of-accounts": "Plan de Cuentas",
  journal: "Asientos",
  reports: "Reportes",
  periods: "Períodos Fiscales",
  balance: "Balance",
  "general-ledger": "Libro Mayor",
  new: "Nuevo",
  settings: "Configuración",
  organization: "Organización",
  users: "Usuarios",
  appearance: "Apariencia",
  ai: "Asistente IA",
  memory: "Memoria",
  skills: "Skills",
  gemini: "Gemini",
  assistant: "Asistente",
  documents: "Documentos",
  calendar: "Calendario",
  linkedin: "LinkedIn",
  posts: "Posts",
  "org-intelligence": "Inteligencia Organizacional",
  projects: "Tableros",
  interviews: "Entrevistas",
  persons: "Personas",
  "knowledge-base": "Base de Conocimiento",
  personas: "Personas",
  directorio: "Directorio",
  organigrama: "Organigrama",
  storage: "Almacenamiento",
  "accounting-process": "Proceso Contable",
  "api-keys": "API Keys",
  clients: "Clientes",
  collections: "Cobranzas",
  liquidations: "Liquidaciones",
  tracking: "Seguimiento",
  invoicing: "Facturación",
  dtes: "DTEs",
  books: "Libros",
  laboratory: "Laboratorio",
  reception: "Recepción",
  processing: "Procesamiento",
  coding: "Codificación",
  integrations: "Integraciones",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolves a UUID segment to a human-readable name based on route context.
 * Uses the previous segment to determine what kind of entity the UUID refers to.
 */
async function resolveUuid(
  uuid: string,
  parentSegment: string,
): Promise<string | null> {
  try {
    switch (parentSegment) {
      case "projects": {
        // Distinguish board projects from org-intelligence projects by checking the URL path
        const isOrgIntelligence = typeof window !== "undefined" && window.location.pathname.includes("/org-intelligence/");
        if (isOrgIntelligence) {
          const res = await api.get<{ name?: string | null }>(
            `/org-intelligence/projects/${uuid}`,
          );
          return res.name ?? null;
        }
        // Board project
        const res = await api.get<{ name?: string | null }>(
          `/projects/${uuid}`,
        );
        return res.name ?? null;
      }
      case "interviews": {
        const res = await api.get<{ title?: string | null }>(
          `/org-intelligence/interviews/${uuid}`,
        );
        return res.title ?? null;
      }
      case "assistant": {
        const res = await api.get<{ title?: string | null }>(
          `/ai/conversations/${uuid}`,
        );
        return res.title ?? null;
      }
      case "journal": {
        const res = await api.get<{
          description?: string | null;
          number?: number | null;
        }>(`/accounting/journal-entries/${uuid}`);
        return res.description ? `#${res.number}` : null;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

// Module-level cache to avoid re-fetching on every render
const nameCache = new Map<string, string>();

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const [resolvedNames, setResolvedNames] = useState<Record<string, string>>({});

  // Synchronously populate from cache on each render
  const cachedNames = useMemo(() => {
    const cached: Record<string, string> = {};
    for (const seg of segments) {
      if (nameCache.has(seg)) cached[seg] = nameCache.get(seg)!;
    }
    return cached;
  }, [segments]);

  useEffect(() => {
    const uuidsToResolve: { uuid: string; parent: string }[] = [];

    for (let i = 0; i < segments.length; i++) {
      if (UUID_RE.test(segments[i]) && !nameCache.has(segments[i])) {
        const parent = segments[i - 1] ?? "";
        uuidsToResolve.push({ uuid: segments[i], parent });
      }
    }

    if (uuidsToResolve.length === 0) return;

    Promise.all(
      uuidsToResolve.map(async ({ uuid, parent }) => {
        const name = await resolveUuid(uuid, parent);
        if (name) nameCache.set(uuid, name);
        return { uuid, name };
      }),
    ).then((results) => {
      const names: Record<string, string> = {};
      // Include previously cached
      for (const seg of segments) {
        if (nameCache.has(seg)) names[seg] = nameCache.get(seg)!;
      }
      for (const { uuid, name } of results) {
        if (name) names[uuid] = name;
      }
      setResolvedNames(names);
    });
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  if (segments.length === 0) {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>Dashboard</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem className="hidden md:block">
          <BreadcrumbLink asChild>
            <Link href="/dashboard">Inicio</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {segments.map((segment, index) => {
          const href = "/" + segments.slice(0, index + 1).join("/");
          const isLast = index === segments.length - 1;
          const label =
            LABELS[segment] ??
            resolvedNames[segment] ?? cachedNames[segment] ??
            (UUID_RE.test(segment) ? "..." : segment);

          return (
            <span key={href} className="contents">
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={href}>{label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </span>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
