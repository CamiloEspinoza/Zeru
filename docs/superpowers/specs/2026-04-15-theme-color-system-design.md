# Theme Color System — Design Spec

**Date**: 2026-04-15
**Status**: Approved
**Approach**: OKLCH algorithmic generation with `culori`

## Problem

The current branding system only customizes 3 CSS tokens (primary, secondary, accent) out of 35+ that shadcn/ui uses. Backgrounds, cards, borders, muted surfaces, sidebar, and charts remain hardcoded. There is no way to generate a cohesive theme from a single brand color, and no advanced editing for granular control.

## Goals

1. From a **single primary color**, algorithmically generate all 35+ CSS tokens for both light and dark mode
2. Generated neutrals (background, card, border, muted, sidebar) carry a **subtle tint** of the primary hue for visual cohesion
3. Provide a **simple editor** (one color picker) and an **advanced editor** (~25 semantic tokens grouped by function)
4. **Live preview** — changes reflect in real-time across the entire app
5. Maintain **WCAG AA contrast** automatically for all foreground/background pairs
6. **Hybrid color sourcing**: algorithmic extraction from logo, manual picker, or AI-suggested from text description

## Non-Goals

- Customizable semantic colors (destructive, warning, success) — these stay fixed
- Component-level tokens (e.g., `--button-bg`) — only semantic tokens are exposed
- Custom fonts or typography — out of scope
- Theme marketplace or sharing between tenants

## Architecture

### 1. Theme Generator Engine

**File**: `apps/web/lib/theme-generator.ts`
**Dependency**: `culori` (~12KB tree-shaken)

#### `generateTheme(primaryHex: string): ThemeOutput`

**Input**: Hex color string (e.g., `#1E40AF`)
**Output**: `{ light: Record<string, string>, dark: Record<string, string> }` with all 35 CSS variables

**Algorithm** (all operations in OKLCH via `culori`):

1. **Parse** hex to OKLCH `{ l, c, h }`
2. **Shade scale** (50-950, 11 steps):
   - Lightness array (Tailwind v4-aligned): `[0.97, 0.93, 0.87, 0.77, 0.65, 0.55, 0.45, 0.37, 0.29, 0.21, 0.13]`
   - Chroma: sine curve — peak at mid-tones (400-600), taper toward extremes
   - Hue: subtle rotation (+2deg highlights, -2deg shadows)
3. **Semantic token mapping**:
   - `--primary`: shade-500 (light) / shade-400 (dark)
   - `--primary-foreground`: auto-calculated for >= 4.5:1 contrast ratio
   - `--secondary`: shade-100 (light) / shade-800 (dark)
   - `--accent`: same as primary (or hue+30deg for differentiation)
4. **Tinted neutrals** — primary hue with very low chroma (0.005-0.01):
   - `--background`: L=0.99, C=0.005 (light) / L=0.145, C=0.005 (dark)
   - `--card`: L=0.99, C=0.007 (light) / L=0.20, C=0.007 (dark)
   - `--popover`: same as card
   - `--muted`: L=0.96, C=0.008 (light) / L=0.27, C=0.008 (dark)
   - `--border`: L=0.91, C=0.006 (light) / `oklch(1 0 0 / 10%)` (dark)
   - `--input`: L=0.91, C=0.006 (light) / `oklch(1 0 0 / 15%)` (dark)
   - `--ring`: shade-300 (light) / shade-600 (dark)
   - `--sidebar`: L=0.98, C=0.006 (light) / L=0.20, C=0.007 (dark)
   - `--sidebar-border`: same as `--border`
   - `--sidebar-ring`: same as `--ring`
5. **Foreground auto-calculation**: For each background token, compute foreground that meets WCAG AA (>= 4.5:1). If background L > 0.5, foreground is dark (low L, subtle chroma from primary hue); otherwise foreground is light (high L, subtle chroma).
6. **Charts**: 5 steps from shade scale — shades 200, 300, 400, 500, 600
7. **Destructive**: Fixed — `oklch(0.577 0.245 27)` (light) / `oklch(0.704 0.191 22)` (dark)

#### `checkContrast(fg: string, bg: string): { ratio: number, passesAA: boolean, passesAAA: boolean }`

WCAG 2.2 relative luminance contrast calculation. Used by the advanced editor for inline validation.

### 2. Color Extraction from Logo

**File**: `apps/web/lib/color-extraction.ts`

#### `extractDominantColor(imageUrl: string): Promise<string>`

- Load image into offscreen `<canvas>`
- Read pixels via `getImageData()`
- Simplified k-means clustering (k=5) in OKLCH space
- Return largest cluster centroid as hex
- 100% client-side, no AI, ~50ms execution

### 3. Editor UI

**File**: `apps/web/components/branding/theme-editor.tsx`

#### Simple Mode (default)

- **One color picker** with hex input for primary color
- **Shade scale preview**: horizontal strip showing the 11 generated shades
- **Source buttons**: "Extraer del logo" (canvas extraction) | "Describir estilo" (AI text→hex via GPT-4o)
- **Border radius selector**: preset buttons (S, M, L, XL)
- Changes apply **live** via `document.documentElement.style.setProperty()`
- Save/Cancel buttons

#### Advanced Mode (expandable accordion)

Tokens grouped by function with descriptive Spanish labels:

**Superficies** (8 tokens):
- Fondo de pagina (`--background`, `--foreground`)
- Tarjetas (`--card`, `--card-foreground`)
- Popovers (`--popover`, `--popover-foreground`)
- Fondo atenuado (`--muted`, `--muted-foreground`)

**Interactivos** (6 tokens):
- Primario (`--primary`, `--primary-foreground`)
- Secundario (`--secondary`, `--secondary-foreground`)
- Acento (`--accent`, `--accent-foreground`)

