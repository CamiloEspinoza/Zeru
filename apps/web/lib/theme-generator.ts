import { parse, formatHex, converter, wcagContrast } from 'culori';

// ---------------------------------------------------------------------------
// Types & interfaces
// ---------------------------------------------------------------------------

export interface OklchColor {
  l: number;
  c: number;
  h: number;
}

export interface ThemeOutput {
  light: Record<string, string>;
  dark: Record<string, string>;
}

export interface ThemeOverrides {
  light?: Record<string, string>;
  dark?: Record<string, string>;
}

export interface ShadeScale {
  [key: number]: OklchColor;
}

// ---------------------------------------------------------------------------
// Token names (30 CSS custom properties used by shadcn/ui + sidebar)
// ---------------------------------------------------------------------------

export const THEME_TOKEN_NAMES = [
  '--background',
  '--foreground',
  '--card',
  '--card-foreground',
  '--popover',
  '--popover-foreground',
  '--primary',
  '--primary-foreground',
  '--secondary',
  '--secondary-foreground',
  '--muted',
  '--muted-foreground',
  '--accent',
  '--accent-foreground',
  '--destructive',
  '--border',
  '--input',
  '--ring',
  '--chart-1',
  '--chart-2',
  '--chart-3',
  '--chart-4',
  '--chart-5',
  '--sidebar',
  '--sidebar-foreground',
  '--sidebar-primary',
  '--sidebar-primary-foreground',
  '--sidebar-accent',
  '--sidebar-accent-foreground',
  '--sidebar-border',
  '--sidebar-ring',
] as const;

export type ThemeTokenName = (typeof THEME_TOKEN_NAMES)[number];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const toOklch = converter('oklch');

function hexToOklch(hex: string): OklchColor {
  const parsed = parse(hex);
  if (!parsed) {
    throw new Error(`Invalid color: ${hex}`);
  }
  const oklch = toOklch(parsed);
  return {
    l: oklch.l,
    c: oklch.c,
    h: oklch.h ?? 0,
  };
}

function oklchStr(color: OklchColor): string {
  return `oklch(${color.l.toFixed(4)} ${color.c.toFixed(4)} ${color.h.toFixed(3)})`;
}

/**
 * Convert an OKLCH color object to a hex string via culori.
 */
export function oklchToHex(color: OklchColor): string {
  return formatHex({ mode: 'oklch', ...color }) ?? '#000000';
}

/**
 * Return a light or dark foreground color depending on background lightness.
 * Light backgrounds (L > 0.5) get a dark foreground; dark backgrounds get a light one.
 */
function autoForeground(bg: OklchColor, primaryHue: number): OklchColor {
  if (bg.l > 0.5) {
    // Dark foreground for light backgrounds
    return { l: 0.145, c: 0.005, h: primaryHue };
  }
  // Light foreground for dark backgrounds
  return { l: 0.985, c: 0.005, h: primaryHue };
}

// ---------------------------------------------------------------------------
// Shade scale generation
// ---------------------------------------------------------------------------

/**
 * Shade step indices used throughout (50, 100, 200, ..., 950).
 */
const SHADE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

/**
 * Lightness values for each shade step — from nearly white (50) to nearly black (950).
 */
const LIGHTNESS_MAP: number[] = [
  0.97, 0.93, 0.87, 0.77, 0.65, 0.55, 0.45, 0.37, 0.29, 0.21, 0.13,
];

/**
 * Generate 11 OKLCH shades from a hex color.
 *
 * - Lightness: fixed perceptual ramp
 * - Chroma: sine curve peaking at mid-tones (shade 500)
 * - Hue: subtle rotation (+2deg highlights, -2deg shadows)
 */
export function generateShadeScale(baseHex: string): ShadeScale {
  const base = hexToOklch(baseHex);
  const scale: ShadeScale = {};

  for (let i = 0; i < SHADE_STEPS.length; i++) {
    const step = SHADE_STEPS[i];
    const L = LIGHTNESS_MAP[i];

    // Normalised position: 0 = lightest shade, 1 = darkest shade
    const t = i / (SHADE_STEPS.length - 1);

    // Chroma: sine curve peaking at the mid-tone (t = 0.5)
    const chromaScale = Math.sin(t * Math.PI);
    const C = base.c * chromaScale;

    // Hue: rotate +2deg at highlights, -2deg at shadows (linear from +2 to -2)
    const hueShift = 2 - 4 * t; // +2 at t=0, -2 at t=1
    const H = (base.h + hueShift + 360) % 360;

    scale[step] = { l: L, c: C, h: H };
  }

  return scale;
}

