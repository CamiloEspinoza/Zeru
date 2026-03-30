"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { InterviewKnowledgeSummary } from "./interview-knowledge-summary";
import { InterviewGenerateButton } from "./interview-generate-button";
import { InterviewQuestionGroup } from "./interview-question-group";

type Question = { text: string; rationale?: string; priority: string };
type Section = { theme: string; questions: Question[] };
interface Props { introText?: string; sections?: Section[]; interviewId: string; projectId: string; onQuestionsChange?: (s: Section[]) => void }

export function InterviewQuestionsView({ introText: init, sections: initS, interviewId, projectId, onQuestionsChange }: Props) {
  const [intro, setIntro] = useState(init ?? "");
  const [sections, setSections] = useState<Section[]>(initS ?? []);
  const has = sections.length > 0;

  const update = (s: Section[]) => { setSections(s); onQuestionsChange?.(s); };
  const onGen = (d: { introText: string; sections: Section[] }) => { setIntro(d.introText); update(d.sections); };
  const edit = (si: number, qi: number, text: string) =>
    update(sections.map((s, i) => i !== si ? s : { ...s, questions: s.questions.map((q, j) => j !== qi ? q : { ...q, text }) }));
  const del = (si: number, qi: number) =>
    update(sections.map((s, i) => i !== si ? s : { ...s, questions: s.questions.filter((_, j) => j !== qi) }));

  return (
    <div className="space-y-4">
      {!has && <InterviewKnowledgeSummary projectId={projectId} />}
      <div className="flex items-center gap-2">
        <InterviewGenerateButton interviewId={interviewId} onGenerated={onGen} />
        {has && <Button variant="outline" onClick={() => window.print()}>Imprimir guia</Button>}
      </div>
      {has && (
        <div className="space-y-4">
          {intro && <p className="text-sm text-muted-foreground">{intro}</p>}
          {sections.map((s, si) => (
            <InterviewQuestionGroup key={si} theme={s.theme} questions={s.questions}
              onEditQuestion={(qi, t) => edit(si, qi, t)} onDeleteQuestion={(qi) => del(si, qi)} />
          ))}
        </div>
      )}
    </div>
  );
}
