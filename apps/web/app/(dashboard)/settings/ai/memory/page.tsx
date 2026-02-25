"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

type MemoryCategory = "PREFERENCE" | "FACT" | "PROCEDURE" | "DECISION" | "CONTEXT";

interface MemoryRecord {
  id: string;
  content: string;
  category: MemoryCategory;
  importance: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  tenantId: string;
  userId: string | null;
  documentId: string | null;
}

const CATEGORY_LABELS: Record<MemoryCategory, string> = {
  PREFERENCE: "Preferencia",
  FACT: "Hecho",
  PROCEDURE: "Procedimiento",
  DECISION: "Decisión",
  CONTEXT: "Contexto",
};

function formatDate(s: string) {
  try {
    return new Date(s).toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return s;
  }
}

function MemoryList({
  scope,
  title,
  description,
  emptyMessage,
}: {
  scope: "tenant" | "user";
  title: string;
  description: string;
  emptyMessage: string;
}) {
  const [memories, setMemories] = useState<MemoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .get<MemoryRecord[]>(`/ai/memory?scope=${scope}`)
      .then(setMemories)
      .catch(() => setMemories([]))
      .finally(() => setLoading(false));
  }, [scope]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await api.delete(`/ai/memory/${id}`);
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch {
      // Error ya manejado por api
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando memorias…</p>
        ) : memories.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <ul className="space-y-3">
            {memories.map((m) => (
              <li
                key={m.id}
                className="rounded-lg border bg-muted/30 p-4 text-sm space-y-2"
              >
                <p className="text-foreground leading-relaxed">{m.content}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="font-normal">
                    {CATEGORY_LABELS[m.category]}
                  </Badge>
                  <span className="text-muted-foreground text-xs">
                    Importancia: {m.importance}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {formatDate(m.createdAt)}
                  </span>
                  {m.documentId && (
                    <Badge variant="outline" className="text-xs font-normal">
                      Desde documento
                    </Badge>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-destructive hover:text-destructive ml-auto"
                        disabled={deletingId === m.id}
                      >
                        {deletingId === m.id ? "Eliminando…" : "Eliminar"}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Eliminar memoria</AlertDialogTitle>
                        <AlertDialogDescription>
                          ¿Eliminar esta memoria? Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(m.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default function MemorySettingsPage() {
  const [activeView, setActiveView] = useState<"organization" | "user">("organization");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Memoria del asistente</h1>
        <p className="text-muted-foreground text-sm">
          Datos y preferencias que el asistente guarda para usar en futuras conversaciones.
        </p>
      </div>

      <div className="flex gap-2 border-b pb-2">
        <Button
          variant={activeView === "organization" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setActiveView("organization")}
          className={cn(activeView === "organization" && "bg-muted")}
        >
          Memoria de la organización
        </Button>
        <Button
          variant={activeView === "user" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setActiveView("user")}
          className={cn(activeView === "user" && "bg-muted")}
        >
          Memoria personal
        </Button>
      </div>

      {activeView === "organization" && (
        <MemoryList
          scope="tenant"
          title="Memoria de la organización"
          description="Hechos, preferencias y decisiones compartidos por toda la organización. Visible para todos los usuarios del tenant."
          emptyMessage="No hay memorias de organización aún. El asistente las creará al analizar documentos o conversaciones."
        />
      )}

      {activeView === "user" && (
        <MemoryList
          scope="user"
          title="Memoria personal"
          description="Preferencias y contexto solo para tu usuario. No las ven otros usuarios de la organización."
          emptyMessage="No hay memorias personales aún. El asistente las creará cuando indiques preferencias propias."
        />
      )}

      <p className="text-xs text-muted-foreground">
        <Link href="/settings/ai" className="underline hover:text-foreground">
          Configuración del asistente IA
        </Link>
      </p>
    </div>
  );
}
