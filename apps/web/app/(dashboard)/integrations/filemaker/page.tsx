"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import type {
  FmLayout,
  FmLayoutMetadata,
  FmRecord,
  FmSyncStats,
  FmSyncRecordInfo,
  FmConnectionStatus,
} from "@zeru/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Spinner } from "@/components/ui/spinner";

// ── Sync log type (not in shared, defined locally) ──

interface FmSyncLog {
  id: string;
  operation: string;
  entityType: string;
  entityId: string;
  status: string;
  message?: string;
  createdAt: string;
}

// ── Search Fields Panel ──

function SearchFieldsPanel({
  fields,
  searchFields,
  onFieldChange,
}: {
  fields: { name: string; type: string; result: string }[];
  searchFields: Record<string, string>;
  onFieldChange: (name: string, value: string) => void;
}) {
  const [fieldFilter, setFieldFilter] = useState("");

  const filteredFields = useMemo(() => {
    if (!fieldFilter.trim()) return fields;
    const q = fieldFilter.toLowerCase();
    return fields.filter((f) => f.name.toLowerCase().includes(q));
  }, [fields, fieldFilter]);

  // Deduplicate and exclude unsearchable fields
  // FM Data API can't search on fields with dots (interpreted as JSON path),
  // related fields (::), or summary/calculation fields
  const uniqueFields = useMemo(() => {
    const seen = new Set<string>();
    return filteredFields.filter((f) => {
      if (seen.has(f.name)) return false;
      if (f.name.includes(".") || f.name.includes("::")) return false;
      if (f.type === "summary") return false;
      seen.add(f.name);
      return true;
    });
  }, [filteredFields]);

  const activeCount = Object.values(searchFields).filter(Boolean).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Filtrar campos..."
          value={fieldFilter}
          onChange={(e) => setFieldFilter(e.target.value)}
          className="h-8 text-sm"
        />
        {activeCount > 0 && (
          <Badge variant="secondary" className="shrink-0">
            {activeCount} filtro{activeCount !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>
      <div className="max-h-[40vh] overflow-y-auto rounded-md border p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {uniqueFields.map((field, idx) => (
            <div key={`search-${field.name}-${idx}`} className="space-y-1">
              <label className="flex items-baseline gap-1.5 text-xs text-muted-foreground">
                <span className="truncate">{field.name}</span>
                <span className="shrink-0 text-[10px] opacity-50">
                  {field.result}
                </span>
              </label>
              <Input
                placeholder={`Buscar en ${field.name}`}
                value={searchFields[field.name] ?? ""}
                onChange={(e) => onFieldChange(field.name, e.target.value)}
                className="h-7 text-xs"
              />
            </div>
          ))}
        </div>
        {uniqueFields.length === 0 && (
          <p className="text-muted-foreground py-4 text-center text-sm">
            Sin campos que coincidan con &quot;{fieldFilter}&quot;
          </p>
        )}
      </div>
    </div>
  );
}

// ── Layout List with search + animated chevrons ──

