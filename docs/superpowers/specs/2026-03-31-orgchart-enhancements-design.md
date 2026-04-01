# Orgchart Enhancements — Design Spec

**Date:** 2026-03-31
**Status:** Approved
**Branch:** feature/org-intelligence

## Overview

11 features to transform the org chart from a static visualization into an interactive management tool. Modular architecture with 5 custom hooks and 6 new components. Zero backend changes, one new dependency.

## Scope

| # | Feature | Description |
|---|---------|-------------|
| 1 | Context Menu | Right-click node: view profile, edit, add report, highlight chain, unlink, delete |
| 2 | Expand/Collapse | Custom implementation — toggle node children visibility, recalculate dagre layout |
| 3 | Contextual Zoom | Show/hide node detail based on zoom level via `useStore(s => s.transform[2])` |
| 4 | Download Image | Export org chart as PNG using `html-to-image@1.11.11` |
| 5 | Add Node On Edge Drop | Minimal dialog (name, role, dept) when dropping connection on empty canvas |
| 6 | Reconnect Edge | Drag existing edge endpoint to a different node to reassign hierarchy |
| 7 | Drag & Drop Sidebar | Collapsible right panel listing unassigned persons, draggable onto canvas |
| 8 | Delete Middle Node | Auto-reconnect direct reports to superior when removing intermediate node |
| 9 | Path Highlight on Search | Highlight edges from matching nodes up to root during search |
| 10 | Save/Restore Viewport | Persist viewport position/zoom in localStorage per tenant |
| 11 | Highlight Chain of Command | Context menu action to trace path from node to root |

### Excluded

- **Node Toolbar**: Merged into Context Menu to avoid visual clutter
- **Floating Edges**: TB dagre layout makes fixed Top/Bottom handles sufficient
- **SVG pulse animation**: Replaced with static highlight — less resource usage, clearer UX

## Architecture

### File Structure

```
apps/web/
├── app/(dashboard)/personas/organigrama/
│   └── page.tsx                              # Slim orchestrator (~20 lines)
│
├── components/org-intelligence/orgchart/
│   ├── orgchart-canvas.tsx                   # Main ReactFlow composition
│   ├── orgchart-node.tsx                     # Custom node (moved + enhanced)
│   ├── orgchart-edge.tsx                     # Custom edge (moved + enhanced)
│   ├── orgchart-context-menu.tsx             # Right-click menu
│   ├── orgchart-sidebar.tsx                  # Unassigned persons panel
│   ├── orgchart-toolbar.tsx                  # Search, export, expand/collapse, fit view
│   └── add-person-dialog.tsx                 # Minimal person creation dialog
│
├── hooks/org-intelligence/
│   ├── use-orgchart.ts                       # Data fetching, nodes/edges, dagre layout
│   ├── use-orgchart-actions.ts               # All mutations (connect, delete, reconnect, CRUD)
│   ├── use-expand-collapse.ts                # Visibility toggle for branches
│   ├── use-viewport-persistence.ts           # localStorage save/restore
│   └── use-path-highlight.ts                 # Search highlight + chain of command
```

### Hook Contracts

#### `useOrgChart(getViewport, setViewport)`

```ts
{
  nodes: Node<OrgChartNodeData>[]     // All nodes from API
  edges: Edge[]                        // All edges from API
  setNodes, setEdges                   // ReactFlow setters
  onNodesChange, onEdgesChange         // ReactFlow change handlers
  stats: OrgChartStats | null          // totalPersons, departments, maxDepth, etc.
  loading: boolean
  error: string | null
  isEmpty: boolean
  unassigned: OrgChartPerson[]         // Persons without reportsTo
  fetchOrgChart(): Promise<void>       // Refetch preserving viewport
}
```

Responsibilities: API fetch, tree-to-flat transformation, dagre layout calculation, viewport preservation on refetch.

#### `useOrgChartActions(refetch)`

```ts
{
  onConnect(connection: Connection): Promise<void>
  onEdgesDelete(edges: Edge[]): Promise<void>
  onReconnect(oldEdge: Edge, newConnection: Connection): Promise<void>
  onConnectEnd(event: MouseEvent, connectionState): void  // Opens AddPersonDialog
  onNodesDelete(deleted: Node[]): Promise<void>            // Reconnects children
  unlinkPerson(id: string): Promise<void>                  // reportsTo → null, reconnect children
  deletePerson(id: string): Promise<void>                  // Soft delete, reconnect children
}
```

