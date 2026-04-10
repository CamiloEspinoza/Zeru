"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  type ReactFlowInstance,
  type NodeMouseHandler,
  type FinalConnectionState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { Skeleton } from "@/components/ui/skeleton";
import { EducationalEmptyState } from "@/components/org-intelligence/educational-empty-state";
import { HelpTooltip } from "@/components/org-intelligence/help-tooltip";
import { useDebouncedSearch } from "@/hooks/use-debounced-search";

import { useOrgChart } from "@/hooks/org-intelligence/use-orgchart";
import { useOrgChartActions } from "@/hooks/org-intelligence/use-orgchart-actions";
import { useExpandCollapse } from "@/hooks/org-intelligence/use-expand-collapse";
import { useViewportPersistence } from "@/hooks/org-intelligence/use-viewport-persistence";
import { usePathHighlight } from "@/hooks/org-intelligence/use-path-highlight";

import { OrgChartNode } from "./orgchart-node";
import { OrgChartEdge } from "./orgchart-edge";
import { OrgChartContextMenu } from "./orgchart-context-menu";
import { OrgChartToolbar } from "./orgchart-toolbar";
import { OrgChartSidebar } from "./orgchart-sidebar";
import { AddPersonDialog } from "./add-person-dialog";
import type {
  ContextMenuState,
  OrgChartNodeData,
  OrgNode,
} from "./types";

/* ---------- Node & edge type maps (defined outside component to avoid re-renders) ---------- */

const nodeTypes = { orgChartNode: OrgChartNode };
const edgeTypes = { orgChartEdge: OrgChartEdge };

/* ---------- Constants ---------- */

const INITIAL_CONTEXT_MENU: ContextMenuState = {
  visible: false,
  x: 0,
  y: 0,
  nodeId: "",
  nodeName: "",
  hasReportsTo: false,
};

/* ---------- Component ---------- */

