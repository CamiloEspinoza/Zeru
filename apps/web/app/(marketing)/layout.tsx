import type { Metadata } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import { MarketingNav } from "./components/marketing-nav";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700", "800"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://zeruapp.com";

export const metadata: Metadata = {
  title: "Zeru — Gestión empresarial con agentes de IA, gratuito y open source",
  description:
    "Zeru es una plataforma de gestión empresarial construida sobre agentes de inteligencia artificial. Gratuita, open source y multitenant. Crea asientos contables, procesa documentos y gestiona tu empresa en conversación.",
  keywords: [
    "gestión empresarial",
    "contabilidad IA",
    "asistente contable",
    "open source",
    "ERP Chile",
    "factura electrónica",
    "SII",
    "agentes de inteligencia artificial",
    "contabilidad chilena",
    "software contable gratis",
  ],
  authors: [{ name: "Camilo Espinoza", url: "https://www.linkedin.com/in/camilo-espinoza-c/" }],
  creator: "Camilo Espinoza",
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: "/" },
  openGraph: {
    title: "Zeru — Gestión empresarial con agentes de IA",
    description:
      "Plataforma gratuita y open source con asistente contable IA. Contabilidad, documentos, inventario y mucho más.",
    type: "website",
    url: SITE_URL,
    siteName: "Zeru",
    locale: "es_CL",
  },
  twitter: {
    card: "summary_large_image",
    title: "Zeru — Gestión empresarial con agentes de IA",
    description:
      "Plataforma gratuita y open source con asistente contable IA. Contabilidad, documentos, inventario y mucho más.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${bricolage.variable} min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden`}>
      <MarketingNav />
      <main>{children}</main>
    </div>
  );
}
