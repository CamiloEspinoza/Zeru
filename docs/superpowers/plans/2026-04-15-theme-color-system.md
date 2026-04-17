# Theme Color System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate a complete 35+ CSS token theme from a single primary color, with live preview, WCAG contrast, tinted neutrals, and a two-tier editor (simple + advanced).

**Architecture:** OKLCH algorithmic generation via `culori` library. `generateTheme(hex)` produces all CSS variables for light/dark mode. BrandingProvider injects them at runtime. Advanced overrides stored as JSON in the database.

**Tech Stack:** culori (OKLCH math), React (editor UI), Prisma (schema), NestJS (API), Zod (validation), shadcn/ui (components)

**Spec:** `docs/superpowers/specs/2026-04-15-theme-color-system-design.md`

---

### Task 1: Install culori and create theme generator engine

**Files:**
- Create: `apps/web/lib/theme-generator.ts`
- Modify: `apps/web/package.json` (new dependency)

- [ ] **Step 1: Install culori**

```bash
cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/web add culori
```

- [ ] **Step 2: Create the theme generator with types and constants**

Create `apps/web/lib/theme-generator.ts`:

```typescript
import { parse, formatHex, converter, wcagContrast } from 'culori';

// ── Types ──

export interface ThemeOutput {
  light: Record<string, string>;
  dark: Record<string, string>;
}

interface OklchColor {
  mode: 'oklch';
  l: number;
  c: number;
  h: number;
}

// ── Constants ──

/** Tailwind v4-aligned lightness steps for shades 50-950 */
const SHADE_LIGHTNESS = [0.97, 0.93, 0.87, 0.77, 0.65, 0.55, 0.45, 0.37, 0.29, 0.21, 0.13];
const SHADE_NAMES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

/** Peak chroma multiplier per shade step (sine curve: peak at mid-tones) */
const CHROMA_CURVE = SHADE_LIGHTNESS.map((_, i) => {
  const t = i / (SHADE_LIGHTNESS.length - 1); // 0..1
  return Math.sin(t * Math.PI); // peaks at 0.5 (shade 500)
});

/** CSS variable names that are valid theme override keys */
export const THEME_TOKEN_NAMES = [
  '--background', '--foreground',
  '--card', '--card-foreground',
  '--popover', '--popover-foreground',
  '--primary', '--primary-foreground',
  '--secondary', '--secondary-foreground',
  '--muted', '--muted-foreground',
  '--accent', '--accent-foreground',
  '--destructive',
  '--border', '--input', '--ring',
  '--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5',
  '--sidebar', '--sidebar-foreground',
  '--sidebar-primary', '--sidebar-primary-foreground',
  '--sidebar-accent', '--sidebar-accent-foreground',
  '--sidebar-border', '--sidebar-ring',
] as const;

export type ThemeTokenName = (typeof THEME_TOKEN_NAMES)[number];

// ── Helpers ──

const toOklch = converter('oklch');

function parseToOklch(color: string): OklchColor {
  const parsed = parse(color);
  if (!parsed) throw new Error(`Invalid color: ${color}`);
  const oklch = toOklch(parsed);
  return { mode: 'oklch', l: oklch.l ?? 0, c: oklch.c ?? 0, h: oklch.h ?? 0 };
}

function oklchStr(l: number, c: number, h: number): string {
  return `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)})`;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ── Shade scale generation ──

export interface ShadeScale {
  [key: number]: OklchColor;
}

export function generateShadeScale(baseHex: string): ShadeScale {
  const base = parseToOklch(baseHex);
  const scale: ShadeScale = {};

  for (let i = 0; i < SHADE_NAMES.length; i++) {
    const shade = SHADE_NAMES[i];
    const targetL = SHADE_LIGHTNESS[i];
    const chromaMultiplier = CHROMA_CURVE[i];
    // Modulate chroma: peak at mid-tones, taper at extremes
    const c = clamp(base.c * chromaMultiplier * 1.1, 0, 0.4);
    // Subtle hue rotation: +2deg for highlights, -2deg for shadows
    const hueShift = (0.5 - i / (SHADE_NAMES.length - 1)) * 4; // +2 to -2
    const h = (base.h + hueShift + 360) % 360;

    scale[shade] = { mode: 'oklch', l: targetL, c, h };
  }

  return scale;
}

// ── Contrast ──

export function checkContrast(fg: string, bg: string): { ratio: number; passesAA: boolean; passesAAA: boolean } {
  const fgParsed = parse(fg);
  const bgParsed = parse(bg);
  if (!fgParsed || !bgParsed) return { ratio: 1, passesAA: false, passesAAA: false };
  const ratio = wcagContrast(fgParsed, bgParsed);
  return { ratio, passesAA: ratio >= 4.5, passesAAA: ratio >= 7 };
}

function autoForeground(bgL: number, hue: number): string {
  // For light backgrounds, use dark foreground; for dark, use light
  if (bgL > 0.5) {
    return oklchStr(0.15, 0.005, hue);
  }
  return oklchStr(0.96, 0.005, hue);
}

// ── Main generator ──

export function generateTheme(primaryHex: string): ThemeOutput {
  const base = parseToOklch(primaryHex);
  const scale = generateShadeScale(primaryHex);
  const h = base.h;

  // Tinted neutral helper: primary hue with very low chroma
  const tn = (l: number, c: number) => oklchStr(l, c, h);

  const light: Record<string, string> = {
    // Surfaces (tinted neutrals)
    '--background': tn(0.99, 0.005),
    '--foreground': tn(0.145, 0.008),
    '--card': tn(0.99, 0.007),
    '--card-foreground': tn(0.145, 0.008),
    '--popover': tn(0.99, 0.007),
    '--popover-foreground': tn(0.145, 0.008),
    '--muted': tn(0.96, 0.008),
    '--muted-foreground': tn(0.55, 0.012),

    // Primary
    '--primary': oklchStr(scale[500].l, scale[500].c, scale[500].h),
    '--primary-foreground': autoForeground(scale[500].l, h),

    // Secondary (light shade of primary)
    '--secondary': tn(0.96, 0.012),
    '--secondary-foreground': tn(0.21, 0.010),

    // Accent (same as primary)
    '--accent': oklchStr(scale[500].l, scale[500].c, scale[500].h),
    '--accent-foreground': autoForeground(scale[500].l, h),

    // Destructive (fixed)
    '--destructive': 'oklch(0.577 0.245 27.325)',

    // Borders
    '--border': tn(0.91, 0.006),
    '--input': tn(0.91, 0.006),
    '--ring': oklchStr(scale[300].l, scale[300].c, scale[300].h),

    // Charts
    '--chart-1': oklchStr(scale[200].l, scale[200].c, scale[200].h),
    '--chart-2': oklchStr(scale[300].l, scale[300].c, scale[300].h),
    '--chart-3': oklchStr(scale[400].l, scale[400].c, scale[400].h),
    '--chart-4': oklchStr(scale[500].l, scale[500].c, scale[500].h),
    '--chart-5': oklchStr(scale[600].l, scale[600].c, scale[600].h),

    // Sidebar
    '--sidebar': tn(0.98, 0.006),
    '--sidebar-foreground': tn(0.145, 0.008),
    '--sidebar-primary': oklchStr(scale[500].l, scale[500].c, scale[500].h),
    '--sidebar-primary-foreground': autoForeground(scale[500].l, h),
    '--sidebar-accent': oklchStr(0.92, 0.03, h),
    '--sidebar-accent-foreground': oklchStr(0.25, 0.05, h),
    '--sidebar-border': tn(0.91, 0.006),
    '--sidebar-ring': oklchStr(scale[300].l, scale[300].c, scale[300].h),
  };

  const dark: Record<string, string> = {
    // Surfaces (tinted neutrals)
    '--background': tn(0.145, 0.005),
    '--foreground': tn(0.985, 0.005),
    '--card': tn(0.20, 0.007),
    '--card-foreground': tn(0.985, 0.005),
    '--popover': tn(0.20, 0.007),
    '--popover-foreground': tn(0.985, 0.005),
    '--muted': tn(0.27, 0.008),
    '--muted-foreground': tn(0.71, 0.010),

    // Primary (lighter shade for dark mode)
    '--primary': oklchStr(scale[400].l, scale[400].c, scale[400].h),
    '--primary-foreground': autoForeground(scale[400].l, h),

    // Secondary
    '--secondary': tn(0.27, 0.010),
    '--secondary-foreground': tn(0.985, 0.005),

    // Accent
    '--accent': oklchStr(scale[400].l, scale[400].c, scale[400].h),
    '--accent-foreground': autoForeground(scale[400].l, h),

    // Destructive (fixed)
    '--destructive': 'oklch(0.704 0.191 22.216)',

    // Borders
    '--border': 'oklch(1 0 0 / 10%)',
    '--input': 'oklch(1 0 0 / 15%)',
    '--ring': oklchStr(scale[600].l, scale[600].c, scale[600].h),

    // Charts
    '--chart-1': oklchStr(scale[200].l, scale[200].c, scale[200].h),
    '--chart-2': oklchStr(scale[300].l, scale[300].c, scale[300].h),
    '--chart-3': oklchStr(scale[400].l, scale[400].c, scale[400].h),
    '--chart-4': oklchStr(scale[500].l, scale[500].c, scale[500].h),
    '--chart-5': oklchStr(scale[600].l, scale[600].c, scale[600].h),

    // Sidebar
    '--sidebar': tn(0.20, 0.007),
    '--sidebar-foreground': tn(0.985, 0.005),
    '--sidebar-primary': oklchStr(scale[400].l, scale[400].c * 1.05, scale[400].h),
    '--sidebar-primary-foreground': autoForeground(scale[400].l, h),
    '--sidebar-accent': oklchStr(0.32, 0.06, h),
    '--sidebar-accent-foreground': oklchStr(0.985, 0.005, h),
    '--sidebar-border': 'oklch(1 0 0 / 10%)',
    '--sidebar-ring': oklchStr(scale[600].l, scale[600].c, scale[600].h),
  };

  return { light, dark };
}

// ── Merge overrides ──

export interface ThemeOverrides {
  light?: Record<string, string>;
  dark?: Record<string, string>;
}

export function mergeThemeWithOverrides(
  generated: ThemeOutput,
  overrides: ThemeOverrides | null | undefined,
): ThemeOutput {
  if (!overrides) return generated;
  return {
    light: { ...generated.light, ...overrides.light },
    dark: { ...generated.dark, ...overrides.dark },
  };
}

// ── CSS serialization ──

export function themeToCSS(theme: ThemeOutput, radiusOverride?: string): string {
  const radiusVar = radiusOverride ? `--radius: ${radiusOverride};` : '';
  const lightVars = Object.entries(theme.light)
    .map(([k, v]) => `${k}: ${v};`)
    .join(' ');
  const darkVars = Object.entries(theme.dark)
    .map(([k, v]) => `${k}: ${v};`)
    .join(' ');
  return `:root { ${lightVars} ${radiusVar} } .dark { ${darkVars} ${radiusVar} }`;
}
```