export function OrgChartCanvas() {
  /* ----- Core data hook ----- */
  const {
    nodes,
    edges,
    setEdges,
    onNodesChange,
    onEdgesChange,
    stats,
    loading,
    isEmpty,
    unassigned,
    fetchOrgChart,
    refetchPreservingViewport,
  } = useOrgChart();

  /* ----- Actions hook ----- */
  const {
    onConnect,
    onEdgesDelete,
    onReconnect,
    unlinkPerson,
    deletePerson,
  } = useOrgChartActions({
    nodes,
    edges,
    setEdges,
    refetch: refetchPreservingViewport,
  });

  /* ----- Expand / collapse hook ----- */
  const {
    visibleNodes,
    visibleEdges,
    toggleExpand,
    expandAll,
    collapseAll,
    collapsedIds,
    getHiddenCount,
  } = useExpandCollapse(nodes, edges);

  /* ----- Debounced search ----- */
  const { search, debouncedSearch, setSearch } = useDebouncedSearch();

  /* ----- Path highlight hook ----- */
  const {
    styledNodes,
    styledEdges,
    highlightChain,
    clearHighlight,
  } = usePathHighlight(visibleNodes, visibleEdges, debouncedSearch);

  /* ----- Viewport persistence hook ----- */
  const { savedViewport, onMoveEnd } = useViewportPersistence();

  /* ----- Enrich nodes with expand/collapse data ----- */
  const enrichedNodes = useMemo<OrgNode[]>(() => {
    return styledNodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        isCollapsed: collapsedIds.has(node.id),
        hiddenCount: getHiddenCount(node.id),
        onToggleExpand: toggleExpand,
      },
    }));
  }, [styledNodes, collapsedIds, getHiddenCount, toggleExpand]);

  /* ----- Context menu state ----- */
  const [contextMenu, setContextMenu] =
    useState<ContextMenuState>(INITIAL_CONTEXT_MENU);

  /* ----- Add person dialog state ----- */
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addDialogReportsToId, setAddDialogReportsToId] = useState<
    string | null
  >(null);
  const [addDialogReportsToName, setAddDialogReportsToName] = useState<
    string | undefined
  >(undefined);

  /* ----- Fetch on mount ----- */
  useEffect(() => {
    void fetchOrgChart();
  }, [fetchOrgChart]);

  /* ----- onInit: restore viewport or fit view ----- */
  const handleInit = useCallback(
    (instance: ReactFlowInstance<OrgNode>) => {
      if (savedViewport) {
        instance.setViewport(savedViewport);
      } else {
        instance.fitView({ padding: 0.2 });
      }
    },
    [savedViewport],
  );

  /* ----- Context menu: right-click on node ----- */
  const onNodeContextMenu: NodeMouseHandler<OrgNode> = useCallback(
    (event, node) => {
      event.preventDefault();
      const data = node.data as OrgChartNodeData;
      setContextMenu({
        visible: true,
        x: event.clientX,
        y: event.clientY,
        nodeId: node.id,
        nodeName: data.name,
        hasReportsTo: false,
      });
    },
    [],
  );

  /* ----- Pane click: close context menu + clear highlight ----- */
  const onPaneClick = useCallback(() => {
    setContextMenu(INITIAL_CONTEXT_MENU);
    clearHighlight();
  }, [clearHighlight]);

  /* ----- onConnectEnd: drop on empty canvas opens add-person dialog ----- */
  const onConnectEnd = useCallback(
    (_event: MouseEvent | TouchEvent, connectionState: FinalConnectionState) => {
      if (connectionState.isValid) return; // Dropped on a valid handle, ignore
      if (!connectionState.fromNode) return;

      const fromNode = connectionState.fromNode;
      const name =
        (fromNode as unknown as { data?: OrgChartNodeData }).data?.name ?? "";

      setAddDialogReportsToId(fromNode.id);
      setAddDialogReportsToName(name);
      setAddDialogOpen(true);
    },
    [],
  );

  /* ----- Context menu action: add direct report ----- */
  const handleAddReport = useCallback(
    (reportsToId: string) => {
      const node = nodes.find((n) => n.id === reportsToId);
      const data = node?.data as OrgChartNodeData | undefined;
      setAddDialogReportsToId(reportsToId);
      setAddDialogReportsToName(data?.name);
      setAddDialogOpen(true);
    },
    [nodes],
  );

  /* ----- Context menu action: edit (navigate) ----- */
  const handleEdit = useCallback((personId: string) => {
    window.location.href = `/personas/directorio?id=${personId}&edit=true`;
  }, []);

  /* ---------- Render: loading ---------- */
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-9 w-32" />
        </div>
        <Skeleton className="h-[500px] w-full rounded-lg" />
      </div>
    );
  }

  /* ---------- Render: empty ---------- */
  if (isEmpty) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Organigrama</h1>
          <HelpTooltip text="Visualiza la estructura jerárquica de tu organización. Cada persona aparece como un nodo conectado a su jefatura directa." />
        </div>
        <EducationalEmptyState
          icon={
            <svg
              className="size-8"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="7" height="5" rx="1" />
              <rect x="14" y="3" width="7" height="5" rx="1" />
              <rect x="8.5" y="16" width="7" height="5" rx="1" />
              <line x1="6.5" y1="8" x2="6.5" y2="12" />
              <line x1="17.5" y1="8" x2="17.5" y2="12" />
              <line x1="6.5" y1="12" x2="17.5" y2="12" />
              <line x1="12" y1="12" x2="12" y2="16" />
            </svg>
          }
          title="Construye el organigrama de tu organización"
          description={
            <>
              <p>
                El organigrama muestra la estructura jerárquica de tu equipo.
                Para empezar, necesitas definir quién reporta a quién.
              </p>
              <p className="mt-2">
                Ve al{" "}
                <a
                  href="/personas/directorio"
                  className="font-medium text-primary underline underline-offset-2"
                >
                  Directorio de Personas
                </a>{" "}
                y asigna la relación &ldquo;Reporta a&rdquo; en cada perfil. Una vez
                que existan relaciones jerárquicas, el organigrama se generará
                automáticamente.
              </p>
            </>
          }
          action={{
            label: "Ir al Directorio",
            onClick: () => {
              window.location.href = "/personas/directorio";
            },
          }}
          tip='Tip: Comienza por registrar al líder de la organización (ej: Gerente General). Luego agrega sus reportes directos y asigna la relación "Reporta a".'
        />
        {stats && stats.totalPersons > 0 && (
          <div className="rounded-lg border bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
            Hay {stats.totalPersons} persona
            {stats.totalPersons !== 1 ? "s" : ""} registrada
            {stats.totalPersons !== 1 ? "s" : ""} en el directorio, pero
            ninguna tiene una relación jerárquica (&ldquo;reporta a&rdquo;)
            definida.
          </div>
        )}
      </div>
    );
  }

  /* ---------- Render: org chart ---------- */
  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <OrgChartToolbar
        stats={stats}
        search={search}
        onSearchChange={setSearch}
        nodes={enrichedNodes}
        onExpandAll={expandAll}
        onCollapseAll={collapseAll}
        hasCollapsed={collapsedIds.size > 0}
      />

      {/* Canvas container (relative for sidebar positioning) */}
      <div className="relative flex-1 min-h-[500px]">
        <ReactFlow
          nodes={enrichedNodes}
          edges={styledEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgesDelete={onEdgesDelete}
          onReconnect={onReconnect}
          onNodeContextMenu={onNodeContextMenu}
          onPaneClick={onPaneClick}
          onConnectEnd={onConnectEnd}
          onMoveEnd={onMoveEnd}
          onInit={handleInit as never}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.1}
          maxZoom={2}
          edgesReconnectable
          deleteKeyCode={["Backspace", "Delete"]}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            className="!bg-background"
          />
          <MiniMap
            nodeStrokeWidth={3}
            className="!bg-muted/50 !border-border rounded-lg"
          />
          <Controls className="!bg-card !border-border !rounded-lg !shadow-sm [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-foreground [&>button:hover]:!bg-accent" />
        </ReactFlow>

        {/* Sidebar for unassigned persons */}
        <OrgChartSidebar
          unassigned={unassigned}
          nodes={enrichedNodes}
          onAssigned={refetchPreservingViewport}
        />
      </div>

      {/* Context menu */}
      <OrgChartContextMenu
        menu={contextMenu}
        onClose={() => setContextMenu(INITIAL_CONTEXT_MENU)}
        onHighlightChain={highlightChain}
        onAddReport={handleAddReport}
        onUnlink={unlinkPerson}
        onDelete={deletePerson}
        onEdit={handleEdit}
      />

      {/* Add person dialog */}
      <AddPersonDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        reportsToId={addDialogReportsToId}
        reportsToName={addDialogReportsToName}
        onCreated={() => void refetchPreservingViewport()}
      />
    </div>
  );
}
