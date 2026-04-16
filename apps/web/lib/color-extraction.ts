'use client';

import { parse, converter, formatHex } from 'culori';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OklchPixel {
  l: number;
  c: number;
  h: number;
}

interface Cluster {
  centroid: OklchPixel;
  members: OklchPixel[];
}

// ---------------------------------------------------------------------------
// Colour-space helpers
// ---------------------------------------------------------------------------

const toOklch = converter('oklch');

/**
 * Convert an sRGB pixel (0-255 per channel) to OKLCH via culori.
 * Returns null for transparent pixels (alpha < 128).
 */
function rgbaToOklch(
  r: number,
  g: number,
  b: number,
  a: number,
): OklchPixel | null {
  if (a < 128) return null;

  const parsed = parse(`rgb(${r}, ${g}, ${b})`);
  if (!parsed) return null;

  const oklch = toOklch(parsed);
  return {
    l: oklch.l,
    c: oklch.c,
    h: oklch.h ?? 0,
  };
}

// ---------------------------------------------------------------------------
// K-means clustering in OKLCH space
// ---------------------------------------------------------------------------

/** Squared distance in OKLCH treating h as a circular dimension (0–360). */
function oklchDistSq(a: OklchPixel, b: OklchPixel): number {
  const dl = a.l - b.l;
  const dc = a.c - b.c;
  let dh = a.h - b.h;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  // Normalise hue to a comparable scale (360° → ~1.0 range)
  const dhNorm = dh / 360;
  return dl * dl + dc * dc + dhNorm * dhNorm;
}

/** Circular mean for hue angles (degrees). */
function circularMeanHue(hues: number[]): number {
  let sinSum = 0;
  let cosSum = 0;
  for (const h of hues) {
    const rad = (h * Math.PI) / 180;
    sinSum += Math.sin(rad);
    cosSum += Math.cos(rad);
  }
  let mean = (Math.atan2(sinSum, cosSum) * 180) / Math.PI;
  if (mean < 0) mean += 360;
  return mean;
}

function recomputeCentroid(members: OklchPixel[]): OklchPixel {
  if (members.length === 0) {
    return { l: 0.5, c: 0.1, h: 0 };
  }
  let lSum = 0;
  let cSum = 0;
  for (const m of members) {
    lSum += m.l;
    cSum += m.c;
  }
  return {
    l: lSum / members.length,
    c: cSum / members.length,
    h: circularMeanHue(members.map((m) => m.h)),
  };
}

function kMeans(pixels: OklchPixel[], k: number, maxIter = 10): Cluster[] {
  // Seed centroids by picking evenly-spaced samples from the pixel array
  const step = Math.max(1, Math.floor(pixels.length / k));
  const centroids: OklchPixel[] = [];
  for (let i = 0; i < k; i++) {
    centroids.push({ ...pixels[Math.min(i * step, pixels.length - 1)] });
  }

  let clusters: Cluster[] = centroids.map((c) => ({ centroid: c, members: [] }));

  for (let iter = 0; iter < maxIter; iter++) {
    // Reset members
    for (const cl of clusters) cl.members = [];

    // Assign each pixel to closest centroid
    for (const px of pixels) {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let ci = 0; ci < clusters.length; ci++) {
        const d = oklchDistSq(px, clusters[ci].centroid);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = ci;
        }
      }
      clusters[bestIdx].members.push(px);
    }

    // Remove empty clusters
    clusters = clusters.filter((cl) => cl.members.length > 0);

    // Recompute centroids
    for (const cl of clusters) {
      cl.centroid = recomputeCentroid(cl.members);
    }
  }

  return clusters;
}

// ---------------------------------------------------------------------------
// Image loading helpers
// ---------------------------------------------------------------------------

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

/**
 * Down-sample the image to a max dimension so we don't process millions of
 * pixels. Returns raw RGBA pixel data.
 */
function getPixelData(
  img: HTMLImageElement,
  maxDim = 100,
): { data: Uint8ClampedArray; width: number; height: number } {
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot create canvas 2d context');

  ctx.drawImage(img, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);

  return { data: imageData.data, width, height };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract the dominant colour from an image URL.
 *
 * Strategy:
 * 1. Load the image into an offscreen canvas (down-sampled to ≤100px).
 * 2. Convert every non-transparent pixel to OKLCH.
 * 3. Run k-means (k = 5) clustering in OKLCH space.
 * 4. Filter out near-white (L > 0.9), near-black (L < 0.1), and low-chroma
 *    (C < 0.02) clusters.
 * 5. Return the largest remaining cluster's centroid as a hex string.
 * 6. If all clusters are filtered, fall back to the largest unfiltered cluster.
 *
 * @returns hex colour string, e.g. "#e63946"
 */
export async function extractDominantColor(imageUrl: string): Promise<string> {
  const img = await loadImage(imageUrl);
  const { data, width, height } = getPixelData(img);

  // Convert RGBA pixels to OKLCH, skipping transparent ones
  const pixels: OklchPixel[] = [];
  const totalPixels = width * height;
  for (let i = 0; i < totalPixels; i++) {
    const offset = i * 4;
    const oklch = rgbaToOklch(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
    if (oklch) pixels.push(oklch);
  }

  if (pixels.length === 0) {
    // Fully transparent image — return a sensible default
    return '#6366f1';
  }

  // Run simplified k-means with k = 5
  const clusters = kMeans(pixels, 5);

  // Sort by cluster size descending (largest first)
  clusters.sort((a, b) => b.members.length - a.members.length);

  // Filter out undesirable clusters
  const viable = clusters.filter((cl) => {
    const { l, c } = cl.centroid;
    if (l > 0.9) return false; // near-white
    if (l < 0.1) return false; // near-black
    if (c < 0.02) return false; // achromatic / low-chroma
    return true;
  });

  // Pick the largest viable cluster, or fall back to the largest overall
  const chosen = viable.length > 0 ? viable[0] : clusters[0];

  const hex = formatHex({ mode: 'oklch', ...chosen.centroid });
  return hex ?? '#6366f1';
}