- [ ] **Step 3: Verify it compiles**

```bash
cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/web exec tsc --noEmit --pretty 2>&1 | head -20
```

Expected: No errors from `theme-generator.ts`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/theme-generator.ts apps/web/package.json pnpm-lock.yaml
git commit -m "feat(branding): add OKLCH theme generator engine with culori"
```

---

### Task 2: Create color extraction utility

**Files:**
- Create: `apps/web/lib/color-extraction.ts`

- [ ] **Step 1: Create the dominant color extractor**

Create `apps/web/lib/color-extraction.ts`:

```typescript
import { parse, converter, formatHex } from 'culori';

const toOklch = converter('oklch');

interface Point {
  l: number;
  c: number;
  h: number;
  count: number;
}

/**
 * Extract the dominant color from an image URL using canvas + k-means in OKLCH.
 * Runs entirely client-side, ~50ms.
 */
export async function extractDominantColor(imageUrl: string): Promise<string> {
  const img = await loadImage(imageUrl);
  const pixels = getPixels(img, 64); // downsample to 64px
  const clusters = kMeansClusters(pixels, 5, 10);

  // Sort by count descending, skip near-white/near-black clusters
  const sorted = clusters
    .filter((c) => c.l > 0.1 && c.l < 0.9 && c.c > 0.02)
    .sort((a, b) => b.count - a.count);

  if (sorted.length === 0) {
    // Fallback: return the most common cluster regardless of filters
    clusters.sort((a, b) => b.count - a.count);
    return oklchToHex(clusters[0] ?? { l: 0.5, c: 0.1, h: 240 });
  }

  return oklchToHex(sorted[0]);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function getPixels(img: HTMLImageElement, maxSize: number): Point[] {
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);

  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  const points: Point[] = [];
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 128) continue; // skip transparent pixels
    const hex = `#${data[i].toString(16).padStart(2, '0')}${data[i + 1].toString(16).padStart(2, '0')}${data[i + 2].toString(16).padStart(2, '0')}`;
    const parsed = parse(hex);
    if (!parsed) continue;
    const oklch = toOklch(parsed);
    points.push({ l: oklch.l ?? 0, c: oklch.c ?? 0, h: oklch.h ?? 0, count: 1 });
  }
  return points;
}

