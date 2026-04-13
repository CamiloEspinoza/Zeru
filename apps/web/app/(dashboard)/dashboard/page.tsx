"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { OnboardingBanner } from "@/components/onboarding-banner";
import { useAuthContext } from "@/providers/auth-provider";
import { api } from "@/lib/api-client";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AnalysisTextLinkIcon,
  UserGroupIcon,
  ArrowRight01Icon,
  BookOpen01Icon,
} from "@hugeicons/core-free-icons";
import { IncomeStatement } from "./components/income-statement";

// ── Types ──

interface Project {
  id: string;
  name: string;
  status: string;
  _count?: {
    interviews: number;
    entities: number;
    problems: number;
  };
}

interface ProjectsResponse {
  data: Project[];
  meta: { total: number };
}

interface PersonsResponse {
  data: unknown[];
  meta: { total: number };
}

interface DashboardStats {
  activeProjects: number;
  totalProjects: number;
  completedInterviews: number;
  totalInterviews: number;
  totalPersons: number;
  totalProblems: number;
}

// ── Greeting helper ──

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

// ── Quick action definitions ──

const quickActions = [
  {
    label: "Crear proyecto",
    description: "Inicia un nuevo levantamiento organizacional",
    href: "/org-intelligence/projects",
    icon: AnalysisTextLinkIcon,
  },
  {
    label: "Registrar persona",
    description: "Agrega una persona al directorio",
    href: "/personas/directorio",
    icon: UserGroupIcon,
  },
  {
    label: "Ver organigrama",
    description: "Visualiza la estructura organizacional",
    href: "/personas/organigrama",
    icon: UserGroupIcon,
  },
  {
    label: "Buscar conocimiento",
    description: "Explora la base de conocimiento",
    href: "/org-intelligence/knowledge-base",
    icon: BookOpen01Icon,
  },
];

// ── Main component ──

export default function DashboardPage() {
  const { user } = useAuthContext();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(false);

  const firstName = user?.firstName ?? "";
  const greeting = getGreeting();

  const fetchStats = useCallback(async () => {
    setLoading(true);

    const result: DashboardStats = {
      activeProjects: 0,
      totalProjects: 0,
      completedInterviews: 0,
      totalInterviews: 0,
      totalPersons: 0,
      totalProblems: 0,
    };

    // Fetch projects
    try {
      const res = await api.get<ProjectsResponse>(
        "/org-intelligence/projects",
      );
      result.totalProjects = res.meta.total;
      result.activeProjects = res.data.filter(
        (p) => p.status === "ACTIVE",
      ).length;

      // Sum up interviews and problems from project counts
      for (const project of res.data) {
        if (project._count) {
          result.totalInterviews += project._count.interviews;
          result.totalProblems += project._count.problems;
        }
      }
    } catch {
      // Module may not have data — keep defaults
    }

    // Fetch persons
    try {
      const res = await api.get<PersonsResponse>(
        "/org-intelligence/persons",
      );
      result.totalPersons = res.meta.total;
    } catch {
      // Module may not have data — keep defaults
    }

    setStats(result);
    setHasData(
      result.totalProjects > 0 ||
        result.totalPersons > 0 ||
        result.totalInterviews > 0,
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    Promise.resolve().then(fetchStats);
  }, [fetchStats]);

  return (
    <div className="space-y-8">
      <OnboardingBanner />

      {/* Section 1: Header with greeting */}
      <div>
        <h1 className="text-2xl font-bold">
          {greeting}, {firstName}
        </h1>
        <p className="text-muted-foreground mt-1">
          Aquí tienes un resumen de tu plataforma.
        </p>
      </div>

      {/* Section 2: Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          <>
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-3 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="mt-2 h-3 w-32" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <>
            <Link href="/org-intelligence/projects">
              <Card className="cursor-pointer transition-colors hover:bg-muted/50">
                <CardHeader className="pb-2">
                  <CardDescription>Tableros activos</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold tabular-nums">
                    {stats?.activeProjects ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats?.totalProjects ?? 0} proyecto
                    {(stats?.totalProjects ?? 0) !== 1 ? "s" : ""} en total
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Entrevistas</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold tabular-nums">
                  {stats?.totalInterviews ?? 0}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  registradas en proyectos
                </p>
              </CardContent>
            </Card>

            <Link href="/personas/directorio">
              <Card className="cursor-pointer transition-colors hover:bg-muted/50">
                <CardHeader className="pb-2">
                  <CardDescription>Personas registradas</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold tabular-nums">
                    {stats?.totalPersons ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    en el directorio
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Problemas detectados</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold tabular-nums">
                  {stats?.totalProblems ?? 0}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  identificados por IA
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Section 3: Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Acciones rápidas</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => (
            <Card
              key={action.href}
              className="cursor-pointer transition-colors hover:bg-muted/50"
              onClick={() => router.push(action.href)}
            >
              <CardContent className="flex items-center gap-3 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <HugeiconsIcon icon={action.icon} className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{action.label}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {action.description}
                  </p>
                </div>
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  className="ml-auto size-4 shrink-0 text-muted-foreground"
                />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Section 4: Onboarding or Activity */}
      {!loading && !hasData && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Bienvenido a Zeru</CardTitle>
            <CardDescription>
              Para comenzar, te recomendamos seguir estos pasos:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  1
                </span>
                <span>
                  Registra personas en el{" "}
                  <Link
                    href="/personas/directorio"
                    className="font-medium text-foreground underline underline-offset-4"
                  >
                    directorio
                  </Link>
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  2
                </span>
                <span>
                  Crea un{" "}
                  <Link
                    href="/org-intelligence/projects"
                    className="font-medium text-foreground underline underline-offset-4"
                  >
                    proyecto de inteligencia organizacional
                  </Link>
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  3
                </span>
                <span>Agrega entrevistas y sube los audios</span>
              </li>
            </ol>
            <div className="mt-5">
              <Button asChild>
                <Link href="/org-intelligence/projects">
                  Comenzar
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    className="ml-1 size-4"
                  />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Income Statement (existing component) */}
      <div className="w-full">
        <IncomeStatement />
      </div>
    </div>
  );
}
