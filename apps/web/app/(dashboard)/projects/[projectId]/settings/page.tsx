"use client";

import { use } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useProject } from "@/hooks/use-project";
import { projectsApi } from "@/lib/api/projects";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon } from "@hugeicons/core-free-icons";

export default function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const router = useRouter();
  const { project, loading } = useProject(projectId);

  async function handleDelete() {
    if (
      !confirm(
        "¿Estás seguro de eliminar este proyecto? Esta acción no se puede deshacer.",
      )
    )
      return;
    try {
      await projectsApi.remove(projectId);
      toast.success("Proyecto eliminado");
      router.push("/projects");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al eliminar proyecto",
      );
    }
  }

  if (loading || !project) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Miembros</CardTitle>
          <CardDescription>
            Personas con acceso a este proyecto
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(project.members ?? []).map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="size-8">
                    <AvatarFallback className="text-xs">
                      {(
                        (member.user.firstName?.[0] ?? "") +
                        (member.user.lastName?.[0] ?? "")
                      ).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">
                      {member.user.firstName} {member.user.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {member.user.email}
                    </p>
                  </div>
                </div>
                <Badge variant="outline">{member.role}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Estados personalizados</CardTitle>
          <CardDescription>
            Los estados se muestran como columnas en el board
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(project.taskStatuses ?? [])
              .slice()
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((status) => (
                <div
                  key={status.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="size-3 rounded-full"
                      style={{ backgroundColor: status.color ?? "#6B7280" }}
                    />
                    <span className="text-sm font-medium">{status.name}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {status.category}
                  </Badge>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Zona de peligro</CardTitle>
          <CardDescription>
            Eliminar el proyecto archivará todas sus tareas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleDelete}>
            <HugeiconsIcon icon={Delete02Icon} className="mr-2 size-4" />
            Eliminar proyecto
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
