import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AccountingPage() {
  const sections = [
    {
      title: "Plan de Cuentas",
      description: "Gestiona el catálogo de cuentas contables de tu organización.",
      href: "/accounting/chart-of-accounts",
    },
    {
      title: "Asientos",
      description: "Registra y consulta los asientos contables del período.",
      href: "/accounting/journal",
    },
    {
      title: "Períodos Fiscales",
      description: "Administra los períodos fiscales y cierres contables.",
      href: "/accounting/periods",
    },
    {
      title: "Reportes",
      description: "Balance de comprobación, libro mayor y otros reportes.",
      href: "/accounting/reports",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Contabilidad</h1>
        <p className="text-muted-foreground">
          Centro de control contable de tu organización.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {sections.map((section) => (
          <Link key={section.href} href={section.href}>
            <Card className="h-full transition-colors hover:bg-muted/50">
              <CardHeader>
                <CardTitle>{section.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {section.description}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
