'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ShadePreview } from './shade-preview';
import { TokenEditorGroup } from './token-editor-group';
import {
  generateTheme,
  mergeThemeWithOverrides,
  themeToCSS,
  BORDER_RADIUS_MAP,
} from '@/lib/theme-generator';
import type { ThemeOutput, ThemeOverrides } from '@/lib/theme-generator';
import { brandingApi } from '@/lib/api/branding';
import { extractDominantColor } from '@/lib/color-extraction';
import type { TenantBranding } from '@zeru/shared';
import { useTenantContext } from '@/providers/tenant-provider';

// ---------------------------------------------------------------------------
// Token group definitions
// ---------------------------------------------------------------------------

const SURFACE_TOKENS = [
  { variable: '--background', label: 'Fondo de pagina', pairedForeground: '--foreground' },
  { variable: '--foreground', label: 'Texto principal' },
  { variable: '--card', label: 'Tarjetas', pairedForeground: '--card-foreground' },
  { variable: '--card-foreground', label: 'Texto tarjetas' },
  { variable: '--popover', label: 'Popovers', pairedForeground: '--popover-foreground' },
  { variable: '--popover-foreground', label: 'Texto popovers' },
  { variable: '--muted', label: 'Fondo atenuado', pairedForeground: '--muted-foreground' },
  { variable: '--muted-foreground', label: 'Texto atenuado' },
];

const INTERACTIVE_TOKENS = [
  { variable: '--primary', label: 'Primario', pairedForeground: '--primary-foreground' },
  { variable: '--primary-foreground', label: 'Texto sobre primario' },
  { variable: '--secondary', label: 'Secundario', pairedForeground: '--secondary-foreground' },
  { variable: '--secondary-foreground', label: 'Texto sobre secundario' },
  { variable: '--accent', label: 'Acento', pairedForeground: '--accent-foreground' },
  { variable: '--accent-foreground', label: 'Texto sobre acento' },
];

const BORDER_TOKENS = [
  { variable: '--border', label: 'Bordes' },
  { variable: '--input', label: 'Borde de inputs' },
  { variable: '--ring', label: 'Focus ring' },
];

const SIDEBAR_TOKENS = [
  { variable: '--sidebar', label: 'Fondo sidebar', pairedForeground: '--sidebar-foreground' },
  { variable: '--sidebar-foreground', label: 'Texto sidebar' },
  { variable: '--sidebar-primary', label: 'Primario sidebar', pairedForeground: '--sidebar-primary-foreground' },
  { variable: '--sidebar-primary-foreground', label: 'Texto primario sidebar' },
  { variable: '--sidebar-accent', label: 'Acento sidebar', pairedForeground: '--sidebar-accent-foreground' },
  { variable: '--sidebar-accent-foreground', label: 'Texto acento sidebar' },
  { variable: '--sidebar-border', label: 'Borde sidebar' },
  { variable: '--sidebar-ring', label: 'Ring sidebar' },
];

const CHART_TOKENS = [
  { variable: '--chart-1', label: 'Grafico 1' },
  { variable: '--chart-2', label: 'Grafico 2' },
  { variable: '--chart-3', label: 'Grafico 3' },
  { variable: '--chart-4', label: 'Grafico 4' },
  { variable: '--chart-5', label: 'Grafico 5' },
];

