"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  projects: "Proyectos",
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

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

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
          const label = LABELS[segment] ?? segment;

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
