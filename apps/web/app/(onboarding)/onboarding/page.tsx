"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { AiConfigForm } from "@/components/config/ai-config-form";
import { StorageConfigForm } from "@/components/config/storage-config-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface OnboardingStatus {
  completed: boolean;
  steps: {
    aiConfigured: boolean;
    storageConfigured: boolean;
  };
}

const STEPS = [
  {
    id: "ai",
    title: "Asistente IA",
    description: "Conecta tu cuenta de OpenAI para habilitar el contador virtual.",
  },
  {
    id: "storage",
    title: "Almacenamiento",
    description: "Conecta Amazon S3 para guardar y analizar documentos.",
  },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepsDone, setStepsDone] = useState({ ai: false, storage: false });
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    api
      .get<OnboardingStatus>("/tenants/current/onboarding-status")
      .then((status) => {
        if (status.completed) {
          router.replace("/dashboard");
          return;
        }
        setStepsDone({
          ai: status.steps.aiConfigured,
          storage: status.steps.storageConfigured,
        });
        // Resume at first incomplete step
        if (status.steps.aiConfigured && !status.steps.storageConfigured) {
          setCurrentStep(1);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  const handleComplete = async () => {
    setCompleting(true);
    try {
      await api.post("/tenants/current/complete-onboarding", {});
      router.push("/dashboard");
    } catch {
      router.push("/dashboard");
    }
  };

  const handleSkip = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const isLastStep = currentStep === STEPS.length - 1;
  const step = STEPS[currentStep];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Paso {currentStep + 1} de {STEPS.length}
        </p>
        <h1 className="text-2xl font-bold">{step.title}</h1>
        <p className="text-muted-foreground">{step.description}</p>
      </div>

      {/* Progress indicator */}
      <div className="flex gap-2">
        {STEPS.map((s, i) => (
          <div
            key={s.id}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              i < currentStep
                ? "bg-primary"
                : i === currentStep
                  ? "bg-primary"
                  : "bg-muted",
            )}
          />
        ))}
      </div>

      {/* Step content */}
      <div>
        {currentStep === 0 && (
          <AiConfigForm
            showDeleteAction={false}
            onConfigured={() => setStepsDone((prev) => ({ ...prev, ai: true }))}
          />
        )}
        {currentStep === 1 && (
          <StorageConfigForm
            showDeleteAction={false}
            onConfigured={() =>
              setStepsDone((prev) => ({ ...prev, storage: true }))
            }
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button variant="ghost" onClick={handleSkip} disabled={completing}>
          Omitir
        </Button>
        <Button onClick={handleNext} disabled={completing}>
          {completing
            ? "Finalizando..."
            : isLastStep
              ? "Finalizar"
              : "Siguiente"}
        </Button>
      </div>
    </div>
  );
}
