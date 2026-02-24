import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ReportsPage() {
  const reports = [
    {
      title: "Balance de Comprobación",
      description: "Resumen de movimientos por cuenta en un período fiscal.",
      href: "/accounting/reports/balance",
    },
    {
      title: "Libro Mayor",
      description: "Detalle de movimientos de una cuenta en un rango de fechas.",
      href: "/accounting/reports/general-ledger",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reportes</h1>
        <p className="text-muted-foreground">
          Reportes contables y financieros.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {reports.map((report) => (
          <Link key={report.href} href={report.href}>
            <Card className="h-full transition-colors hover:bg-muted/50">
              <CardHeader>
                <CardTitle>{report.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {report.description}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
