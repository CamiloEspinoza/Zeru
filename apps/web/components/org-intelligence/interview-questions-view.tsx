"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { InterviewGenerateButton } from "./interview-generate-button";
import { InterviewQuestionGroup } from "./interview-question-group";

type Question = { text: string; rationale?: string; priority: string };
type Section = { theme: string; questions: Question[] };

interface Props {
  introText?: string;
  sections?: Section[];
  interviewId: string;
  onQuestionsChange?: (s: Section[]) => void;
}

export function InterviewQuestionsView({
  introText: init,
  sections: initS,
  interviewId,
  onQuestionsChange,
}: Props) {
  const [intro, setIntro] = useState(init ?? "");
  const [sections, setSections] = useState<Section[]>(initS ?? []);
  const [downloading, setDownloading] = useState(false);
  const [checkedQuestions, setCheckedQuestions] = useState<Set<string>>(
    new Set(),
  );
  const has = sections.length > 0;

  // Debounced save to backend
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistSections = useCallback(
    (updated: Section[]) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          await api.patch(
            `/org-intelligence/interviews/${interviewId}/questions`,
            { sections: updated },
          );
        } catch {
          // silent — local state is source of truth during editing
        }
      }, 1500);
    },
    [interviewId],
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const downloadPdf = async () => {
    const el = document.querySelector(
      ".print-container",
    ) as HTMLElement | null;
    if (!el) return;
    setDownloading(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      el.style.display = "block";
      await html2pdf()
        .set({
          margin: [10, 10, 10, 10],
          filename: "guia-entrevista.pdf",
          html2canvas: { scale: 2 },
          jsPDF: { unit: "mm", format: "letter", orientation: "portrait" },
        })
        .from(el)
        .save();
      el.style.display = "";
    } catch {
      window.print();
    } finally {
      setDownloading(false);
    }
  };

  const update = (s: Section[]) => {
    setSections(s);
    onQuestionsChange?.(s);
    persistSections(s);
  };

  const onGen = (d: { introText: string; sections: Section[] }) => {
    setIntro(d.introText);
    setSections(d.sections);
    onQuestionsChange?.(d.sections);
    setCheckedQuestions(new Set());
  };

  const edit = (si: number, qi: number, text: string) =>
    update(
      sections.map((s, i) =>
        i !== si
          ? s
          : {
              ...s,
              questions: s.questions.map((q, j) =>
                j !== qi ? q : { ...q, text },
              ),
            },
      ),
    );

  const discard = (si: number, qi: number) =>
    update(
      sections.map((s, i) =>
        i !== si
          ? s
          : { ...s, questions: s.questions.filter((_, j) => j !== qi) },
      ),
    );

  const handleCheckedChange = (key: string, checked: boolean) => {
    setCheckedQuestions((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <InterviewGenerateButton
          interviewId={interviewId}
          onGenerated={onGen}
        />
        {has && (
          <Button
            variant="outline"
            onClick={downloadPdf}
            disabled={downloading}
          >
            {downloading ? "Generando PDF..." : "Descargar PDF"}
          </Button>
        )}
      </div>
      {has && (
        <div className="space-y-4">
          {intro && (
            <p className="text-sm text-muted-foreground">{intro}</p>
          )}
          {sections.map((s, si) => (
            <InterviewQuestionGroup
              key={si}
              theme={s.theme}
              questions={s.questions}
              checkedSet={checkedQuestions}
              onCheckedChange={handleCheckedChange}
              onEditQuestion={(qi, t) => edit(si, qi, t)}
              onDiscardQuestion={(qi) => discard(si, qi)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
