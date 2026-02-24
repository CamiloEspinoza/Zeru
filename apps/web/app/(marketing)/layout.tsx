import type { Metadata } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import { MarketingNav } from "./components/marketing-nav";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Zeru — Gestión empresarial con agentes de IA, gratuito y open source",
  description:
    "Zeru es una plataforma de gestión empresarial construida sobre agentes de inteligencia artificial. Gratuita, open source y multitenant. Crea asientos contables, procesa documentos y gestiona tu empresa en conversación.",
  openGraph: {
    title: "Zeru — Gestión empresarial con agentes de IA",
    description:
      "Plataforma gratuita y open source con asistente contable IA. Contabilidad, documentos, inventario y mucho más.",
    type: "website",
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${bricolage.variable} min-h-screen bg-[#0a0a0a] text-white`}>
      <MarketingNav />
      <main>{children}</main>
    </div>
  );
}