**Bordes y focus** (3 tokens):
- Bordes (`--border`)
- Input border (`--input`)
- Focus ring (`--ring`)

**Sidebar** (8 tokens):
- Fondo (`--sidebar`, `--sidebar-foreground`)
- Primario sidebar (`--sidebar-primary`, `--sidebar-primary-foreground`)
- Acento sidebar (`--sidebar-accent`, `--sidebar-accent-foreground`)
- Borde sidebar (`--sidebar-border`)
- Ring sidebar (`--sidebar-ring`)

**Graficos** (5 tokens):
- Chart 1-5 (`--chart-1` through `--chart-5`)

Each token shows:
- Color swatch + native color picker
- Hex/OKLCH text input
- Reset button (back to generated value)
- Inline contrast warning for foreground/background pairs if < 4.5:1

Footer actions:
- "Resetear todo a generados" — discards all overrides
- "Copiar CSS" — copies `:root { ... } .dark { ... }` block
- "Exportar JSON" — downloads token values as JSON
- Light/Dark toggle — edit each mode independently

### 4. Database Changes

**Prisma schema** — add to `TenantBranding`:

```prisma
themeOverrides  Json?     // manual overrides from advanced editor
borderRadius    String?   // preset: "sm" | "md" | "lg" | "xl"
```

`themeOverrides` stores only manually edited tokens:

```json
{
  "light": { "--accent": "oklch(0.55 0.15 280)" },
  "dark": { "--accent": "oklch(0.72 0.12 280)" }
}
```

Tokens not in `themeOverrides` use values from `generateTheme()`.

**Migration**: Existing `secondaryColor`/`accentColor` values move to `themeOverrides` as overrides for `--secondary` and `--accent`. The columns remain but are deprecated.

### 5. Data Flow

```
User picks primary color (picker / logo extraction / AI suggestion)
  → generateTheme(hex) produces 35 tokens per mode
  → merge with themeOverrides (manual wins)
  → apply live via setProperty() on :root and .dark
  → on save: PATCH /tenants/current/branding { primaryColor, themeOverrides, borderRadius }
  → API persists to TenantBranding
  → BrandingProvider on app load: read tenant.branding → generateTheme() → merge → inject <style>
```

### 6. BrandingProvider Refactor

`apps/web/providers/branding-provider.tsx` changes from 12 variables to 35+:

1. Read `primaryColor` from tenant branding
2. Call `generateTheme(primaryColor)` → full token set per mode
3. Deep merge with `themeOverrides` (overrides win)
4. Inject `<style id="branding-overrides">` with `:root { ... }` and `.dark { ... }`
5. If no `primaryColor` → inject nothing (globals.css defaults apply)
6. Handle `borderRadius` override for `--radius`

### 7. AI Integration (Text → Color Suggestion)

Keep existing GPT-4o endpoint but change its output:
- **Input**: Text description ("profesional y moderno", "laboratorio clinico")
- **Output**: Single hex color (not a 3-color palette)
- The hex feeds into `generateTheme()` which generates the full system

Prompt adjustment: ask for one primary brand color instead of three.

### 8. API Changes

**DTO update** (`apps/api/src/modules/branding/dto.ts`):

```typescript
UpdateBrandingDto {
  primaryColor?: string       // hex validation
  themeOverrides?: {          // optional
    light?: Record<string, string>
    dark?: Record<string, string>
  }
  borderRadius?: 'sm' | 'md' | 'lg' | 'xl'
}
```

Validate `themeOverrides` keys against an allowlist of the 35 known CSS variable names. Validate values as valid OKLCH or hex strings.

**GeneratePaletteDto** rename to `SuggestColorDto`:
- `source: 'logo'` → returns `{ hex: string }` (dominant color via canvas, actually client-side now)
- `source: 'description'` → returns `{ hex: string }` (GPT-4o single color)

## Files Summary

### Create

| File | Purpose |
|------|---------|
| `apps/web/lib/theme-generator.ts` | OKLCH engine: generateTheme(), contrast check, shade scale |
| `apps/web/lib/color-extraction.ts` | extractDominantColor() — canvas + k-means |
| `apps/web/components/branding/theme-editor.tsx` | Main editor component (simple + advanced) |
| `apps/web/components/branding/shade-preview.tsx` | Visual shade scale strip |
| `apps/web/components/branding/token-editor-group.tsx` | Grouped token editors for advanced mode |
| `apps/web/components/branding/contrast-checker.tsx` | Inline WCAG contrast indicator |

### Modify

| File | Change |
|------|--------|
| `apps/web/lib/color-utils.ts` | Deprecate deriveColorScale(), delegate to theme-generator |
| `apps/web/providers/branding-provider.tsx` | Use generateTheme() + merge overrides (35+ tokens) |
| `apps/web/app/(dashboard)/settings/organization/page.tsx` | Replace 3 ColorPickerFields with ThemeEditor |
| `apps/api/prisma/schema.prisma` | Add themeOverrides, borderRadius to TenantBranding |
| `apps/api/src/modules/branding/dto.ts` | Add themeOverrides, borderRadius validation |
| `apps/api/src/modules/branding/branding.service.ts` | Handle new fields |
| `packages/shared/src/types/branding.ts` | Update types |
| `packages/shared/src/schemas/branding.schema.ts` | Update Zod schemas |

### New Dependency

- `culori` — OKLCH color manipulation (~12KB tree-shaken)

## Migration Strategy

1. Prisma migration: add `themeOverrides Json?` and `borderRadius String?`
2. Data migration script: existing `secondaryColor`/`accentColor` → `themeOverrides`
3. `secondaryColor`/`accentColor` columns remain (deprecated), no breaking change
