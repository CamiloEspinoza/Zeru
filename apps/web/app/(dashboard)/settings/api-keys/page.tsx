"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { useTenantContext } from "@/providers/tenant-provider";
import {
  API_KEY_SCOPES,
  API_KEY_SCOPE_LABELS,
  type ApiKey,
  type ApiKeyScope,
  type CreateApiKeyResponse,
} from "@zeru/shared";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Checkbox } from "@/components/ui/checkbox";

function TenantIdField() {
  const { tenant } = useTenantContext();
  const [copied, setCopied] = useState(false);
  const value = tenant?.id ?? "";
  const handleCopy = async () => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 font-mono text-xs bg-muted border rounded px-3 py-2 select-all break-all">
        {value || "Cargando..."}
      </code>
      <Button variant="outline" size="sm" onClick={handleCopy} disabled={!value} className="shrink-0">
        {copied ? "¡Copiado!" : "Copiar"}
      </Button>
    </div>
  );
}

const SCOPE_GROUPS: { label: string; scopes: ApiKeyScope[] }[] = [
  {
    label: "Plan de cuentas",
    scopes: ["accounts:read", "accounts:write"],
  },
  {
    label: "Asientos contables",
    scopes: [
      "journal-entries:read",
      "journal-entries:write",
      "journal-entries:manage",
    ],
  },
  {
    label: "Períodos fiscales",
    scopes: ["fiscal-periods:read"],
  },
  {
    label: "Reportes",
    scopes: ["reports:read"],
  },
];

