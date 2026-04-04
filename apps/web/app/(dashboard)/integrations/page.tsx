"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Integraciones</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link href="/integrations/filemaker">
          <Card className="cursor-pointer transition-colors hover:bg-muted/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">FileMaker</CardTitle>
                <Badge variant="secondary">Activo</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Bridge bidireccional con FileMaker Server via Data API.
                Discovery de layouts, campos y scripts.
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