const RADIUS_PRESETS = [
  { value: 'sm', label: 'S' },
  { value: 'md', label: 'M' },
  { value: 'lg', label: 'L' },
  { value: 'xl', label: 'XL' },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ThemeEditorProps {
  branding: TenantBranding | null;
  logoUrl: string | null;
  onSaved: () => void;
}

export function ThemeEditor({ branding, logoUrl, onSaved }: ThemeEditorProps) {
  const { refreshTenant } = useTenantContext();

  // --- State ---------------------------------------------------------------
  const [primaryColor, setPrimaryColor] = useState<string>(
    branding?.primaryColor ?? '',
  );
  const [borderRadius, setBorderRadius] = useState<string>(
    branding?.borderRadius ?? 'md',
  );
  const [overrides, setOverrides] = useState<ThemeOverrides>(
    branding?.themeOverrides ?? {},
  );
  const [activeMode, setActiveMode] = useState<'light' | 'dark'>('light');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [description, setDescription] = useState('');

  // Keep a ref to track whether we've ever generated a theme
  const generatedRef = useRef<ThemeOutput | null>(null);

  // --- Derived values ------------------------------------------------------
  const isValidHex = primaryColor ? /^#[0-9a-fA-F]{6}$/.test(primaryColor) : false;

  const generated = useMemo(
    () => (isValidHex ? generateTheme(primaryColor) : null),
    [isValidHex, primaryColor],
  );
  generatedRef.current = generated;

  const radiusCss = BORDER_RADIUS_MAP[borderRadius] ?? '0.5rem';

  const merged = useMemo(
    () => (generated ? mergeThemeWithOverrides(generated, overrides) : null),
    [generated, overrides],
  );

  // --- Live preview (inject <style>) ---------------------------------------
  // Uses a DIFFERENT style ID than BrandingProvider ('branding-overrides') so
  // that unmounting the editor does not destroy the persistent branding styles.
  useEffect(() => {
    const STYLE_ID = 'theme-editor-preview';
    let styleEl = document.getElementById(STYLE_ID) as HTMLStyleElement | null;

    if (!merged) {
      // Remove our preview tag when there's nothing to preview
      if (styleEl) styleEl.remove();
      return;
    }

    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = STYLE_ID;
      document.head.appendChild(styleEl);
    }

    styleEl.textContent = themeToCSS(merged, radiusCss);

    return () => {
      // Cleanup only the editor preview tag on unmount
      const el = document.getElementById(STYLE_ID);
      if (el) el.remove();
    };
  }, [merged, radiusCss]);

  // --- Handlers ------------------------------------------------------------

  const handlePrimaryChange = (hex: string) => {
    setPrimaryColor(hex);
    // Reset manual overrides when primary color changes
    setOverrides({});
  };

  const handleTokenChange = useCallback(
    (variable: string, value: string) => {
      setOverrides((prev) => ({
        ...prev,
        [activeMode]: {
          ...prev[activeMode],
          [variable]: value,
        },
      }));
    },
    [activeMode],
  );

  const handleTokenReset = useCallback(
    (variable: string) => {
      setOverrides((prev) => {
        const modeTokens = { ...prev[activeMode] };
        delete modeTokens[variable];
        return {
          ...prev,
          [activeMode]: modeTokens,
        };
      });
    },
    [activeMode],
  );

  const handleResetAll = () => {
    setOverrides({});
  };

  const handleExtractFromLogo = async () => {
    if (!logoUrl) return;
    setExtracting(true);
    try {
      const hex = await extractDominantColor(logoUrl);
      handlePrimaryChange(hex);
    } catch {
      // Silently fail — the user will see no color change
    } finally {
      setExtracting(false);
    }
  };

  const handleSuggestColor = async () => {
    if (!description.trim()) return;
    setSuggesting(true);
    try {
      const result = await brandingApi.suggestColor(description);
      handlePrimaryChange(result.hex);
      setDescriptionOpen(false);
      setDescription('');
    } catch {
      // Silently fail
    } finally {
      setSuggesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Only include non-empty overrides
      const hasLightOverrides =
        overrides.light && Object.keys(overrides.light).length > 0;
      const hasDarkOverrides =
        overrides.dark && Object.keys(overrides.dark).length > 0;

      const themeOverrides =
        hasLightOverrides || hasDarkOverrides
          ? {
              ...(hasLightOverrides ? { light: overrides.light } : {}),
              ...(hasDarkOverrides ? { dark: overrides.dark } : {}),
            }
          : undefined;

      await brandingApi.updateColors({
        primaryColor,
        themeOverrides,
        borderRadius,
      });
      await refreshTenant();
      onSaved();
    } catch {
      // Error handling would go here
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setPrimaryColor(branding?.primaryColor ?? '');
    setBorderRadius(branding?.borderRadius ?? 'md');
    setOverrides(branding?.themeOverrides ?? {});
  };

  const handleCopyCSS = async () => {
    if (!merged) return;
    const css = themeToCSS(merged, radiusCss);
    await navigator.clipboard.writeText(css);
  };

  const handleExportJSON = () => {
    if (!merged) return;
    const data = {
      primaryColor,
      borderRadius,
      theme: merged,
      overrides,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'theme.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- Current values for the active mode in advanced editor ---------------
  const activeMerged = merged?.[activeMode] ?? {};
  const activeGenerated = generated?.[activeMode] ?? {};

  // --- Render --------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* ---- Simple Mode ---- */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="primary-color">Color principal</Label>
          <div className="flex items-center gap-3 mt-1.5">
            <input
              type="color"
              id="primary-color-picker"
              value={isValidHex ? primaryColor : '#6366f1'}
              onChange={(e) => handlePrimaryChange(e.target.value)}
              className="size-10 rounded border-0 cursor-pointer p-0 bg-transparent shrink-0"
              aria-label="Selector de color principal"
            />
            <Input
              id="primary-color"
              value={primaryColor}
              onChange={(e) => handlePrimaryChange(e.target.value)}
              placeholder="#6366f1"
              className="w-32 font-mono"
            />
          </div>
        </div>

        {/* Shade scale preview */}
        {isValidHex && <ShadePreview primaryHex={primaryColor} />}

        {!isValidHex && primaryColor.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Selecciona un color principal para generar el tema.
          </p>
        )}

        {/* Source buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExtractFromLogo}
            disabled={!logoUrl || extracting}
          >
            {extracting ? 'Extrayendo...' : 'Extraer del logo'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDescriptionOpen(!descriptionOpen)}
          >
            Describir estilo
          </Button>
        </div>

        {/* Description input for AI suggestion */}
        {descriptionOpen && (
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label htmlFor="style-description">
                Describe el estilo deseado
              </Label>
              <Input
                id="style-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ej: moderno, minimalista, tonos azules..."
                className="mt-1"
              />
            </div>
            <Button
              size="sm"
              onClick={handleSuggestColor}
              disabled={suggesting || !description.trim()}
            >
              {suggesting ? 'Sugiriendo...' : 'Sugerir color'}
            </Button>
          </div>
        )}

        {/* Border radius selector */}
        <div>
          <Label>Bordes redondeados</Label>
          <div className="flex gap-2 mt-1.5">
            {RADIUS_PRESETS.map((preset) => (
              <Button
                key={preset.value}
                variant={borderRadius === preset.value ? 'default' : 'outline'}
                size="sm"
                className="w-10"
                onClick={() => setBorderRadius(preset.value)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* ---- Advanced Mode ---- */}
      {generated && (
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between">
              <span>Modo avanzado</span>
              <span className="text-xs text-muted-foreground">
                {advancedOpen ? 'Ocultar' : 'Mostrar'}
              </span>
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent className="space-y-6 pt-4">
            {/* Light / Dark toggle */}
            <div className="flex gap-2">
              <Button
                variant={activeMode === 'light' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveMode('light')}
              >
                Light
              </Button>
              <Button
                variant={activeMode === 'dark' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveMode('dark')}
              >
                Dark
              </Button>
            </div>

            {/* Token groups */}
            <TokenEditorGroup
              title="Superficies"
              tokens={SURFACE_TOKENS}
              values={activeMerged}
              generatedValues={activeGenerated}
              onChange={handleTokenChange}
              onReset={handleTokenReset}
            />
            <TokenEditorGroup
              title="Interactivos"
              tokens={INTERACTIVE_TOKENS}
              values={activeMerged}
              generatedValues={activeGenerated}
              onChange={handleTokenChange}
              onReset={handleTokenReset}
            />
            <TokenEditorGroup
              title="Bordes y focus"
              tokens={BORDER_TOKENS}
              values={activeMerged}
              generatedValues={activeGenerated}
              onChange={handleTokenChange}
              onReset={handleTokenReset}
            />
            <TokenEditorGroup
              title="Sidebar"
              tokens={SIDEBAR_TOKENS}
              values={activeMerged}
              generatedValues={activeGenerated}
              onChange={handleTokenChange}
              onReset={handleTokenReset}
            />
            <TokenEditorGroup
              title="Graficos"
              tokens={CHART_TOKENS}
              values={activeMerged}
              generatedValues={activeGenerated}
              onChange={handleTokenChange}
              onReset={handleTokenReset}
            />

            {/* Advanced footer actions */}
            <div className="flex flex-wrap gap-2 border-t pt-4">
              <Button variant="outline" size="sm" onClick={handleResetAll}>
                Resetear todo a generados
              </Button>
              <Button variant="outline" size="sm" onClick={handleCopyCSS}>
                Copiar CSS
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportJSON}>
                Exportar JSON
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* ---- Save / Cancel ---- */}
      <div className="flex gap-2 border-t pt-4">
        <Button onClick={handleSave} disabled={saving || !isValidHex}>
          {saving ? 'Guardando...' : 'Guardar tema'}
        </Button>
        <Button variant="outline" onClick={handleCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
