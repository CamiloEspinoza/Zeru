import { IncomeStatement } from "./components/income-statement";
import { AccountingProcessProgress } from "./components/accounting-process-progress";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Bienvenido a Zeru</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <IncomeStatement />
        <AccountingProcessProgress />
      </div>
    </div>
  );
}
