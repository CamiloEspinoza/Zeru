import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SpeakerTag } from "./speaker-tag";
import { InterviewLink } from "./interview-link";
import { TimestampBadge } from "./timestamp-badge";
import { AudioClipPlayer } from "./audio-clip-player";

interface ChunkCardProps {
  content: string;
  speakerName?: string;
  speakerRole?: string;
  isInterviewer?: boolean;
  interviewId: string;
  interviewTitle?: string;
  interviewDate?: string;
  startTimeMs?: number;
  endTimeMs?: number;
  hasAudio?: boolean;
  similarity?: number;
  projectId: string;
}

export function ChunkCard({
  content,
  speakerName,
  speakerRole,
  isInterviewer,
  interviewId,
  interviewTitle,
  interviewDate,
  startTimeMs,
  endTimeMs,
  hasAudio,
  similarity,
  projectId,
}: ChunkCardProps) {
  const showTimestamp =
    startTimeMs !== undefined && startTimeMs !== null &&
    endTimeMs !== undefined && endTimeMs !== null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          {speakerName && (
            <SpeakerTag
              name={speakerName}
              role={speakerRole}
              isInterviewer={isInterviewer}
            />
          )}
          {showTimestamp && (
            <TimestampBadge startMs={startTimeMs!} endMs={endTimeMs!} />
          )}
          {hasAudio && showTimestamp && (
            <AudioClipPlayer
              interviewId={interviewId}
              startMs={startTimeMs!}
              endMs={endTimeMs!}
            />
          )}
          {similarity != null && (
            <span className="ml-auto text-xs text-muted-foreground">
              Relevancia: {Math.round(similarity * 100)}%
            </span>
          )}
        </div>
        <div className="mt-1">
          <InterviewLink
            interviewId={interviewId}
            projectId={projectId}
            title={interviewTitle}
            date={interviewDate}
          />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm leading-relaxed">{content}</p>
      </CardContent>
    </Card>
  );
}