Responsibilities: All API mutations via `api.patch`/`api.post`/`api.delete`. Each action shows toast feedback and calls `refetch()`.

For `onNodesDelete`, `unlinkPerson`, and `deletePerson`: before modifying the target node, iterate its direct reports and PATCH each one's `reportsTo` to the target's own `reportsToId` (its superior). If the target has no superior, reports become unassigned (`reportsToId: null`).

#### `useExpandCollapse(nodes, edges)`

```ts
{
  visibleNodes: Node[]                 // Filtered by collapse state
  visibleEdges: Edge[]                 // Filtered by collapse state
  toggleExpand(nodeId: string): void
  expandAll(): void
  collapseAll(): void
  collapsedIds: Set<string>
}
```

Responsibilities: Maintains a `Set<string>` of collapsed node IDs. Recursively filters out descendants of collapsed nodes. Recalculates dagre layout with only visible nodes. The collapsed node itself remains visible with a visual indicator showing hidden count.

Algorithm:
1. Build adjacency map from edges (source → target[])
2. For each collapsed nodeId, collect all descendants via BFS/DFS
3. Filter nodes: remove all collected descendants
4. Filter edges: remove edges where source OR target is a descendant
5. Run dagre layout on filtered sets

#### `useViewportPersistence(tenantId)`

```ts
{
  savedViewport: Viewport | null       // From localStorage on mount
  onMoveEnd(event, viewport): void     // Debounced save (500ms)
}
```

LocalStorage key: `orgchart-viewport-{tenantId}`. On mount, reads saved viewport. The canvas uses `savedViewport` to decide: if present, `setViewport(saved)` in `onInit`; otherwise `fitView()`.

Saves on ReactFlow's `onMoveEnd` event (fires after pan/zoom ends), debounced 500ms to avoid excessive writes.

#### `usePathHighlight(nodes, edges, search, highlightedNodeId)`

```ts
{
  styledNodes: Node[]                  // With opacity applied
  styledEdges: Edge[]                  // With highlight styles
  highlightChain(nodeId: string): void
  clearHighlight(): void
}
```

Two modes:

**Search mode** (when `search` is non-empty):
- Matching nodes: normal opacity
- Non-matching nodes: opacity 0.25
- Edges on path from any match to root: className `"orgchart-edge highlighted"`
- Other edges: opacity 0.25

**Chain of command mode** (when `highlightedNodeId` is set):
- Walk edges upward from target node to root (follow source chain)
- Nodes on path: normal opacity
- Edges on path: className `"orgchart-edge highlighted"`
- Everything else: opacity 0.15

Path traversal algorithm: build a `Map<targetId, edge>` from edges. Starting from the highlighted node, look up the edge where `edge.target === currentId`, add it to the path set, then move to `edge.source`. Repeat until no more edges found (root reached).

## Components

### `orgchart-context-menu.tsx`

Positioned absolutely at `event.clientX/Y` with viewport bounds checking (flip to left/top if within 200px of edge). Uses Radix DropdownMenu primitives.

**Menu structure:**
```
Ver perfil                    → navigate to /personas/directorio/{id}
Editar cargo                  → inline dialog (name, role, department)
Ver cadena de mando           → highlightChain(nodeId)
─────────────────
Agregar reporte directo       → open AddPersonDialog(reportsToId)
─────────────────
Desvincular del organigrama   → unlinkPerson(id) + reconectar reportes
Eliminar persona              → confirmation dialog + deletePerson(id)
```

State: `{ visible: boolean, x: number, y: number, nodeId: string }`. Set via `onNodeContextMenu`, cleared via `onPaneClick`.

### `orgchart-sidebar.tsx`

Right-side panel, 280px wide, collapsible via toggle button.

- Header: "Sin asignar" + badge count
- Body: scrollable list of person cards (avatar + name + role)
- Each card: `onPointerDown` starts drag via Pointer Events API
- Drop detection: `document.elementFromPoint()` checks if over `.react-flow` container
- On valid drop: `screenToFlowPosition()` converts coords, finds nearest node, calls `PATCH /reports-to`
- Hidden when `unassigned.length === 0`