// ---------------------------------------------------------------------------
// Theme generation
// ---------------------------------------------------------------------------

/**
 * Generate all CSS custom property values for light and dark mode from a
 * single primary hex color.
 */
export function generateTheme(primaryHex: string): ThemeOutput {
  const base = hexToOklch(primaryHex);
  const shades = generateShadeScale(primaryHex);
  const hue = base.h;

  // Tinted neutral helpers — uses the primary hue with very low chroma
  const neutral = (l: number, c = 0.007): OklchColor => ({ l, c, h: hue });

  // ---- LIGHT MODE ----
  const lightBg = neutral(0.985, 0.005);
  const lightCard = neutral(0.995, 0.005);
  const lightPopover = neutral(0.995, 0.005);
  const lightMuted = neutral(0.955, 0.008);
  const lightBorder = neutral(0.915, 0.008);
  const lightInput = neutral(0.905, 0.008);
  const lightPrimary = shades[500];
  const lightSecondary = neutral(0.945, 0.01);
  const lightAccent = neutral(0.940, 0.01);
  const lightRing = shades[500];
  const lightSidebar = neutral(0.975, 0.006);
  const lightSidebarBorder = neutral(0.920, 0.008);

  const light: Record<string, string> = {
    '--background': oklchStr(lightBg),
    '--foreground': oklchStr(autoForeground(lightBg, hue)),
    '--card': oklchStr(lightCard),
    '--card-foreground': oklchStr(autoForeground(lightCard, hue)),
    '--popover': oklchStr(lightPopover),
    '--popover-foreground': oklchStr(autoForeground(lightPopover, hue)),
    '--primary': oklchStr(lightPrimary),
    '--primary-foreground': oklchStr(autoForeground(lightPrimary, hue)),
    '--secondary': oklchStr(lightSecondary),
    '--secondary-foreground': oklchStr(autoForeground(lightSecondary, hue)),
    '--muted': oklchStr(lightMuted),
    '--muted-foreground': oklchStr(neutral(0.45, 0.01)),
    '--accent': oklchStr(lightAccent),
    '--accent-foreground': oklchStr(autoForeground(lightAccent, hue)),
    '--destructive': 'oklch(0.577 0.245 27.325)',
    '--border': oklchStr(lightBorder),
    '--input': oklchStr(lightInput),
    '--ring': oklchStr(lightRing),
    // Charts: shades 200, 300, 400, 500, 600
    '--chart-1': oklchStr(shades[200]),
    '--chart-2': oklchStr(shades[300]),
    '--chart-3': oklchStr(shades[400]),
    '--chart-4': oklchStr(shades[500]),
    '--chart-5': oklchStr(shades[600]),
    // Sidebar
    '--sidebar': oklchStr(lightSidebar),
    '--sidebar-foreground': oklchStr(autoForeground(lightSidebar, hue)),
    '--sidebar-primary': oklchStr(lightPrimary),
    '--sidebar-primary-foreground': oklchStr(autoForeground(lightPrimary, hue)),
    '--sidebar-accent': oklchStr(lightAccent),
    '--sidebar-accent-foreground': oklchStr(autoForeground(lightAccent, hue)),
    '--sidebar-border': oklchStr(lightSidebarBorder),
    '--sidebar-ring': oklchStr(lightRing),
  };

  // ---- DARK MODE ----
  const darkBg = neutral(0.145, 0.005);
  const darkCard = neutral(0.170, 0.006);
  const darkPopover = neutral(0.170, 0.006);
  const darkMuted = neutral(0.220, 0.008);
  const darkBorder = neutral(0.265, 0.008);
  const darkInput = neutral(0.265, 0.008);
  const darkPrimary = shades[400];
  const darkSecondary = neutral(0.230, 0.01);
  const darkAccent = neutral(0.240, 0.01);
  const darkRing = shades[400];
  const darkSidebar = neutral(0.130, 0.005);
  const darkSidebarBorder = neutral(0.250, 0.008);

  const dark: Record<string, string> = {
    '--background': oklchStr(darkBg),
    '--foreground': oklchStr(autoForeground(darkBg, hue)),
    '--card': oklchStr(darkCard),
    '--card-foreground': oklchStr(autoForeground(darkCard, hue)),
    '--popover': oklchStr(darkPopover),
    '--popover-foreground': oklchStr(autoForeground(darkPopover, hue)),
    '--primary': oklchStr(darkPrimary),
    '--primary-foreground': oklchStr(autoForeground(darkPrimary, hue)),
    '--secondary': oklchStr(darkSecondary),
    '--secondary-foreground': oklchStr(autoForeground(darkSecondary, hue)),
    '--muted': oklchStr(darkMuted),
    '--muted-foreground': oklchStr(neutral(0.60, 0.01)),
    '--accent': oklchStr(darkAccent),
    '--accent-foreground': oklchStr(autoForeground(darkAccent, hue)),
    '--destructive': 'oklch(0.704 0.191 22.216)',
    '--border': oklchStr(darkBorder),
    '--input': oklchStr(darkInput),
    '--ring': oklchStr(darkRing),
    // Charts
    '--chart-1': oklchStr(shades[200]),
    '--chart-2': oklchStr(shades[300]),
    '--chart-3': oklchStr(shades[400]),
    '--chart-4': oklchStr(shades[500]),
    '--chart-5': oklchStr(shades[600]),
    // Sidebar
    '--sidebar': oklchStr(darkSidebar),
    '--sidebar-foreground': oklchStr(autoForeground(darkSidebar, hue)),
    '--sidebar-primary': oklchStr(darkPrimary),
    '--sidebar-primary-foreground': oklchStr(autoForeground(darkPrimary, hue)),
    '--sidebar-accent': oklchStr(darkAccent),
    '--sidebar-accent-foreground': oklchStr(autoForeground(darkAccent, hue)),
    '--sidebar-border': oklchStr(darkSidebarBorder),
    '--sidebar-ring': oklchStr(darkRing),
  };

  return { light, dark };
}