function kMeansClusters(points: Point[], k: number, iterations: number): Point[] {
  if (points.length === 0) return [{ l: 0.5, c: 0.1, h: 240, count: 1 }];

  // Initialize centroids from evenly spaced points
  const step = Math.max(1, Math.floor(points.length / k));
  let centroids: Point[] = Array.from({ length: k }, (_, i) => ({
    ...points[Math.min(i * step, points.length - 1)],
    count: 0,
  }));

  for (let iter = 0; iter < iterations; iter++) {
    // Reset
    const sums = centroids.map(() => ({ l: 0, c: 0, h: 0, count: 0 }));

    // Assign each point to nearest centroid
    for (const p of points) {
      let minDist = Infinity;
      let bestIdx = 0;
      for (let j = 0; j < centroids.length; j++) {
        const d = oklchDistance(p, centroids[j]);
        if (d < minDist) {
          minDist = d;
          bestIdx = j;
        }
      }
      sums[bestIdx].l += p.l;
      sums[bestIdx].c += p.c;
      sums[bestIdx].h += p.h;
      sums[bestIdx].count += 1;
    }

    // Update centroids
    centroids = sums.map((s) =>
      s.count > 0
        ? { l: s.l / s.count, c: s.c / s.count, h: s.h / s.count, count: s.count }
        : { l: 0.5, c: 0.1, h: 240, count: 0 },
    );
  }

  return centroids;
}

function oklchDistance(a: Point, b: Point): number {
  const dl = a.l - b.l;
  const dc = a.c - b.c;
  // Hue is circular, convert to cartesian for distance
  const ha = (a.h * Math.PI) / 180;
  const hb = (b.h * Math.PI) / 180;
  const dh = a.c * Math.cos(ha) - b.c * Math.cos(hb);
  const dhb = a.c * Math.sin(ha) - b.c * Math.sin(hb);
  return dl * dl + dc * dc + dh * dh + dhb * dhb;
}