export default function ApiKeysPage() {
  const { tenant } = useTenantContext();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<Set<ApiKeyScope>>(
    new Set()
  );
  const [creating, setCreating] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchKeys = async () => {
    const tenantId = tenant?.id ?? localStorage.getItem("tenant_id");
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<ApiKey[]>("/api-keys", { tenantId });
      setKeys(data);
    } catch (e) {
      setError((e as Error).message ?? "Error al cargar API keys");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, [tenant?.id]);

  const toggleScope = (scope: ApiKeyScope) => {
    setSelectedScopes((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      return next;
    });
  };

  const handleCreate = async () => {
    const tenantId = tenant?.id ?? localStorage.getItem("tenant_id");
    if (!tenantId || !newName.trim() || selectedScopes.size === 0) return;
    setCreating(true);
    try {
      const res = await api.post<CreateApiKeyResponse>(
        "/api-keys",
        { name: newName.trim(), scopes: Array.from(selectedScopes) },
        { tenantId },
      );
      setCreatedSecret(res.secret);
      setKeys((prev) => [res.apiKey, ...prev]);
    } catch (e) {
      setError((e as Error).message ?? "Error al crear API key");
    } finally {
      setCreating(false);
    }
  };

  const handleCloseCreate = () => {
    setCreateOpen(false);
    setNewName("");
    setSelectedScopes(new Set());
    setCreatedSecret(null);
    setCopied(false);
  };

  const handleCopy = async () => {
    if (!createdSecret) return;
    await navigator.clipboard.writeText(createdSecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevoke = async (id: string) => {
    const tenantId = tenant?.id ?? localStorage.getItem("tenant_id");
    if (!tenantId) return;
    try {
      await api.delete(`/api-keys/${id}`, { tenantId });
      setKeys((prev) => prev.filter((k) => k.id !== id));
    } catch (e) {
      setError((e as Error).message ?? "Error al revocar API key");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">API Keys</h1>
        <p className="text-muted-foreground">
          Genera claves para que aplicaciones externas accedan a tu contabilidad.
          Cada clave tiene permisos (scopes) específicos que tú controlas.
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="flex justify-end">
        <Dialog
          open={createOpen}
          onOpenChange={(open: boolean) => {
            if (!open) handleCloseCreate();
            else setCreateOpen(true);
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => setCreateOpen(true)}>Nueva API key</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            {!createdSecret ? (
              <>
                <DialogHeader>
                  <DialogTitle>Crear API key</DialogTitle>
                  <DialogDescription>
                    Asigna un nombre descriptivo y elige los permisos que tendrá
                    esta clave.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="key-name">Nombre</Label>
                    <Input
                      id="key-name"
                      placeholder="Ej: Mi sistema ERP"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>Permisos (scopes)</Label>
                    {SCOPE_GROUPS.map((group) => (
                      <div key={group.label}>
                        <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
                          {group.label}
                        </p>
                        <div className="space-y-1.5">
                          {group.scopes.map((scope) => (
                            <label
                              key={scope}
                              className="flex items-center gap-2.5 cursor-pointer select-none"
                            >
                              <Checkbox
                                checked={selectedScopes.has(scope)}
                                onCheckedChange={() => toggleScope(scope)}
                              />
                              <span className="text-sm">
                                <span className="font-mono text-xs bg-muted rounded px-1 py-0.5 mr-1.5">
                                  {scope}
                                </span>
                                {API_KEY_SCOPE_LABELS[scope]}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={handleCloseCreate}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleCreate}
                    disabled={
                      creating ||
                      !newName.trim() ||
                      selectedScopes.size === 0
                    }
                  >
                    {creating ? "Generando..." : "Generar API key"}
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>API key creada</DialogTitle>
                  <DialogDescription>
                    Copia esta clave ahora. No se mostrará de nuevo.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  <div className="rounded-lg border bg-muted p-4 space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Tu nueva API key:
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs font-mono bg-background rounded border px-3 py-2 break-all select-all">
                        {createdSecret}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopy}
                        className="shrink-0"
                      >
                        {copied ? "¡Copiado!" : "Copiar"}
                      </Button>
                    </div>
                    <p className="text-xs text-destructive font-medium">
                      Guárdala en un lugar seguro. Esta clave no se puede
                      recuperar después de cerrar esta ventana.
                    </p>
                  </div>
                </div>

                <DialogFooter>
                  <Button onClick={handleCloseCreate}>Listo</Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tus API keys</CardTitle>
          <CardDescription>
            Las claves activas de tu organización. Puedes revocarlas en
            cualquier momento.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : keys.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay API keys activas. Crea una para integrar aplicaciones
              externas.
            </p>
          ) : (
            <div className="space-y-3">
              {keys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-start justify-between gap-4 rounded-lg border px-4 py-3"
                >
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{key.name}</p>
                      <code className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {key.keyPrefix}
                      </code>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {key.scopes.map((scope) => (
                        <Badge
                          key={scope}
                          variant="secondary"
                          className="text-xs font-mono"
                        >
                          {scope}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Creada{" "}
                      {new Date(key.createdAt).toLocaleDateString("es-CL", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                      {key.lastUsedAt && (
                        <>
                          {" · "}
                          Último uso{" "}
                          {new Date(key.lastUsedAt).toLocaleDateString(
                            "es-CL",
                            { year: "numeric", month: "short", day: "numeric" }
                          )}
                        </>
                      )}
                    </p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 text-destructive hover:text-destructive"
                      >
                        Revocar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Revocar esta API key?</AlertDialogTitle>
                        <AlertDialogDescription>
                          La clave <strong>{key.name}</strong> ({key.keyPrefix})
                          quedará inactiva inmediatamente. Las aplicaciones que
                          la usen dejarán de funcionar. Esta acción no se puede
                          deshacer.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => handleRevoke(key.id)}
                        >
                          Revocar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Uso de la API</CardTitle>
          <CardDescription>
            Incluye tu API key y tu Tenant ID en el header de cada petición.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Tu Tenant ID</p>
            <TenantIdField />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Ejemplo de petición</p>
            <pre className="text-xs font-mono bg-muted rounded-lg p-4 overflow-x-auto">
              {`Authorization: Bearer zk_your_api_key_here
X-Tenant-Id: your_tenant_id`}
            </pre>
          </div>
          <p className="text-sm text-muted-foreground">
            Consulta la{" "}
            <a
              href="/docs"
              target="_blank"
              className="text-primary underline underline-offset-2"
            >
              documentación de la API
            </a>{" "}
            para ver todos los endpoints disponibles.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
