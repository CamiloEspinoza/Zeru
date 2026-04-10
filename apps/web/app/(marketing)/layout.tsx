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
  title: "Zeru \u2014 Inteligencia Organizacional con IA | Diagnostica tu empresa en d\u00edas",
  description:
    "Sube entrevistas con tu equipo y Zeru las transcribe, analiza y diagnostica autom\u00e1ticamente. Knowledge Graph y plan de mejoras con IA. ~$0.65/entrevista.",
  keywords: [
    "inteligencia organizacional con IA",
    "diagn\u00f3stico organizacional automatizado",
    "software diagn\u00f3stico empresarial",
    "an\u00e1lisis organizacional con inteligencia artificial",
    "transcripci\u00f3n entrevistas organizacionales",
    "knowledge graph empresarial",
    "cuellos de botella organizacionales",
    "organigrama inteligente con IA",
    "plataforma gesti\u00f3n empresarial Chile",
    "c\u00f3mo diagnosticar mi empresa con IA",
    "alternativa a consultor\u00eda organizacional",
    "software para entender procesos internos de empresa",
  ],
  authors: [{ name: "Camilo Espinoza", url: "https://www.linkedin.com/in/camilo-espinoza-c/" }],
  creator: "Camilo Espinoza",
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: "/" },
  openGraph: {
    title: "Zeru \u2014 Inteligencia Organizacional con IA",
    description:
      "Plataforma de inteligencia organizacional con IA. Transcribe entrevistas, extrae conocimiento, genera organigramas y diagnostica tu empresa autom\u00e1ticamente.",
    type: "website",
    url: SITE_URL,
    siteName: "Zeru",
    locale: "es_CL",
  },
  twitter: {
    card: "summary_large_image",
    title: "Zeru \u2014 Inteligencia Organizacional con IA",
    description:
      "Sube entrevistas con tu equipo y Zeru las transcribe, analiza y diagnostica autom\u00e1ticamente. Knowledge Graph y plan de mejoras con IA. ~$0.65/entrevista.",
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