function oklchToHex(p: { l: number; c: number; h: number }): string {
  const hex = formatHex({ mode: 'oklch', l: p.l, c: p.c, h: p.h });
  return hex ?? '#000000';
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/web exec tsc --noEmit --pretty 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/color-extraction.ts
git commit -m "feat(branding): add client-side dominant color extraction from logo"
```

---

### Task 3: Database migration and API changes

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (add fields to TenantBranding)
- Modify: `apps/api/src/modules/branding/dto.ts`
- Modify: `apps/api/src/modules/branding/branding.service.ts`
- Modify: `packages/shared/src/types/branding.ts`
- Modify: `packages/shared/src/schemas/branding.schema.ts`

- [ ] **Step 1: Add new fields to Prisma schema**

In `apps/api/prisma/schema.prisma`, add to the `TenantBranding` model (after `accentColor`):

```prisma
  themeOverrides Json?
  borderRadius   String?
```

- [ ] **Step 2: Run Prisma migration**

```bash
cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/api exec prisma migrate dev --name add-theme-overrides
```

- [ ] **Step 3: Update shared types**

In `packages/shared/src/types/branding.ts`, add the new fields to `TenantBranding`:

```typescript
export interface ThemeOverrides {
  light?: Record<string, string>;
  dark?: Record<string, string>;
}

export interface TenantBranding {
  id: string;
  tenantId: string;
  logoUrl: string | null;
  isotipoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  themeOverrides: ThemeOverrides | null;
  borderRadius: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

Also update `UpdateBrandingInput`:

```typescript
export interface UpdateBrandingInput {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  themeOverrides?: ThemeOverrides;
  borderRadius?: string;
}
```

And add a new type for color suggestion (replaces GeneratePaletteResult):

```typescript
export interface SuggestColorResult {
  hex: string;
}
```

Keep `GeneratePaletteResult` for backward compatibility but add `SuggestColorResult`.

- [ ] **Step 4: Update shared Zod schemas**

In `packages/shared/src/schemas/branding.schema.ts`, replace the full file content:

```typescript
import { z } from 'zod';

const hexColorRegex = /^#[0-9a-fA-F]{6}$/;
const oklchRegex = /^oklch\([\d.]+\s+[\d.]+\s+[\d.]+\)$/;
const cssColorValue = z.string().refine(
  (v) => hexColorRegex.test(v) || oklchRegex.test(v) || v.startsWith('oklch('),
  'Debe ser un color hex (#RRGGBB) o oklch() valido',
);

const themeOverridesSchema = z.object({
  light: z.record(z.string(), cssColorValue).optional(),
  dark: z.record(z.string(), cssColorValue).optional(),
}).optional();

export const updateBrandingSchema = z.object({
  primaryColor: z.string().regex(hexColorRegex, 'Color primario invalido').optional(),
  secondaryColor: z.string().regex(hexColorRegex, 'Color secundario invalido').optional(),
  accentColor: z.string().regex(hexColorRegex, 'Color de acento invalido').optional(),
  themeOverrides: themeOverridesSchema,
  borderRadius: z.enum(['sm', 'md', 'lg', 'xl']).optional(),
});

export const generatePaletteSchema = z.discriminatedUnion('source', [
  z.object({
    source: z.literal('logo'),
  }),
  z.object({
    source: z.literal('description'),
    description: z.string().min(5, 'Descripcion muy corta').max(500, 'Descripcion muy larga'),
  }),
]);

export const suggestColorSchema = z.object({
  description: z.string().min(5, 'Descripcion muy corta').max(500, 'Descripcion muy larga'),
});

export type UpdateBrandingSchema = z.infer<typeof updateBrandingSchema>;
export type GeneratePaletteSchema = z.infer<typeof generatePaletteSchema>;
export type SuggestColorSchema = z.infer<typeof suggestColorSchema>;
```

- [ ] **Step 5: Update API DTO**

In `apps/api/src/modules/branding/dto.ts`, replace the full file:

```typescript
import { z } from 'zod';

const hexColorRegex = /^#[0-9a-fA-F]{6}$/;
const oklchRegex = /^oklch\([\d.]+\s+[\d.]+\s+[\d.]+\)$/;
const cssColorValue = z.string().refine(
  (v) => hexColorRegex.test(v) || oklchRegex.test(v) || v.startsWith('oklch('),
  'Debe ser un color hex o oklch() valido',
);

const themeOverridesSchema = z.object({
  light: z.record(z.string(), cssColorValue).optional(),
  dark: z.record(z.string(), cssColorValue).optional(),
}).optional();

export const updateBrandingDto = z.object({
  primaryColor: z.string().regex(hexColorRegex, 'Color primario invalido').optional(),
  secondaryColor: z.string().regex(hexColorRegex, 'Color secundario invalido').optional(),
  accentColor: z.string().regex(hexColorRegex, 'Color de acento invalido').optional(),
  themeOverrides: themeOverridesSchema,
  borderRadius: z.enum(['sm', 'md', 'lg', 'xl']).optional(),
});

export const generatePaletteDto = z.discriminatedUnion('source', [
  z.object({ source: z.literal('logo') }),
  z.object({
    source: z.literal('description'),
    description: z.string().min(5, 'Descripcion muy corta').max(500, 'Descripcion muy larga'),
  }),
]);

export const suggestColorDto = z.object({
  description: z.string().min(5, 'Descripcion muy corta').max(500, 'Descripcion muy larga'),
});

export type UpdateBrandingDto = z.infer<typeof updateBrandingDto>;
export type GeneratePaletteDto = z.infer<typeof generatePaletteDto>;
export type SuggestColorDto = z.infer<typeof suggestColorDto>;
```

- [ ] **Step 6: Update BrandingService.updateColors to handle new fields**

In `apps/api/src/modules/branding/branding.service.ts`, update the `updateColors` method:

```typescript
async updateColors(tenantId: string, dto: UpdateBrandingDto) {
  const data: Record<string, unknown> = {};
  if (dto.primaryColor !== undefined) data.primaryColor = dto.primaryColor;
  if (dto.secondaryColor !== undefined) data.secondaryColor = dto.secondaryColor;
  if (dto.accentColor !== undefined) data.accentColor = dto.accentColor;
  if (dto.themeOverrides !== undefined) data.themeOverrides = dto.themeOverrides;
  if (dto.borderRadius !== undefined) data.borderRadius = dto.borderRadius;

  return this.prisma.tenantBranding.upsert({
    where: { tenantId },
    create: { tenantId, ...data },
    update: data,
  });
}
```

- [ ] **Step 7: Add suggest-color endpoint to BrandingService**

Add this method to `apps/api/src/modules/branding/branding.service.ts`:

```typescript
async suggestColor(tenantId: string, description: string): Promise<{ hex: string }> {
  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI();

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 64,
    messages: [
      {
        role: 'user',
        content: `Sugiere UN solo color primario (hex) para una marca con este estilo: "${description}". El color debe funcionar como color principal de una aplicacion web (botones, links, acentos). Responde SOLO con el hex, ejemplo: #1E40AF`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content?.trim();
  const match = content?.match(/#[0-9a-fA-F]{6}/);
  if (!match) throw new BadRequestException('No se pudo generar un color');

  await this.logAiUsage(tenantId, response);
  return { hex: match[0] };
}
```

- [ ] **Step 8: Add suggest-color endpoint to BrandingController**

Add to `apps/api/src/modules/branding/branding.controller.ts`:

```typescript
@Post('suggest-color')
async suggestColor(
  @CurrentTenant() tenantId: string,
  @Body(new ZodValidationPipe(suggestColorDto)) body: SuggestColorDto,
) {
  return this.brandingService.suggestColor(tenantId, body.description);
}
```

Add import for `suggestColorDto` and `SuggestColorDto` from `./dto`.

- [ ] **Step 9: Verify compilation**

```bash
cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/api exec tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 10: Commit**

```bash
git add apps/api/prisma/ packages/shared/src/ apps/api/src/modules/branding/
git commit -m "feat(branding): add themeOverrides, borderRadius fields and suggest-color endpoint"
```

---

### Task 4: Refactor BrandingProvider to use theme generator

**Files:**
- Modify: `apps/web/providers/branding-provider.tsx`
- Modify: `apps/web/lib/api/branding.ts`

- [ ] **Step 1: Update the frontend API client**

In `apps/web/lib/api/branding.ts`, add the new method and update types:

```typescript
import { api } from "@/lib/api-client";
import type { TenantBranding, GeneratePaletteResult } from "@zeru/shared";

export const brandingApi = {
  get: () => api.get<TenantBranding | null>("/tenants/current/branding"),

  updateColors: (data: {
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    themeOverrides?: { light?: Record<string, string>; dark?: Record<string, string> };
    borderRadius?: string;
  }) => api.patch<TenantBranding>("/tenants/current/branding", data),

  uploadLogo: (file: File) =>
    api.uploadFile<TenantBranding>("/tenants/current/branding/logo", file),

  uploadIsotipo: (file: File) =>
    api.uploadFile<TenantBranding>("/tenants/current/branding/isotipo", file),

  deleteLogo: () => api.delete<void>("/tenants/current/branding/logo"),

  deleteIsotipo: () => api.delete<void>("/tenants/current/branding/isotipo"),

  uploadFavicon: (file: File) =>
    api.uploadFile<TenantBranding>("/tenants/current/branding/favicon", file),

  deleteFavicon: () => api.delete<void>("/tenants/current/branding/favicon"),

  setFaviconFromIsotipo: () =>
    api.post<TenantBranding>(
      "/tenants/current/branding/favicon/from-isotipo",
      {},
    ),

  generateFavicon: () =>
    api.post<TenantBranding>(
      "/tenants/current/branding/favicon/generate",
      {},
    ),

  generatePalette: (
    input: { source: "logo" } | { source: "description"; description: string },
  ) =>
    api.post<GeneratePaletteResult>(
      "/tenants/current/branding/generate-palette",
      input,
    ),

  suggestColor: (description: string) =>
    api.post<{ hex: string }>("/tenants/current/branding/suggest-color", {
      description,
    }),
};
```

- [ ] **Step 2: Rewrite BrandingProvider**

Replace the full content of `apps/web/providers/branding-provider.tsx`:

```typescript
'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useTenantContext } from './tenant-provider';
import {
  generateTheme,
  mergeThemeWithOverrides,
  themeToCSS,
} from '@/lib/theme-generator';
import type { ThemeOverrides } from '@zeru/shared';

const BORDER_RADIUS_MAP: Record<string, string> = {
  sm: '0.25rem',
  md: '0.45rem',
  lg: '0.625rem',
  xl: '0.875rem',
};

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { tenant } = useTenantContext();
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const branding = tenant?.branding;
    if (!branding?.primaryColor) return;

    const styleId = 'branding-overrides';
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    const generated = generateTheme(branding.primaryColor);
    const overrides = branding.themeOverrides as ThemeOverrides | null;
    const merged = mergeThemeWithOverrides(generated, overrides);
    const radiusValue = branding.borderRadius
      ? BORDER_RADIUS_MAP[branding.borderRadius]
      : undefined;

    styleEl.textContent = themeToCSS(merged, radiusValue);

    // Favicon injection
    const faviconUrl = branding.faviconUrl;
    const faviconId = 'branding-favicon';
    let faviconEl = document.querySelector(
      `link#${faviconId}`,
    ) as HTMLLinkElement | null;

    if (faviconUrl) {
      if (!faviconEl) {
        faviconEl = document.createElement('link');
        faviconEl.id = faviconId;
        faviconEl.rel = 'icon';
        faviconEl.type = 'image/png';
        document.head.appendChild(faviconEl);
      }
      faviconEl.href = faviconUrl;
    } else if (faviconEl) {
      faviconEl.remove();
    }

    return () => {
      document.getElementById(styleId)?.remove();
      document.querySelector('link#branding-favicon')?.remove();
    };
  }, [tenant?.branding, resolvedTheme]);

  return <>{children}</>;
}
```

- [ ] **Step 3: Verify compilation**

```bash
cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/web exec tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 4: Test in browser**

