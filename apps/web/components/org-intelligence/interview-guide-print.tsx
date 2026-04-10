"use client";

type Speaker = { name: string; role?: string; isInterviewer: boolean };
type Question = { text: string; priority: string };
type Section = { theme: string; questions: Question[] };
interface Props { interviewTitle: string; interviewDate?: string; speakers: Speaker[]; introText: string; sections: Section[]; projectName: string }

export function InterviewGuidePrint({ interviewTitle, interviewDate, speakers, introText, sections, projectName }: Props) {
  const interviewees = speakers.filter((s) => !s.isInterviewer);
  const interviewers = speakers.filter((s) => s.isInterviewer);
  const speakerLine = (s: Speaker) => `${s.name}${s.role ? ` — ${s.role}` : ""}`;

  return (
    <div className="print-container hidden print:block">
      <div className="space-y-4 p-8 text-black">
        <div className="border-b pb-4">
          <p className="text-xs uppercase tracking-widest text-gray-500">Guia de Entrevista</p>
          <h1 className="text-xl font-bold">{interviewTitle}</h1>
          <p className="text-sm text-gray-600">Proyecto: {projectName}{interviewDate ? ` · ${interviewDate}` : ""}</p>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><p className="font-semibold">Entrevistado(s)</p>{interviewees.map((s, i) => <p key={i}>{speakerLine(s)}</p>)}</div>
          <div><p className="font-semibold">Entrevistador(es)</p>{interviewers.map((s, i) => <p key={i}>{speakerLine(s)}</p>)}</div>
        </div>
        {introText && <div className="text-sm"><p className="font-semibold">Introduccion</p><p className="text-gray-700">{introText}</p></div>}
        {sections.map((sec, si) => (
          <div key={si} className="space-y-2">
            <h2 className="font-semibold text-base border-b pb-1">{sec.theme}</h2>
            {sec.questions.map((q, qi) => (
              <div key={qi} className="space-y-0.5">
                <p className="text-sm">&#x2610; {qi + 1}. {q.text}</p>
                <p className="text-xs text-gray-300">___________________________________________</p>
              </div>
            ))}
          </div>
        ))}
        <div className="mt-6 space-y-1">
          <p className="font-semibold text-sm">Notas adicionales</p>
          {Array.from({ length: 6 }).map((_, i) => <p key={i} className="text-xs text-gray-300">_______________________________________________________________________</p>)}
        </div>
      </div>
    </div>
  );
}