function LayoutList({
  layouts,
  selectedLayout,
  onSelect,
}: {
  layouts: FmLayout[];
  selectedLayout: string | null;
  onSelect: (name: string) => void;
}) {
  const [layoutSearch, setLayoutSearch] = useState("");

  const filteredLayouts = useMemo(() => {
    if (!layoutSearch.trim()) return layouts;
    const q = layoutSearch.toLowerCase();
    return layouts
      .map((layout) => {
        if (!layout.isFolder) {
          return layout.name.toLowerCase().includes(q) ? layout : null;
        }
        const matchingChildren = layout.folderLayoutNames?.filter((sub) =>
          sub.name.toLowerCase().includes(q),
        );
        const folderMatches = layout.name.toLowerCase().includes(q);
        if (folderMatches) return layout;
        if (matchingChildren && matchingChildren.length > 0) {
          return { ...layout, folderLayoutNames: matchingChildren };
        }
        return null;
      })
      .filter(Boolean) as FmLayout[];
  }, [layouts, layoutSearch]);

  return (
    <div className="space-y-2">
      <Input
        placeholder="Buscar layout..."
        value={layoutSearch}
        onChange={(e) => setLayoutSearch(e.target.value)}
        className="h-8 text-sm"
      />
      <div className="max-h-[60vh] space-y-0.5 overflow-y-auto">
        {filteredLayouts.length === 0 ? (
          <p className="text-muted-foreground px-2 py-4 text-center text-sm">
            Sin resultados para &quot;{layoutSearch}&quot;
          </p>
        ) : (
          filteredLayouts.map((layout, idx) =>
            layout.isFolder ? (
              <Collapsible
                key={`${layout.name}-${idx}`}
                defaultOpen={!!layoutSearch.trim()}
                className="group/folder"
              >
                <CollapsibleTrigger className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted">
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]/folder:rotate-90"
                  />
                  <span>{layout.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {layout.folderLayoutNames?.length ?? 0}
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent className="ml-5 border-l border-border pl-2 space-y-0.5">
                  {layout.folderLayoutNames?.map((sub, subIdx) => (
                    <button
                      key={`${sub.name}-${subIdx}`}
                      onClick={() => onSelect(sub.name)}
                      className={`block w-full rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-muted ${
                        selectedLayout === sub.name
                          ? "bg-primary/10 font-medium text-primary"
                          : "text-foreground"
                      }`}
                    >
                      {sub.name}
                    </button>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            ) : (
              <button
                key={`${layout.name}-${idx}`}
                onClick={() => onSelect(layout.name)}
                className={`block w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted ${
                  selectedLayout === layout.name
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-foreground"
                }`}
              >
                {layout.name}
              </button>
            ),
          )
        )}
      </div>
    </div>
  );
}

// ── Explorer Tab ──

function ExplorerTab() {
  const [databases, setDatabases] = useState<string[]>([]);
  const [selectedDb, setSelectedDb] = useState<string>("");
  const [connection, setConnection] = useState<FmConnectionStatus | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [layouts, setLayouts] = useState<FmLayout[]>([]);
  const [loadingLayouts, setLoadingLayouts] = useState(false);
  const [selectedLayout, setSelectedLayout] = useState<string>("");
  const [layoutsPanelOpen, setLayoutsPanelOpen] = useState(true);
  const [metadata, setMetadata] = useState<FmLayoutMetadata | null>(null);
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [sampleRecords, setSampleRecords] = useState<FmRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [loadingSample, setLoadingSample] = useState(false);
  const [searchFields, setSearchFields] = useState<Record<string, string>>({});
  const [searchResults, setSearchResults] = useState<FmRecord[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [searchTotal, setSearchTotal] = useState(0);

  useEffect(() => {
    api
      .get<string[]>("/filemaker/discovery/databases")
      .then(setDatabases)
      .catch(() => toast.error("Error al cargar bases de datos"));
  }, []);

  const testConnection = useCallback(async () => {
    if (!selectedDb) return;
    setTestingConnection(true);
    try {
      const status = await api.get<FmConnectionStatus>(
        `/filemaker/discovery/test-connection/${encodeURIComponent(selectedDb)}`,
      );
      setConnection(status);
      toast.success(
        status.connected ? "Conexión exitosa" : "Conexión fallida",
      );
    } catch {
      toast.error("Error al probar conexión");
    } finally {
      setTestingConnection(false);
    }
  }, [selectedDb]);

  const loadLayouts = useCallback(
    async (db: string) => {
      setLoadingLayouts(true);
      setSelectedLayout("");
      setLayoutsPanelOpen(true);
      setMetadata(null);
      setSampleRecords([]);
      setTotalRecords(0);
      setSearchResults([]);
      try {
        const data = await api.get<FmLayout[]>(
          `/filemaker/discovery/${encodeURIComponent(db)}/layouts`,
        );
        setLayouts(data);
      } catch {
        toast.error("Error al cargar layouts");
      } finally {
        setLoadingLayouts(false);
      }
    },
    [],
  );

  const handleDbChange = useCallback(
    (db: string) => {
      setSelectedDb(db);
      setConnection(null);
      loadLayouts(db);
    },
    [loadLayouts],
  );

  const selectLayout = useCallback(
    async (layout: string) => {
      if (!selectedDb) return;
      setSelectedLayout(layout);
      setLayoutsPanelOpen(false);
      setSearchResults([]);
      setSearchFields({});
      setSearchPage(1);

      setLoadingMetadata(true);
      setLoadingSample(true);

      try {
        const meta = await api.get<FmLayoutMetadata>(
          `/filemaker/discovery/${encodeURIComponent(selectedDb)}/layouts/${encodeURIComponent(layout)}/metadata`,
        );
        setMetadata(meta);
      } catch {
        toast.error("Error al cargar metadata");
      } finally {
        setLoadingMetadata(false);
      }

      try {
        const sample = await api.get<{ records: FmRecord[]; totalRecordCount: number }>(
          `/filemaker/discovery/${encodeURIComponent(selectedDb)}/layouts/${encodeURIComponent(layout)}/sample`,
        );
        setSampleRecords(sample.records ?? []);
        setTotalRecords(sample.totalRecordCount ?? 0);
      } catch {
        toast.error("Error al cargar registros de ejemplo");
      } finally {
        setLoadingSample(false);
      }
    },
    [selectedDb],
  );

  const handleSearch = useCallback(
    async (page = 1) => {
      if (!selectedDb || !selectedLayout) return;
      const activeFields = Object.fromEntries(
        Object.entries(searchFields).filter(([, v]) => v.trim() !== ""),
      );
      if (Object.keys(activeFields).length === 0) {
        toast.error("Ingresa al menos un criterio de búsqueda");
        return;
      }
      setSearching(true);
      setSearchPage(page);
      try {
        const res = await api.post<{
          records: FmRecord[];
          totalRecordCount: number;
        }>(
          `/filemaker/discovery/${encodeURIComponent(selectedDb)}/layouts/${encodeURIComponent(selectedLayout)}/search`,
          { query: [activeFields], offset: (page - 1) * 20 + 1, limit: 20 },
        );
        setSearchResults(res?.records ?? []);
        setSearchTotal(res.totalRecordCount ?? 0);
      } catch {
        toast.error("Error en la búsqueda");
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    },
    [selectedDb, selectedLayout, searchFields],
  );

  return (
    <div className="space-y-4">
      {/* Connection + DB Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Conexión a FileMaker</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Select value={selectedDb} onValueChange={handleDbChange}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Seleccionar base de datos" />
            </SelectTrigger>
            <SelectContent>
              {databases.map((db) => (
                <SelectItem key={db} value={db}>
                  {db}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={testConnection}
            disabled={!selectedDb || testingConnection}
          >
            {testingConnection ? (
              <Spinner size="sm" />
            ) : (
              "Probar conexión"
            )}
          </Button>

          {connection && (
            <Badge variant={connection.connected ? "default" : "destructive"}>
              {connection.connected ? "Conectado" : "Desconectado"}
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Layouts */}
      {selectedDb && (
        <Collapsible open={layoutsPanelOpen} onOpenChange={setLayoutsPanelOpen} className="group/layouts">
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer">
                <div className="flex w-full items-center justify-between">
                  <CardTitle className="text-sm">
                    Layouts
                    {selectedLayout && (
                      <span className="ml-2 font-normal text-muted-foreground">
                        — {selectedLayout}
                      </span>
                    )}
                  </CardTitle>
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    className="size-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]/layouts:rotate-90"
                  />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                {loadingLayouts ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Spinner size="sm" /> Cargando layouts...
                  </div>
                ) : layouts.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No se encontraron layouts
                  </p>
                ) : (
                  <LayoutList
                    layouts={layouts}
                    selectedLayout={selectedLayout}
                    onSelect={selectLayout}
                  />
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Layout Detail */}
      {selectedLayout && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-muted-foreground">
              {selectedLayout}
            </h3>
            {totalRecords > 0 && (
              <Badge variant="secondary" className="text-xs">
                {totalRecords.toLocaleString()} registros
              </Badge>
            )}
          </div>

          {/* Fields */}
          <Collapsible className="group/fields">
            <Card>
              <CollapsibleTrigger className="flex w-full items-center justify-between px-6 py-3 cursor-pointer">
                <CardTitle className="text-sm">
                  Campos
                  {metadata && (
                    <Badge variant="outline" className="ml-2">{metadata.fields.length}</Badge>
                  )}
                </CardTitle>
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  className="size-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]/fields:rotate-90"
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  {loadingMetadata ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Spinner size="sm" /> Cargando metadata...
                    </div>
                  ) : metadata ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nombre</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Resultado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {metadata.fields.map((field, fIdx) => (
                          <TableRow key={`${field.name}-${fIdx}`}>
                            <TableCell className="font-mono text-xs">
                              {field.name}
                            </TableCell>
                            <TableCell>{field.type}</TableCell>
                            <TableCell>{field.result}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : null}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Portals */}
          {metadata && metadata.portals.length > 0 && (
            <Collapsible className="group/portals-section">
              <Card>
                <CollapsibleTrigger className="flex w-full items-center justify-between px-6 py-3 cursor-pointer">
                  <CardTitle className="text-sm">
                    Portales
                    <Badge variant="outline" className="ml-2">{metadata.portals.length}</Badge>
                  </CardTitle>
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    className="size-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]/portals-section:rotate-90"
                  />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-2">
                    {metadata.portals.map((portal, pIdx) => (
                      <Collapsible key={`${portal.name}-${pIdx}`} className="group/portal">
                        <CollapsibleTrigger className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted">
                          <HugeiconsIcon
                            icon={ArrowRight01Icon}
                            className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]/portal:rotate-90"
                          />
                          {portal.name}{" "}
                          <Badge variant="outline">{portal.fields.length}</Badge>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-1">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Resultado</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {portal.fields.map((field, pfIdx) => (
                                <TableRow key={`${field.name}-${pfIdx}`}>
                                  <TableCell className="font-mono text-xs">
                                    {field.name}
                                  </TableCell>
                                  <TableCell>{field.type}</TableCell>
                                  <TableCell>{field.result}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {/* Sample Records */}
          <Collapsible className="group/sample">
            <Card>
              <CollapsibleTrigger className="flex w-full items-center justify-between px-6 py-3 cursor-pointer">
                <CardTitle className="text-sm">
                  Registros de ejemplo
                  {sampleRecords.length > 0 && (
                    <Badge variant="outline" className="ml-2">{sampleRecords.length}</Badge>
                  )}
                </CardTitle>
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  className="size-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]/sample:rotate-90"
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  {loadingSample ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Spinner size="sm" /> Cargando registros...
                    </div>
                  ) : (
                    <RecordTable records={sampleRecords} />
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Search */}
          <Collapsible className="group/search">
            <Card>
              <CollapsibleTrigger className="flex w-full items-center justify-between px-6 py-3 cursor-pointer">
                <CardTitle className="text-sm">Buscar registros</CardTitle>
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  className="size-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]/search:rotate-90"
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
            <CardContent className="space-y-3">
              {metadata && (
                <SearchFieldsPanel
                  fields={metadata.fields}
                  searchFields={searchFields}
                  onFieldChange={(name, value) =>
                    setSearchFields((prev) => ({ ...prev, [name]: value }))
                  }
                />
              )}
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => handleSearch(1)}
                  disabled={searching}
                >
                  {searching ? <Spinner size="sm" /> : "Buscar"}
                </Button>
                {searchTotal > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {searchTotal} resultado{searchTotal !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              {searchResults.length > 0 && (
                <>
                  <RecordTable records={searchResults} />
                  {searchTotal > 20 && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={searchPage <= 1}
                        onClick={() => handleSearch(searchPage - 1)}
                      >
                        Anterior
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Página {searchPage} de {Math.ceil(searchTotal / 20)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={searchPage >= Math.ceil(searchTotal / 20)}
                        onClick={() => handleSearch(searchPage + 1)}
                      >
                        Siguiente
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>
      )}
    </div>
  );
}

// ── Record Table (reusable for sample + search) ──

function RecordTable({ records }: { records: FmRecord[] }) {
  if (records.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No hay registros</p>
    );
  }

  const columns = Object.keys(records[0].fieldData);

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            {columns.slice(0, 10).map((col) => (
              <TableHead key={col}>{col}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => (
            <TableRow key={record.recordId}>
              <TableCell className="font-mono">{record.recordId}</TableCell>
              {columns.slice(0, 10).map((col) => (
                <TableCell key={col} className="max-w-48 truncate">
                  {String(record.fieldData[col] ?? "")}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {columns.length > 10 && (
        <p className="mt-1 text-xs text-muted-foreground">
          Mostrando 10 de {columns.length} columnas
        </p>
      )}
    </div>
  );
}

// ── Sync Status Tab ──

// ── Import Panel ──

interface ImportResult {
  legalEntitiesCreated: number;
  legalEntitiesUpdated: number;
  labOriginsCreated: number;
  labOriginsUpdated: number;
  labOriginsSkippedDeleted: number;
  legalEntitiesSkippedDeleted: number;
  contactsImported: number;
  pricingImported: number;
  billingConceptsCreated: number;
  billingConceptsUpdated: number;
  billingAgreementsCreated: number;
  billingAgreementsUpdated: number;
  billingLinesImported: number;
  billingContactsImported: number;
  errors: Array<{ fmRecordId: string; error: string }>;
}

function ImportPanel({ onComplete }: { onComplete: () => void }) {
  const [importing, setImporting] = useState(false);
  const [polling, setPolling] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const startImport = useCallback(async () => {
    setImporting(true);
    setResult(null);
    try {
      const res = await api.post<{ started: boolean; message: string }>(
        "/filemaker/import/convenios",
        {},
      );
      if (!res.started) {
        toast.error(res.message);
        setImporting(false);
        return;
      }
      toast.success("Import iniciado en background");
      setPolling(true);
    } catch {
      toast.error("Error al iniciar import");
      setImporting(false);
    }
  }, []);

  // Poll sync stats to detect completion
  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(async () => {
      try {
        const stats = await api.get<FmSyncStats>("/filemaker/sync/stats");
        // When no more pending records and total > 0, import likely done
        if (stats.total > 0 && stats.pendingToZeru === 0 && stats.pendingToFm === 0) {
          // Fetch latest logs to check for import completion
          const logs = await api.get<FmSyncLog[]>("/filemaker/sync/logs?limit=1");
          if (logs.length > 0 && logs[0].operation?.includes("import")) {
            setPolling(false);
            setImporting(false);
            onComplete();
            toast.success("Import completado");
          }
        }
      } catch {
        // Ignore polling errors
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [polling, onComplete]);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm">Importar desde FileMaker</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <Button
            onClick={startImport}
            disabled={importing}
            size="sm"
          >
            {importing ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Importando Convenios...
              </>
            ) : (
              "Importar Convenios"
            )}
          </Button>
          <span className="text-xs text-muted-foreground">
            Import integral: Conceptos, Convenios, Procedencias
          </span>
        </div>
        {importing && (
          <p className="text-xs text-muted-foreground">
            El import se ejecuta en background. Los stats se actualizan automáticamente.
          </p>
        )}
        {result && (
          <div className="grid gap-2 rounded-md border p-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <span className="text-muted-foreground">Conceptos (CDC): </span>
              <span className="font-medium">{result.billingConceptsCreated} creados, {result.billingConceptsUpdated} actualizados</span>
            </div>
            <div>
              <span className="text-muted-foreground">Convenios: </span>
              <span className="font-medium">{result.billingAgreementsCreated} creados, {result.billingAgreementsUpdated} actualizados</span>
            </div>
            <div>
              <span className="text-muted-foreground">Personas jurídicas: </span>
              <span className="font-medium">{result.legalEntitiesCreated} creadas, {result.legalEntitiesUpdated} actualizadas</span>
            </div>
            <div>
              <span className="text-muted-foreground">Procedencias: </span>
              <span className="font-medium">{result.labOriginsCreated} creadas, {result.labOriginsUpdated} actualizadas</span>
            </div>
            <div>
              <span className="text-muted-foreground">Líneas de precio: </span>
              <span className="font-medium">{result.billingLinesImported}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Contactos cobranza: </span>
              <span className="font-medium">{result.billingContactsImported}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Contactos LE: </span>
              <span className="font-medium">{result.contactsImported}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Precios procedencia: </span>
              <span className="font-medium">{result.pricingImported}</span>
            </div>
            {result.errors.length > 0 && (
              <div className="col-span-full">
                <span className="text-destructive font-medium">{result.errors.length} errores</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Sync Status Tab ──

function SyncStatusTab() {
  const [stats, setStats] = useState<FmSyncStats | null>(null);
  const [errors, setErrors] = useState<FmSyncRecordInfo[]>([]);
  const [logs, setLogs] = useState<FmSyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, errorsRes, logsRes] = await Promise.all([
        api.get<FmSyncStats>("/filemaker/sync/stats"),
        api.get<FmSyncRecordInfo[]>("/filemaker/sync/errors"),
        api.get<FmSyncLog[]>("/filemaker/sync/logs"),
      ]);
      setStats(statsRes);
      setErrors(errorsRes);
      setLogs(logsRes);
    } catch {
      toast.error("Error al cargar estado de sincronización");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const retry = useCallback(
    async (id: string) => {
      setRetrying(id);
      try {
        await api.post(`/filemaker/sync/retry/${id}`, {});
        toast.success("Reintento iniciado");
        fetchData();
      } catch {
        toast.error("Error al reintentar");
      } finally {
        setRetrying(null);
      }
    },
    [fetchData],
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-muted-foreground">
        <Spinner size="sm" /> Cargando estado de sincronización...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Import Panel */}
      <ImportPanel onComplete={fetchData} />

      {/* Stats Counters */}
      {stats && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Sincronizados" value={stats.synced} variant="default" />
          <StatCard label="Pendientes FM" value={stats.pendingToFm} variant="secondary" />
          <StatCard label="Pendientes Zeru" value={stats.pendingToZeru} variant="secondary" />
          <StatCard label="Errores" value={stats.error} variant="destructive" />
          <StatCard label="Total" value={stats.total} variant="outline" />
        </div>
      )}

      {/* Errors Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Errores recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {errors.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin errores</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entidad</TableHead>
                  <TableHead>Layout</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead>Reintentos</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {errors.map((err) => (
                  <TableRow key={err.id}>
                    <TableCell>
                      {err.entityType}:{err.entityId}
                    </TableCell>
                    <TableCell>{err.fmLayout}</TableCell>
                    <TableCell className="max-w-64 truncate text-destructive">
                      {err.syncError}
                    </TableCell>
                    <TableCell>{err.retryCount}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => retry(err.id)}
                        disabled={retrying === err.id}
                      >
                        {retrying === err.id ? (
                          <Spinner size="sm" />
                        ) : (
                          "Reintentar"
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Logs recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin logs</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Operación</TableHead>
                  <TableHead>Entidad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Mensaje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString("es-CL")}
                    </TableCell>
                    <TableCell>{log.operation}</TableCell>
                    <TableCell>
                      {log.entityType}:{log.entityId}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          log.status === "SUCCESS" ? "default" : "destructive"
                        }
                      >
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-64 truncate">
                      {log.message}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Stat Card ──

function StatCard({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant: "default" | "secondary" | "destructive" | "outline";
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between py-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Badge variant={variant} className="text-sm">
          {value}
        </Badge>
      </CardContent>
    </Card>
  );
}

// ── Main Page ──

export default function FileMakerDiscoveryPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">FileMaker Discovery</h1>
        <a href="/docs/filemaker-webhooks" target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm">
            Guía: Configurar webhooks en FM
          </Button>
        </a>
      </div>

      <Tabs defaultValue="explorer">
        <TabsList>
          <TabsTrigger value="explorer">Explorador</TabsTrigger>
          <TabsTrigger value="sync">Estado de Sync</TabsTrigger>
        </TabsList>

        <TabsContent value="explorer">
          <ExplorerTab />
        </TabsContent>

        <TabsContent value="sync">
          <SyncStatusTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