Start dev server and verify:
1. Navigate to the app — should render with tinted neutrals if a primaryColor is set
2. Toggle light/dark mode — both should reflect the generated theme
3. If no primaryColor is set — should fall back to globals.css defaults

- [ ] **Step 5: Commit**

```bash
git add apps/web/providers/branding-provider.tsx apps/web/lib/api/branding.ts
git commit -m "feat(branding): refactor BrandingProvider to use full theme generator (35+ tokens)"
```

---

### Task 5: Build the shade preview component

**Files:**
- Create: `apps/web/components/branding/shade-preview.tsx`

- [ ] **Step 1: Create shade preview component**

Create `apps/web/components/branding/shade-preview.tsx`:

```tsx
'use client';

import { generateShadeScale } from '@/lib/theme-generator';
import { formatHex } from 'culori';
import type { Oklch } from 'culori';

interface ShadePreviewProps {
  primaryHex: string;
}

const SHADE_NAMES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

export function ShadePreview({ primaryHex }: ShadePreviewProps) {
  if (!primaryHex || !/^#[0-9a-fA-F]{6}$/.test(primaryHex)) return null;

  const scale = generateShadeScale(primaryHex);

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Escala generada</p>
      <div className="flex gap-1 rounded-lg overflow-hidden">
        {SHADE_NAMES.map((shade) => {
          const color = scale[shade];
          const oklch: Oklch = { mode: 'oklch', l: color.l, c: color.c, h: color.h };
          const hex = formatHex(oklch) ?? '#000';
          return (
            <div
              key={shade}
              className="flex-1 flex flex-col items-center"
              title={`${shade}: ${hex}`}
            >
              <div
                className="w-full h-8 rounded-sm"
                style={{ backgroundColor: hex }}
              />
              <span className="text-[10px] text-muted-foreground mt-1">
                {shade}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify compilation**

```bash
cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/web exec tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/branding/shade-preview.tsx
git commit -m "feat(branding): add shade scale preview component"
```

---

### Task 6: Build the contrast checker component

**Files:**
- Create: `apps/web/components/branding/contrast-checker.tsx`

- [ ] **Step 1: Create contrast checker component**

Create `apps/web/components/branding/contrast-checker.tsx`:

```tsx
'use client';

