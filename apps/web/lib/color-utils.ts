interface OklchColor {
  l: number;
  c: number;
  h: number;
}

/**
 * Convert hex color to oklch approximation.
 * Uses sRGB -> linear RGB -> OKLab -> OKLCH conversion.
 */
export function hexToOklch(hex: string): OklchColor {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  // sRGB to linear
  const toLinear = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);

  // Linear RGB to OKLab
  const l_ = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m_ = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s_ = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  const l_cbrt = Math.cbrt(l_);
  const m_cbrt = Math.cbrt(m_);
  const s_cbrt = Math.cbrt(s_);

  const L = 0.2104542553 * l_cbrt + 0.793617785 * m_cbrt - 0.0040720468 * s_cbrt;
  const a = 1.9779984951 * l_cbrt - 2.428592205 * m_cbrt + 0.4505937099 * s_cbrt;
  const bOk = 0.0259040371 * l_cbrt + 0.7827717662 * m_cbrt - 0.808675766 * s_cbrt;

  // OKLab to OKLCH
  const C = Math.sqrt(a * a + bOk * bOk);
  let H = (Math.atan2(bOk, a) * 180) / Math.PI;
  if (H < 0) H += 360;

  return { l: L, c: C, h: H };
}

export function oklchToString(color: OklchColor): string {
  return `oklch(${color.l.toFixed(3)} ${color.c.toFixed(3)} ${color.h.toFixed(1)})`;
}

export interface DerivedColorScale {
  light: string;
  dark: string;
  lightForeground: string;
  darkForeground: string;
}

/**
 * Given a hex base color, derive light and dark mode oklch variants
 * plus appropriate foreground colors.
 */
export function deriveColorScale(hex: string): DerivedColorScale {
  const base = hexToOklch(hex);

  const lightColor = { ...base, l: Math.min(base.l, 0.55) };
  const darkColor = { ...base, l: Math.max(base.l, 0.70) };

  return {
    light: oklchToString(lightColor),
    dark: oklchToString(darkColor),
    lightForeground: 'oklch(0.98 0.01 0)',
    darkForeground: 'oklch(0.20 0.02 0)',
  };
}
