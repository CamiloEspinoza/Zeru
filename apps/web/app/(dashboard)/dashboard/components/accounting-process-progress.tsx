"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-client";
import { useTenantContext } from "@/providers/tenant-provider";
import type { FiscalPeriod, ProcessStepWithCompletion, AccountingStepCompletion, StepStatus } from "@zeru/shared";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CheckmarkCircle01Icon,
  Cancel01Icon,
  Clock01Icon,
  Loading02Icon,
  Settings02Icon,
} from "@hugeicons/core-free-icons";

// ─── Status helpers ───────────────────────────────────────────────

const STATUS_CYCLE: Record<StepStatus, StepStatus> = {
  PENDING: "IN_PROGRESS",
  IN_PROGRESS: "COMPLETED",
  COMPLETED: "PENDING",
  SKIPPED: "PENDING",
};

function StatusIcon({ status }: { status: StepStatus }) {
  if (status === "COMPLETED")
    return (
      <HugeiconsIcon
        icon={CheckmarkCircle01Icon}
        className="size-4 text-green-500 shrink-0"
      />
    );
  if (status === "IN_PROGRESS")
    return (
      <span className="size-4 shrink-0 flex items-center justify-center">
        <span className="size-2.5 rounded-full bg-amber-400 animate-pulse" />
      </span>
    );
  if (status === "SKIPPED")
    return (
      <HugeiconsIcon
        icon={Cancel01Icon}
        className="size-4 text-muted-foreground shrink-0"
      />
    );
  return (
    <HugeiconsIcon
      icon={Clock01Icon}
      className="size-4 text-muted-foreground shrink-0"
    />
  );
}

function StatusBadge({ status }: { status: StepStatus }) {
  const map: Record<StepStatus, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    PENDING: { label: "Pendiente", variant: "outline" },
    IN_PROGRESS: { label: "En proceso", variant: "secondary" },
    COMPLETED: { label: "Completado", variant: "default" },
    SKIPPED: { label: "Omitido", variant: "outline" },
  };
  const { label, variant } = map[status];
  return (
    <Badge variant={variant} className="text-[10px] px-1.5 py-0">
      {label}
    </Badge>
  );
}

// ─── Step row ─────────────────────────────────────────────────────

interface CompletedByUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface StepCompletionWithUser extends AccountingStepCompletion {
  completedBy?: CompletedByUser | null;
}

interface StepWithUser extends Omit<ProcessStepWithCompletion, "completion"> {
  completion: StepCompletionWithUser | null;
}

interface StepRowProps {
  step: StepWithUser;
  onToggle: (stepId: string, currentStatus: StepStatus) => void;
  updating: boolean;
}