### `add-person-dialog.tsx`

Shadcn Dialog with 3 fields:
- Name (Input, required)
- Role (Input, optional)
- Department (Select from existing departments, optional)

Props: `reportsToId: string` (pre-set from context), `onCreated: () => void` (triggers refetch).

Flow: POST `/org-intelligence/persons` with `{ name, role, departmentId }` → PATCH `/persons/{id}/reports-to` with `{ reportsToId }` → call `onCreated()`.

### `orgchart-toolbar.tsx`

Replaces current inline header. Single row:
- Left: Title "Organigrama" + HelpTooltip + stats
- Right: Search input (existing) + "Expandir todo"/"Colapsar todo" button + "Exportar PNG" button + Fit view button

Export PNG implementation:
```ts
import { toPng } from "html-to-image";
// 1. getNodesBounds(nodes)
// 2. getViewportForBounds(bounds, 2048, 1536, 0.5, 2)
// 3. toPng(document.querySelector(".react-flow__viewport"), { width: 2048, height: 1536, style: { transform } })
// 4. Create <a download="organigrama.png"> and click
```

### `orgchart-node.tsx` (enhanced)

Additions to existing node:
- **Expand/collapse indicator**: Below the node, a small clickable chevron `▼` (expanded) or `▶ +N` (collapsed, where N = hidden descendant count). Only shown if node has children. Click calls `toggleExpand(nodeId)`.
- **Contextual zoom**: `useStore(s => s.transform[2])` reads current zoom. If zoom < 0.5: render only avatar + name in a compact layout. If zoom >= 0.5: render full layout (avatar + name + role + department).
- **Context menu trigger**: `onContextMenu` prop on the wrapper div.

### `orgchart-edge.tsx` (enhanced)

Addition: support `highlighted` className alongside existing `orgchart-edge` className. CSS in globals.css:
```css
.react-flow__edge.orgchart-edge.highlighted .react-flow__edge-path {
  stroke: var(--primary);
  stroke-width: 2.5;
}
```

Delete button via EdgeToolbar remains unchanged.

## Data Flow Summary

```
API (/orgchart)
  ↓
useOrgChart (fetch + dagre layout)
  ↓
useExpandCollapse (filter visible nodes/edges)
  ↓
usePathHighlight (apply styles based on search/chain)
  ↓
ReactFlow (render styledNodes + styledEdges)
  ↕                    ↕                    ↕
useOrgChartActions   ContextMenu         Sidebar DnD
(mutations → refetch)  (actions → hooks)  (assign → refetch)
  ↕
useViewportPersistence (save/restore on move)
```

## Dependencies

### New

| Package | Version | Purpose |
|---------|---------|---------|
| `html-to-image` | 1.11.11 | PNG export of org chart |

### Existing (no changes)

- `@xyflow/react` ^12.10.2
- `@dagrejs/dagre` ^3.0.0
- `sonner` (toasts)
- `@hugeicons/react` + `@hugeicons/core-free-icons` (icons)
- Radix UI primitives via shadcn (Dialog, DropdownMenu)

## Backend Changes

None. All 11 features use existing endpoints:

| Endpoint | Used by |
|----------|---------|
| `GET /org-intelligence/persons/orgchart` | useOrgChart |
| `PATCH /org-intelligence/persons/:id/reports-to` | connect, reconnect, unlink, DnD |
| `POST /org-intelligence/persons` | AddPersonDialog |
| `DELETE /org-intelligence/persons/:id` | deletePerson |
| `GET /org-intelligence/departments` | AddPersonDialog department select |

## CSS Additions (globals.css)

```css
/* Already exists */
.react-flow__edge.orgchart-edge .react-flow__edge-path { ... }
.react-flow__edge.orgchart-edge.selected .react-flow__edge-path { ... }

/* New */
.react-flow__edge.orgchart-edge.highlighted .react-flow__edge-path {
  stroke: var(--primary);
  stroke-width: 2.5;
}

.react-flow__edge.orgchart-edge.dimmed .react-flow__edge-path {
  opacity: 0.15;
}
```
