import Link from "next/link";

interface InterviewLinkProps {
  interviewId: string;
  projectId: string;
  title?: string;
  date?: string;
}

export function InterviewLink({
  interviewId,
  projectId,
  title,
  date,
}: InterviewLinkProps) {
  const href = `/org-intelligence/projects/${projectId}/interviews/${interviewId}`;
  const label = title ?? "Ver entrevista";
  const formattedDate = date
    ? new Date(date).toLocaleDateString("es-CL", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <Link
      href={href}
      className="text-xs text-primary hover:underline"
    >
      {label}
      {formattedDate && (
        <span className="ml-1 text-muted-foreground">({formattedDate})</span>
      )}
    </Link>
  );
}