function StepRow({ step, onToggle, updating }: StepRowProps) {
  const status: StepStatus = step.completion?.status ?? "PENDING";
  const isCompleted = status === "COMPLETED";

  return (
    <div
      className={`flex items-start gap-3 py-2.5 px-3 rounded-md cursor-pointer transition-colors ${
        updating ? "opacity-50 pointer-events-none" : "hover:bg-muted/40"
      }`}
      onClick={() => onToggle(step.id, status)}
      title="Click para cambiar estado"
    >
      <StatusIcon status={status} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-sm ${isCompleted ? "line-through text-muted-foreground" : "font-medium"}`}
          >
            {step.name}
          </span>
          <StatusBadge status={status} />
        </div>
        {step.description && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {step.description}
          </p>
        )}
        {step.completion?.completedBy && status === "COMPLETED" && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Completado por{" "}
            {step.completion.completedBy.firstName}{" "}
            {step.completion.completedBy.lastName}
            {step.completion.completedAt
              ? ` · ${new Date(step.completion.completedAt).toLocaleDateString("es-CL")}`
              : ""}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main widget ──────────────────────────────────────────────────

export function AccountingProcessProgress() {
  const { tenant } = useTenantContext();
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
  const [steps, setSteps] = useState<StepWithUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [periodsLoading, setPeriodsLoading] = useState(true);
  const [updatingStep, setUpdatingStep] = useState<string | null>(null);
  const [noSteps, setNoSteps] = useState(false);

  // Load periods
  useEffect(() => {
    const tenantId = tenant?.id ?? localStorage.getItem("tenant_id");
    if (!tenantId) return;

    api
      .get<FiscalPeriod[]>("/accounting/fiscal-periods", { tenantId })
      .then((ps) => {
        setPeriods(ps);
        if (ps.length > 0) setSelectedPeriodId(ps[0].id);
      })
      .finally(() => setPeriodsLoading(false));
  }, [tenant?.id]);

  // Load steps for selected period
  const loadSteps = useCallback(() => {
    const tenantId = tenant?.id ?? localStorage.getItem("tenant_id");
    if (!tenantId || !selectedPeriodId) return;

    setLoading(true);
    api
      .get<StepWithUser[]>(
        `/accounting/process/progress?fiscalPeriodId=${selectedPeriodId}`,
        { tenantId }
      )
      .then((data) => {
        setSteps(data);
        setNoSteps(data.length === 0);
      })
      .catch(() => setNoSteps(true))
      .finally(() => setLoading(false));
  }, [tenant?.id, selectedPeriodId]);

  useEffect(() => {
    loadSteps();
  }, [loadSteps]);

  const handleToggle = async (stepId: string, currentStatus: StepStatus) => {
    const tenantId = tenant?.id ?? localStorage.getItem("tenant_id");
    if (!tenantId || !selectedPeriodId) return;

    const nextStatus = STATUS_CYCLE[currentStatus];
    setUpdatingStep(stepId);

    try {
      await api.patch(
        `/accounting/process/progress/${stepId}`,
        { fiscalPeriodId: selectedPeriodId, status: nextStatus },
        { tenantId }
      );
      // Optimistic update
      setSteps((prev) =>
        prev.map((s) =>
          s.id === stepId
            ? {
                ...s,
                completion: {
                  ...(s.completion ?? {
                    id: "",
                    stepId,
                    fiscalPeriodId: selectedPeriodId,
                    notes: null,
                    completedAt: null,
                    completedById: null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  }),
                  status: nextStatus,
                  completedAt: nextStatus === "COMPLETED" ? new Date() : null,
                },
              }
            : s
        )
      );
    } finally {
      setUpdatingStep(null);
    }
  };

  const completed = steps.filter(
    (s) => s.completion?.status === "COMPLETED"
  ).length;
  const total = steps.length;
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span>Proceso Contable</span>
          <Link
            href="/settings/accounting-process"
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Configurar proceso"
          >
            <HugeiconsIcon icon={Settings02Icon} className="size-4" />
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-3 pb-3">
        {/* Period selector */}
        {periodsLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <HugeiconsIcon icon={Loading02Icon} className="size-3 animate-spin" />
            Cargando períodos...
          </div>
        ) : periods.length === 0 ? (
          <p className="text-xs text-muted-foreground">No hay períodos fiscales.</p>
        ) : (
          <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
            <SelectTrigger className="h-7 text-xs w-full">
              <SelectValue placeholder="Seleccionar período" />
            </SelectTrigger>
            <SelectContent>
              {periods.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Progress bar */}
        {!loading && !noSteps && total > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{completed} de {total} pasos completados</span>
              <span>{progressPct}%</span>
            </div>
            <Progress value={progressPct} className="h-1.5" />
          </div>
        )}

        {/* Steps list */}
        {loading ? (
          <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground justify-center">
            <HugeiconsIcon icon={Loading02Icon} className="size-4 animate-spin" />
            Cargando pasos...
          </div>
        ) : noSteps ? (
          <div className="py-3 text-center">
            <p className="text-xs text-muted-foreground">
              No hay pasos de proceso configurados.
            </p>
            <Link
              href="/settings/accounting-process"
              className="text-xs text-primary hover:underline mt-1 inline-block"
            >
              Configurar proceso contable →
            </Link>
          </div>
        ) : (
          <div className="space-y-0.5 -mx-1">
            {steps.map((step) => (
              <StepRow
                key={step.id}
                step={step}
                onToggle={handleToggle}
                updating={updatingStep === step.id}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