// ---------------------------------------------------------------------------
// Contrast checking (WCAG 2.x)
// ---------------------------------------------------------------------------

export interface ContrastResult {
  ratio: number;
  passesAA: boolean;
  passesAAA: boolean;
}

/**
 * Check contrast ratio between two colours (any CSS-parseable string).
 * Uses WCAG 2.x relative-luminance contrast.
 */
export function checkContrast(fg: string, bg: string): ContrastResult {
  const ratio = wcagContrast(fg, bg);
  return {
    ratio: Math.round(ratio * 100) / 100,
    passesAA: ratio >= 4.5,
    passesAAA: ratio >= 7,
  };
}

// ---------------------------------------------------------------------------
// Overrides merging
// ---------------------------------------------------------------------------

/**
 * Deep-merge user overrides on top of a generated theme.
 * Undefined / null overrides are a no-op.
 */
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

// ---------------------------------------------------------------------------
// CSS serialisation
// ---------------------------------------------------------------------------

/**
 * Convert a ThemeOutput into a CSS string with `:root` (light) and `.dark`
 * selectors. Optionally overrides `--radius`.
 */
export function themeToCSS(
  theme: ThemeOutput,
  radiusOverride?: string,
): string {
  const renderBlock = (tokens: Record<string, string>, extra?: string) => {
    const lines = Object.entries(tokens).map(
      ([key, value]) => `  ${key}: ${value};`,
    );
    if (extra) lines.push(`  ${extra}`);
    return lines.join('\n');
  };

  const rootExtra = radiusOverride ? `--radius: ${radiusOverride};` : undefined;

  return [
    `:root {`,
    renderBlock(theme.light, rootExtra),
    `}`,
    ``,
    `.dark {`,
    renderBlock(theme.dark),
    `}`,
  ].join('\n');
}
