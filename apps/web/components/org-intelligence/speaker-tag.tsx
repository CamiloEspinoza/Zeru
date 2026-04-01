interface SpeakerTagProps {
  name: string;
  role?: string;
  isInterviewer?: boolean;
}

export function SpeakerTag({ name, role, isInterviewer }: SpeakerTagProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
        {name}
      </span>
      {role && (
        <span className="text-xs text-muted-foreground">{role}</span>
      )}
      {isInterviewer && (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
          Entrevistador
        </span>
      )}
    </div>
  );
}
