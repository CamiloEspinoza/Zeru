"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface SkillFile {
  id: string;
  path: string;
}

interface Skill {
  id: string;
  name: string;
  description?: string | null;
  repoUrl: string;
  version?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  files: SkillFile[];
}

type InstallStatus = "idle" | "installing" | "success" | "error";
type SyncStatus = "idle" | "syncing";

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function SkillCard({
  skill,
  onToggle,
  onSync,
  onRemove,
}: {
  skill: Skill;
  onToggle: (id: string, isActive: boolean) => Promise<void>;
  onSync: (id: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [toggling, setToggling] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [removing, setRemoving] = useState(false);

  const refFiles = skill.files.filter(
    (f) => f.path.startsWith("references/") || f.path.startsWith("scripts/")
  );

  const handleToggle = async (checked: boolean) => {
    setToggling(true);
    try {
      await onToggle(skill.id, checked);
    } finally {
      setToggling(false);
    }
  };

  const handleSync = async () => {
    setSyncStatus("syncing");
    try {
      await onSync(skill.id);
    } finally {
      setSyncStatus("idle");
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await onRemove(skill.id);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <Card className={cn(!skill.isActive && "opacity-60")}>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base">{skill.name}</CardTitle>
              {skill.version && (
                <Badge variant="outline" className="text-xs font-mono">
                  v{skill.version}
                </Badge>
              )}
              {!skill.isActive && (
                <Badge variant="secondary" className="text-xs">
                  Inactivo
                </Badge>
              )}
            </div>
            {skill.description && (
              <CardDescription className="mt-1 text-sm line-clamp-2">
                {skill.description}
              </CardDescription>
            )}
            <a
              href={skill.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <GitHubIcon className="h-3 w-3" />
              {skill.repoUrl.replace("https://github.com/", "")}
            </a>
          </div>
          <Switch
            checked={skill.isActive}
            onCheckedChange={handleToggle}
            disabled={toggling}
            aria-label={skill.isActive ? "Desactivar skill" : "Activar skill"}
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {refFiles.length > 0 && (
              <span>
                {refFiles.length} archivo{refFiles.length !== 1 ? "s" : ""} de referencia
              </span>
            )}
            <span>
              Instalado{" "}
              {new Date(skill.createdAt).toLocaleDateString("es-CL", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSync}
              disabled={syncStatus === "syncing"}
              className="h-7 text-xs gap-1.5"
            >
              {syncStatus === "syncing" ? (
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              )}
              Sincronizar
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={removing}
                  className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
                >
                  {removing ? (
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-destructive border-t-transparent" />
                  ) : (
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  )}
                  Eliminar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar skill?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se eliminará el skill <strong>{skill.name}</strong> y todos sus archivos de
                    referencia. El agente dejará de usar sus instrucciones.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleRemove}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed px-6 py-10 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <svg className="h-6 w-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      </div>
      <p className="text-sm font-medium">Sin skills instalados</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Instala un skill pegando la URL de su repositorio de GitHub.
      </p>
      <p className="mt-3 text-xs text-muted-foreground">
        Ejemplo:{" "}
        <span className="font-mono">
          https://github.com/owner/repo/tree/main/skill-name
        </span>
      </p>
    </div>
  );
}

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);

  const [repoUrl, setRepoUrl] = useState("");
  const [installStatus, setInstallStatus] = useState<InstallStatus>("idle");
  const [installError, setInstallError] = useState("");

  useEffect(() => {
    api
      .get<Skill[]>("/ai/skills")
      .then(setSkills)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleInstall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim()) return;

    setInstallStatus("installing");
    setInstallError("");

    try {
      const skill = await api.post<Skill>("/ai/skills", {
        repoUrl: repoUrl.trim(),
      });
      setSkills((prev) => [skill, ...prev]);
      setRepoUrl("");
      setInstallStatus("success");
      setTimeout(() => setInstallStatus("idle"), 2500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al instalar el skill";
      setInstallError(msg);
      setInstallStatus("error");
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    const updated = await api.patch<Skill>(`/ai/skills/${id}`, { isActive });
    setSkills((prev) => prev.map((s) => (s.id === id ? updated : s)));
  };

  const handleSync = async (id: string) => {
    const updated = await api.put<Skill>(`/ai/skills/${id}/sync`, {});
    setSkills((prev) => prev.map((s) => (s.id === id ? updated : s)));
  };

  const handleRemove = async (id: string) => {
    await api.delete(`/ai/skills/${id}`);
    setSkills((prev) => prev.filter((s) => s.id !== id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const isInstalling = installStatus === "installing";

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Skills del Agente</h1>
        <p className="text-muted-foreground mt-1">
          Extiende las capacidades del asistente instalando skills desde GitHub. Sus
          instrucciones se inyectan en el contexto del agente.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Instalar skill</CardTitle>
          <CardDescription>
            Ingresa la URL del repositorio de GitHub que contiene el SKILL.md.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInstall} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="repoUrl">URL del repositorio</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <GitHubIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="repoUrl"
                    type="url"
                    placeholder="https://github.com/owner/repo/tree/main/skill-name"
                    value={repoUrl}
                    onChange={(e) => {
                      setRepoUrl(e.target.value);
                      if (installStatus === "error") {
                        setInstallStatus("idle");
                        setInstallError("");
                      }
                    }}
                    disabled={isInstalling}
                    className={cn(
                      "pl-9",
                      installStatus === "error" && "border-destructive focus-visible:ring-destructive",
                      installStatus === "success" && "border-green-500 focus-visible:ring-green-500"
                    )}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isInstalling || !repoUrl.trim()}
                  className="shrink-0"
                >
                  {isInstalling ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Instalando...
                    </>
                  ) : (
                    "Instalar"
                  )}
                </Button>
              </div>
              {installStatus === "error" && installError && (
                <p className="text-xs text-destructive">{installError}</p>
              )}
              {installStatus === "success" && (
                <p className="text-xs text-green-600 dark:text-green-400">
                  Skill instalado correctamente
                </p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {skills.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {skills.filter((s) => s.isActive).length} de {skills.length} activo
                {skills.length !== 1 ? "s" : ""}
              </p>
            </div>
            {skills.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                onToggle={handleToggle}
                onSync={handleSync}
                onRemove={handleRemove}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
