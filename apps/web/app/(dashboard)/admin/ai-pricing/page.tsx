"use client";

import { useState } from "react";
import { useActivePricing } from "@/hooks/use-ai-costs";
import { aiPricingApi } from "@/lib/api/ai-costs";
import type { AiModelPricingDto, AiPricingUnit } from "@zeru/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const PRICING_UNITS: { value: AiPricingUnit; label: string }[] = [
  { value: "PER_1M_TOKENS", label: "Por 1M tokens" },
  { value: "PER_1K_CHARS", label: "Por 1K caracteres" },
  { value: "PER_HOUR", label: "Por hora" },
  { value: "PER_MINUTE", label: "Por minuto" },
  { value: "PER_IMAGE", label: "Por imagen" },
  { value: "PER_GENERATION", label: "Por generacion" },
];

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
  }).format(value);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-CL", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

interface FormState {
  provider: string;
  model: string;
  contextTier: string;
  pricingUnit: AiPricingUnit;
  inputPrice: string;
  outputPrice: string;
  cachedPrice: string;
  description: string;
}

const INITIAL_FORM: FormState = {
  provider: "OPENAI",
  model: "",
  contextTier: "standard",
  pricingUnit: "PER_1M_TOKENS",
  inputPrice: "",
  outputPrice: "",
  cachedPrice: "",
  description: "",
};

export default function AiPricingPage() {
  const { data, isLoading, refetch } = useActivePricing();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFieldChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const body: Omit<AiModelPricingDto, "id"> = {
        provider: form.provider,
        model: form.model,
        contextTier: form.contextTier,
        pricingUnit: form.pricingUnit,
        inputPrice: parseFloat(form.inputPrice) || 0,
        outputPrice: parseFloat(form.outputPrice) || 0,
        cachedPrice: parseFloat(form.cachedPrice) || 0,
        longContextThreshold: null,
        description: form.description || null,
        validFrom: new Date().toISOString(),
        validTo: null,
      };
      await aiPricingApi.create(body);
      setDialogOpen(false);
      setForm(INITIAL_FORM);
      refetch();
    } catch (e) {
      setError((e as Error).message ?? "Error al crear precio");
    } finally {
      setCreating(false);
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setForm(INITIAL_FORM);
    setError(null);
  };

  const canSubmit =
    form.provider.trim() !== "" &&
    form.model.trim() !== "" &&
    form.inputPrice !== "" &&
    form.outputPrice !== "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Precios de Modelos IA</h1>
          <p className="text-muted-foreground">
            Gestiona los precios activos usados para calcular costos de uso.
          </p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open: boolean) => {
            if (!open) handleCloseDialog();
            else setDialogOpen(true);
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => setDialogOpen(true)}>Agregar Precio</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nuevo Precio</DialogTitle>
              <DialogDescription>
                Agrega un nuevo precio para un modelo de IA. El precio anterior
                se desactivará automáticamente.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="provider">Provider</Label>
                  <Input
                    id="provider"
                    value={form.provider}
                    onChange={(e) =>
                      handleFieldChange("provider", e.target.value)
                    }
                    placeholder="OPENAI"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Modelo</Label>
                  <Input
                    id="model"
                    value={form.model}
                    onChange={(e) => handleFieldChange("model", e.target.value)}
                    placeholder="gpt-5.4"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contextTier">Context Tier</Label>
                  <Input
                    id="contextTier"
                    value={form.contextTier}
                    onChange={(e) =>
                      handleFieldChange("contextTier", e.target.value)
                    }
                    placeholder="standard"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pricingUnit">Unidad de Precio</Label>
                  <Select
                    value={form.pricingUnit}
                    onValueChange={(v) =>
                      handleFieldChange("pricingUnit", v)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRICING_UNITS.map((u) => (
                        <SelectItem key={u.value} value={u.value}>
                          {u.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="inputPrice">Input Price (USD)</Label>
                  <Input
                    id="inputPrice"
                    type="number"
                    step="0.0001"
                    value={form.inputPrice}
                    onChange={(e) =>
                      handleFieldChange("inputPrice", e.target.value)
                    }
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="outputPrice">Output Price (USD)</Label>
                  <Input
                    id="outputPrice"
                    type="number"
                    step="0.0001"
                    value={form.outputPrice}
                    onChange={(e) =>
                      handleFieldChange("outputPrice", e.target.value)
                    }
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cachedPrice">Cached Price (USD)</Label>
                  <Input
                    id="cachedPrice"
                    type="number"
                    step="0.0001"
                    value={form.cachedPrice}
                    onChange={(e) =>
                      handleFieldChange("cachedPrice", e.target.value)
                    }
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripción (opcional)</Label>
                <Input
                  id="description"
                  value={form.description}
                  onChange={(e) =>
                    handleFieldChange("description", e.target.value)
                  }
                  placeholder="Notas sobre este precio..."
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleCloseDialog}>
                Cancelar
              </Button>
              <Button
                onClick={handleCreate}
                disabled={creating || !canSubmit}
              >
                {creating ? "Creando..." : "Crear Precio"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground">
          Cargando...
        </div>
      ) : !data?.length ? (
        <div className="py-8 text-center text-muted-foreground">
          No hay precios activos configurados.
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Context Tier</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead className="text-right">Input</TableHead>
                <TableHead className="text-right">Output</TableHead>
                <TableHead className="text-right">Cached</TableHead>
                <TableHead>Valido Desde</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row: AiModelPricingDto) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.provider}</TableCell>
                  <TableCell>{row.model}</TableCell>
                  <TableCell>{row.contextTier}</TableCell>
                  <TableCell>
                    {PRICING_UNITS.find((u) => u.value === row.pricingUnit)
                      ?.label ?? row.pricingUnit}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatUsd(row.inputPrice)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatUsd(row.outputPrice)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatUsd(row.cachedPrice)}
                  </TableCell>
                  <TableCell>{formatDate(row.validFrom)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
