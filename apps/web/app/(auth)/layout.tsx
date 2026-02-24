import { Bricolage_Grotesque } from "next/font/google";
import { MarketingNav } from "@/app/(marketing)/components/marketing-nav";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700", "800"],
});

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${bricolage.variable} min-h-screen bg-[#0a0a0a] text-white`}>
      {/* Ambient glows shared with landing */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-teal-500/8 blur-[140px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-teal-400/5 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>
      <MarketingNav />
      <main className="relative">{children}</main>
    </div>
  );
}
