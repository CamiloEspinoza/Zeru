"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { HelpTooltip } from "@/components/org-intelligence/help-tooltip";
import { PersonAvatar } from "@/components/org-intelligence/person-avatar";

interface Speaker {
  id: string;
  speakerLabel: string;
  name: string | null;
  role: string | null;
  department: string | { id: string; name: string } | null;
  isInterviewer: boolean;
  personEntityId: string | null;
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3017/api";

interface InterviewParticipantsCardProps {
  speakers: Speaker[];
  onAdd: () => void;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
  saving: boolean;
}

export function InterviewParticipantsCard({
  speakers,
  onAdd,
  onEdit,
  onDelete,
  saving,
}: InterviewParticipantsCardProps) {
  const hasSpeakers = speakers.length > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>Participantes de la Entrevista</CardTitle>
            <HelpTooltip text="Configurar los participantes antes de procesar el audio permite que la IA identifique mejor a cada hablante y asocie correctamente roles, departamentos y perspectivas en el análisis organizacional." />
          </div>
          <Button size="sm" onClick={onAdd} disabled={saving}>
            Agregar participante
          </Button>
        </div>
        <CardDescription>
          Define quiénes participaron en la entrevista, sus cargos y áreas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasSpeakers ? (
          <div className="space-y-3">
            {speakers.map((speaker, index) => (
              <div
                key={speaker.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  {speaker.personEntityId ? (
                    <PersonAvatar
                      name={speaker.name ?? speaker.speakerLabel}
                      avatarUrl={`${API_BASE}/avatars/person/${speaker.personEntityId}?s=96`}
                      size="sm"
                    />
                  ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                      {(speaker.name ?? speaker.speakerLabel)
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {speaker.name ?? speaker.speakerLabel}
                      </span>
                      <Badge
                        variant={speaker.isInterviewer ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {speaker.isInterviewer ? "Entrevistador" : "Entrevistado"}
                      </Badge>
                    </div>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      {speaker.role && <span>{speaker.role}</span>}
                      {speaker.role && speaker.department && <span>-</span>}
                      {speaker.department && (
                        <span>
                          {typeof speaker.department === "string"
                            ? speaker.department
                            : (speaker.department as { name: string }).name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(index)}
                    disabled={saving}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => onDelete(index)}
                    disabled={saving}
                  >
                    Eliminar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No hay participantes configurados.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Agregar participantes mejora la precisión del análisis con IA.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={onAdd}
            >
              Agregar primer participante
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
