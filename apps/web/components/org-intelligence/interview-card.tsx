"use client";

import { useRouter } from "next/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/org-intelligence/status-badge";
import { SpeakerAvatarChip } from "@/components/org-intelligence/speaker-avatar-chip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  MoreHorizontalCircle01Icon,
  Edit02Icon,
  Delete02Icon,
} from "@hugeicons/core-free-icons";

interface InterviewSpeaker {
  id: string;
  speakerLabel: string;
  name: string | null;
  role: string | null;
  department: string | null;
  isInterviewer: boolean;
}

interface Interview {
  id: string;
  title: string | null;
  interviewDate: string | null;
  objective: string | null;
  processingStatus: string;
  speakers: InterviewSpeaker[];
  createdAt: string;
}

interface InterviewCardProps {
  interview: Interview;
  projectId: string;
  onEdit: (interview: Interview) => void;
  onDelete: (interview: Interview) => void;
}

export function InterviewCard({
  interview,
  projectId,
  onEdit,
  onDelete,
}: InterviewCardProps) {
  const router = useRouter();

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const handleClick = () => {
    router.push(
      `/org-intelligence/projects/${projectId}/interviews/${interview.id}`,
    );
  };

  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-muted/50"
      onClick={handleClick}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-sm">
            {interview.title ?? "Entrevista sin título"}
          </CardTitle>
          <div className="flex items-center gap-1">
            <StatusBadge type="processing" value={interview.processingStatus} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <HugeiconsIcon
                    icon={MoreHorizontalCircle01Icon}
                    className="size-4"
                  />
                  <span className="sr-only">Acciones</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                onClick={(e) => e.stopPropagation()}
              >
                <DropdownMenuItem onClick={handleClick}>
                  Ver detalle
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit(interview)}>
                  <HugeiconsIcon icon={Edit02Icon} className="mr-2 size-4" />
                  Editar título
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => onDelete(interview)}
                >
                  <HugeiconsIcon icon={Delete02Icon} className="mr-2 size-4" />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <CardDescription>
          {formatDate(interview.interviewDate ?? interview.createdAt)}
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <div className="flex flex-wrap items-center gap-1.5">
          {interview.speakers && interview.speakers.length > 0 ? (
            interview.speakers.map((speaker) => (
              <SpeakerAvatarChip
                key={speaker.id}
                name={speaker.name ?? speaker.speakerLabel}
                isInterviewer={speaker.isInterviewer}
              />
            ))
          ) : (
            <span className="text-xs text-muted-foreground/70">
              Sin participantes configurados
            </span>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
