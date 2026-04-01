import type { Node, Edge } from "@xyflow/react";

export interface OrgChartPerson {
  id: string;
  name: string;
  role?: string;
  position?: string;
  department?: { id: string; name: string; color: string | null } | null;
  avatarUrl?: string | null;
  status?: string;
  source?: string;
  directReportsCount?: number;
  directReports?: OrgChartPerson[];
}

export interface OrgChartResponse {
  roots: OrgChartPerson[];
  unassigned: OrgChartPerson[];
  stats: OrgChartStats;
}

export interface OrgChartStats {
  totalPersons: number;
  totalActive: number;
  totalVacant: number;
  totalUnassigned: number;
  departments: string[];
  maxDepth: number;
}

export interface OrgChartNodeData {
  name: string;
  role?: string;
  department?: string;
  avatarUrl?: string | null;
  directReportsCount: number;
  status: string;
  hasChildren: boolean;
  [key: string]: unknown;
}

export type OrgNode = Node<OrgChartNodeData>;
export type OrgEdge = Edge;

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  nodeId: string;
  nodeName: string;
  hasReportsTo: boolean;
}