import { checkContrast } from '@/lib/theme-generator';

interface ContrastCheckerProps {
  fg: string;
  bg: string;
  label?: string;
}

export function ContrastChecker({ fg, bg, label }: ContrastCheckerProps) {
  const { ratio, passesAA } = checkContrast(fg, bg);

  if (passesAA) return null;

  return (
    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
      <span>&#9888;</span>
      <span>
        Contraste insuficiente{label ? ` (${label})` : ''}: {ratio.toFixed(1)}:1
        {' '}(min 4.5:1)
      </span>
    </p>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/branding/contrast-checker.tsx
git commit -m "feat(branding): add WCAG contrast checker component"
```

---

### Task 7: Build the token editor group component

**Files:**
- Create: `apps/web/components/branding/token-editor-group.tsx`

- [ ] **Step 1: Create the token editor group**

Create `apps/web/components/branding/token-editor-group.tsx`:

```tsx
'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ContrastChecker } from './contrast-checker';
import { formatHex, parse } from 'culori';

interface TokenDef {
  variable: string;
  label: string;
  pairedForeground?: string; // variable name of the foreground to contrast-check against
}

interface TokenEditorGroupProps {
  title: string;
  tokens: TokenDef[];
  values: Record<string, string>;         // current values (merged: generated + overrides)
  generatedValues: Record<string, string>; // original generated values (for reset)
  onChange: (variable: string, value: string) => void;
  onReset: (variable: string) => void;
}

function oklchToHexSafe(oklchStr: string): string {
  const parsed = parse(oklchStr);
  if (!parsed) return '#000000';
  return formatHex(parsed) ?? '#000000';
}

export function TokenEditorGroup({
  title,
  tokens,
  values,
  generatedValues,
  onChange,
  onReset,
}: TokenEditorGroupProps) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-muted-foreground">{title}</h4>
      <div className="space-y-2">
        {tokens.map(({ variable, label, pairedForeground }) => {
          const currentValue = values[variable] ?? '';
          const generatedValue = generatedValues[variable] ?? '';
          const isOverridden = currentValue !== generatedValue;
          const hexValue = oklchToHexSafe(currentValue);

          return (
            <div key={variable} className="flex items-center gap-2">
              <input
                type="color"
                value={hexValue}
                onChange={(e) => onChange(variable, e.target.value)}
                className="size-7 rounded border-0 cursor-pointer p-0 bg-transparent shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs truncate">{label}</span>
                  {isOverridden && (
                    <span className="text-[10px] text-amber-500 font-medium">
                      editado
                    </span>
                  )}
                </div>
                <Input
                  value={currentValue}
                  onChange={(e) => onChange(variable, e.target.value)}
                  className="h-6 text-xs font-mono mt-0.5"
                  placeholder="oklch(...) o #hex"
                />
                {pairedForeground && values[pairedForeground] && (
                  <ContrastChecker
                    fg={values[pairedForeground]}
                    bg={currentValue}
                    label={label}
                  />
                )}
              </div>
              {isOverridden && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 shrink-0"
                  onClick={() => onReset(variable)}
                  title="Restaurar valor generado"
                >
                  &#8634;
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify compilation**

```bash
cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/web exec tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/branding/token-editor-group.tsx
git commit -m "feat(branding): add token editor group component for advanced mode"
```

---

### Task 8: Build the main theme editor

**Files:**
- Create: `apps/web/components/branding/theme-editor.tsx`

- [ ] **Step 1: Create the theme editor component**

Create `apps/web/components/branding/theme-editor.tsx`:

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
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
  THEME_TOKEN_NAMES,
} from '@/lib/theme-generator';
import type { ThemeOutput, ThemeOverrides } from '@/lib/theme-generator';
import { brandingApi } from '@/lib/api/branding';
import { extractDominantColor } from '@/lib/color-extraction';
import type { TenantBranding } from '@zeru/shared';

// ── Token group definitions ──

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

interface ThemeEditorProps {
  branding: TenantBranding | null;
  logoUrl: string | null;
  onSaved: () => void;
}

export function ThemeEditor({ branding, logoUrl, onSaved }: ThemeEditorProps) {
  const [primaryColor, setPrimaryColor] = useState(branding?.primaryColor ?? '');
  const [borderRadius, setBorderRadius] = useState(branding?.borderRadius ?? 'md');
  const [overrides, setOverrides] = useState<ThemeOverrides>(
    (branding?.themeOverrides as ThemeOverrides) ?? {},
  );
  const [activeMode, setActiveMode] = useState<'light' | 'dark'>('light');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [description, setDescription] = useState('');

  // Generated theme from primary color
  const generated: ThemeOutput | null = primaryColor && /^#[0-9a-fA-F]{6}$/.test(primaryColor)
    ? generateTheme(primaryColor)
    : null;

  // Merged values (generated + overrides)
  const merged = generated ? mergeThemeWithOverrides(generated, overrides) : null;

  // Current mode values for the advanced editor
  const currentModeValues = merged?.[activeMode] ?? {};
  const generatedModeValues = generated?.[activeMode] ?? {};

  // ── Live preview ──
  useEffect(() => {
    if (!merged) {
      // Remove any existing overrides when no primary
      document.getElementById('branding-overrides')?.remove();
      return;
    }

    const RADIUS_MAP: Record<string, string> = {
      sm: '0.25rem', md: '0.45rem', lg: '0.625rem', xl: '0.875rem',
    };

    const styleId = 'branding-overrides';
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = themeToCSS(merged, RADIUS_MAP[borderRadius]);
  }, [merged, borderRadius]);

  // ── Handlers ──

  const handleTokenChange = useCallback(
    (variable: string, value: string) => {
      setOverrides((prev) => ({
        ...prev,
        [activeMode]: { ...(prev[activeMode] ?? {}), [variable]: value },
      }));
    },
    [activeMode],
  );

  const handleTokenReset = useCallback(
    (variable: string) => {
      setOverrides((prev) => {
        const modeOverrides = { ...(prev[activeMode] ?? {}) };
        delete modeOverrides[variable];
        return { ...prev, [activeMode]: modeOverrides };
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
      setPrimaryColor(hex);
      setOverrides({});
    } finally {
      setExtracting(false);
    }
  };

  const handleSuggestColor = async () => {
    if (!description.trim()) return;
    setSuggesting(true);
    try {
      const result = await brandingApi.suggestColor(description);
      setPrimaryColor(result.hex);
      setOverrides({});
      setDescriptionOpen(false);
      setDescription('');
    } finally {
      setSuggesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await brandingApi.updateColors({
        primaryColor: primaryColor || undefined,
        themeOverrides: Object.keys(overrides).length > 0 ? overrides : undefined,
        borderRadius: borderRadius || undefined,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setPrimaryColor(branding?.primaryColor ?? '');
    setBorderRadius(branding?.borderRadius ?? 'md');
    setOverrides((branding?.themeOverrides as ThemeOverrides) ?? {});
  };

  const handleCopyCSS = () => {
    if (!merged) return;
    const RADIUS_MAP: Record<string, string> = {
      sm: '0.25rem', md: '0.45rem', lg: '0.625rem', xl: '0.875rem',
    };
    const css = themeToCSS(merged, RADIUS_MAP[borderRadius]);
    navigator.clipboard.writeText(css);
  };

  const handleExportJSON = () => {
    if (!merged) return;
    const blob = new Blob([JSON.stringify(merged, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'theme.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* ── Simple mode ── */}
      <div className="space-y-4">
        {/* Primary color picker */}
        <div className="space-y-2">
          <Label>Color principal</Label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={primaryColor || '#000000'}
              onChange={(e) => {
                setPrimaryColor(e.target.value);
                setOverrides({});
              }}
              className="size-10 rounded-md border-0 cursor-pointer p-0 bg-transparent"
            />
            <Input
              value={primaryColor}
              onChange={(e) => {
                setPrimaryColor(e.target.value);
                if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
                  setOverrides({});
                }
              }}
              placeholder="#1E40AF"
              className="w-32 font-mono"
            />
          </div>
        </div>

        {/* Shade scale preview */}
        {primaryColor && <ShadePreview primaryHex={primaryColor} />}

        {/* Source buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExtractFromLogo}
            disabled={extracting || !logoUrl}
          >
            {extracting ? 'Extrayendo...' : 'Extraer del logo'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDescriptionOpen(true)}
            disabled={suggesting}
          >
            Describir estilo
          </Button>
        </div>

        {/* Description input for AI suggestion */}
        {descriptionOpen && (
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Label>Describe el estilo deseado</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ej: Profesional y moderno, laboratorio clinico"
              />
            </div>
            <Button onClick={handleSuggestColor} disabled={suggesting} size="sm">
              {suggesting ? 'Sugiriendo...' : 'Sugerir'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDescriptionOpen(false)}>
              Cancelar
            </Button>
          </div>
        )}

        {/* Border radius */}
        <div className="space-y-2">
          <Label>Radio de bordes</Label>
          <div className="flex gap-2">
            {RADIUS_PRESETS.map(({ value, label }) => (
              <Button
                key={value}
                variant={borderRadius === value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setBorderRadius(value)}
                className="w-10"
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Advanced mode ── */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            {advancedOpen ? '▾' : '▸'} Edicion avanzada
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-6 pt-4">
          {!generated ? (
            <p className="text-sm text-muted-foreground">
              Selecciona un color principal para habilitar la edicion avanzada.
            </p>
          ) : (
            <>
              {/* Mode toggle */}
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

              <TokenEditorGroup
                title="Superficies"
                tokens={SURFACE_TOKENS}
                values={currentModeValues}
                generatedValues={generatedModeValues}
                onChange={handleTokenChange}
                onReset={handleTokenReset}
              />
              <TokenEditorGroup
                title="Interactivos"
                tokens={INTERACTIVE_TOKENS}
                values={currentModeValues}
                generatedValues={generatedModeValues}
                onChange={handleTokenChange}
                onReset={handleTokenReset}
              />
              <TokenEditorGroup
                title="Bordes y focus"
                tokens={BORDER_TOKENS}
                values={currentModeValues}
                generatedValues={generatedModeValues}
                onChange={handleTokenChange}
                onReset={handleTokenReset}
              />
              <TokenEditorGroup
                title="Sidebar"
                tokens={SIDEBAR_TOKENS}
                values={currentModeValues}
                generatedValues={generatedModeValues}
                onChange={handleTokenChange}
                onReset={handleTokenReset}
              />
              <TokenEditorGroup
                title="Graficos"
                tokens={CHART_TOKENS}
                values={currentModeValues}
                generatedValues={generatedModeValues}
                onChange={handleTokenChange}
                onReset={handleTokenReset}
              />

              {/* Advanced footer */}
              <div className="flex flex-wrap gap-2 pt-2 border-t">
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
            </>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* ── Save / Cancel ── */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={handleCancel}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify compilation**

```bash
cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/web exec tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/branding/theme-editor.tsx
git commit -m "feat(branding): add ThemeEditor component with simple + advanced modes"
```

---

### Task 9: Integrate ThemeEditor into the organization settings page

**Files:**
- Modify: `apps/web/app/(dashboard)/settings/organization/page.tsx`

- [ ] **Step 1: Replace the color palette section in AppearanceTab**

In `apps/web/app/(dashboard)/settings/organization/page.tsx`, replace the `AppearanceTab` component. Remove the `ColorPickerField` import and the entire color state/handlers. Replace the "Paleta de colores" `<Card>` with the new `ThemeEditor`.

The updated `AppearanceTab` should:
1. Remove imports: `ColorPickerField`
2. Remove state: `colors`, `generatingPalette`, `descriptionOpen`, `description`
3. Remove handlers: `handleSaveColors`, `handleGenerateFromLogo`, `handleGenerateFromDescription`
4. Add import: `ThemeEditor` from `@/components/branding/theme-editor`
5. Replace the "Paleta de colores" Card with:

```tsx
{/* Theme Editor */}
<Card>
  <CardHeader>
    <CardTitle>Paleta de colores</CardTitle>
    <p className="text-sm text-muted-foreground">
      Define el color principal. Se generan automaticamente todos los
      colores del sistema para light y dark mode.
    </p>
  </CardHeader>
  <CardContent>
    <ThemeEditor
      branding={branding}
      logoUrl={branding?.logoUrl ?? null}
      onSaved={refreshBranding}
    />
  </CardContent>
</Card>
```

- [ ] **Step 2: Verify compilation and lint**

```bash
cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/web exec tsc --noEmit --pretty 2>&1 | head -20
cd /Users/camiloespinoza/Zeru && pnpm lint --filter @zeru/web 2>&1 | tail -10
```

- [ ] **Step 3: Test in browser**

Start dev server and verify:
1. Navigate to Settings > Organization > Appearance
2. Pick a primary color — shade scale appears, live preview updates the entire app
3. Toggle light/dark — both modes reflect generated theme
4. Open "Edicion avanzada" — grouped tokens appear with pickers
5. Edit a token — "editado" badge appears, reset button works
6. "Extraer del logo" works (if logo uploaded)
7. "Describir estilo" opens text input, generates color via AI
8. Save — persists to database, page reloads with saved values
9. Cancel — reverts to saved state

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(dashboard\)/settings/organization/page.tsx
git commit -m "feat(branding): integrate ThemeEditor into organization settings page"
```

---

### Task 10: Deprecate old color-utils and clean up

**Files:**
- Modify: `apps/web/lib/color-utils.ts`

- [ ] **Step 1: Deprecate deriveColorScale**

Replace the content of `apps/web/lib/color-utils.ts`:

```typescript
/**
 * @deprecated Use generateTheme() from '@/lib/theme-generator' instead.
 * This module is kept for backward compatibility only.
 */
export {
  generateTheme,
  generateShadeScale,
  checkContrast,
  type ThemeOutput,
  type ThemeOverrides,
} from './theme-generator';

// Legacy re-export for any remaining consumers
export interface DerivedColorScale {
  light: string;
  dark: string;
  lightForeground: string;
  darkForeground: string;
}

/**
 * @deprecated Use generateTheme() instead.
 */
export function deriveColorScale(hex: string): DerivedColorScale {
  const { generateTheme: gen } = require('./theme-generator');
  const theme = gen(hex);
  return {
    light: theme.light['--primary'],
    dark: theme.dark['--primary'],
    lightForeground: theme.light['--primary-foreground'],
    darkForeground: theme.dark['--primary-foreground'],
  };
}

export function hexToOklch() {
  throw new Error('Deprecated: use culori parse() instead');
}

export function oklchToString() {
  throw new Error('Deprecated: use theme-generator oklchStr instead');
}
```

- [ ] **Step 2: Check for remaining consumers of old exports**

```bash
cd /Users/camiloespinoza/Zeru && grep -r "from.*color-utils" apps/web/  --include="*.ts" --include="*.tsx" | grep -v node_modules
```

If any file still imports from `color-utils`, update the import to use `theme-generator` instead. The BrandingProvider was already updated in Task 4.

- [ ] **Step 3: Verify compilation**

```bash
cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/web exec tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/color-utils.ts
git commit -m "refactor(branding): deprecate color-utils in favor of theme-generator"
```

---

### Task 11: Run lint, final verification, and clean up

**Files:**
- All modified files

- [ ] **Step 1: Run full lint**

```bash
cd /Users/camiloespinoza/Zeru && pnpm lint
```

Fix any lint errors in the files we modified.

- [ ] **Step 2: Run type check for both apps**

```bash
cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/web exec tsc --noEmit --pretty
cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/api exec tsc --noEmit --pretty
```

- [ ] **Step 3: Test the full flow in browser**

Checklist:
- [ ] No primaryColor set → app uses globals.css defaults (no regressions)
- [ ] Set primary color → entire app updates live (backgrounds tinted, buttons colored, sidebar themed)
- [ ] Toggle dark mode → all tokens switch correctly
- [ ] Advanced editor: edit a single token → only that token changes
- [ ] Advanced editor: reset one token → reverts to generated
- [ ] Advanced editor: reset all → all overrides cleared
- [ ] Save → refresh page → theme persists
- [ ] Border radius selector works
- [ ] Extract from logo → picks dominant color
- [ ] Describe style → AI suggests hex → generates theme
- [ ] Copy CSS → valid CSS in clipboard
- [ ] Export JSON → valid JSON file downloaded

- [ ] **Step 4: Commit any lint/type fixes**

```bash
git add -A
git commit -m "fix(branding): lint and type fixes for theme color system"
```
