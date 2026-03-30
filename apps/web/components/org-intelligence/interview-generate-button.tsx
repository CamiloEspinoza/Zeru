"use client";

import { useState } from "react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface GeneratedQuestions {
  introText: string;
  sections: { theme: string; questions: { text: string; rationale?: string; priority: string }[] }[];
}

interface Props {
  interviewId: string;
  onGenerated: (data: GeneratedQuestions) => void;
  disabled?: boolean;
}

export function InterviewGenerateButton({ interviewId, onGenerated, disabled }: Props) {
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const result = await api.post<GeneratedQuestions>(
        `/org-intelligence/interviews/${interviewId}/generate-questions`,
        {},
      );
      onGenerated(result);
    } catch {
      toast.error("No se pudieron generar las preguntas. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleGenerate} disabled={disabled || loading}>
      {loading ? "Generando..." : "Generar Preguntas con IA"}
    </Button>
  );
}
