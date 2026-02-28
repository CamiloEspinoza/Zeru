import { IncomeStatement } from "./components/income-statement";
import { OnboardingBanner } from "@/components/onboarding-banner";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <OnboardingBanner />

      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Bienvenido a Zeru</p>
      </div>

      <div className="w-full">
        <IncomeStatement />
      </div>
    </div>
  );
}
