"use client";

import { ReactFlowProvider } from "@xyflow/react";
import { OrgChartCanvas } from "@/components/org-intelligence/orgchart/orgchart-canvas";

export default function OrganigramaPage() {
  return (
    <ReactFlowProvider>
      <OrgChartCanvas />
    </ReactFlowProvider>
  );
}
