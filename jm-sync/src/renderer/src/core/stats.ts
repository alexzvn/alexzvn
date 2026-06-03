// Robust statistics over a set of offset measurements. Pure functions, no DOM —
// unit-testable in isolation (see tools/engine-selftest.ts).

import type { MeasurementStats } from '@shared/types';

export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Median absolute deviation — a robust spread measure (resistant to outliers). */
export function mad(values: number[], center = median(values)): number {
  if (values.length === 0) return NaN;
  return median(values.map((v) => Math.abs(v - center)));
}

/**
 * Computes robust stats over raw offsets, rejecting outliers beyond
 * `rejectK` scaled MADs from the median. Falls back gracefully for tiny n.
 */
export function computeStats(offsets: number[], rejectK = 3.5): MeasurementStats | null {
  if (offsets.length === 0) return null;

  const med = median(offsets);
  const spread = mad(offsets, med);

  // 1.4826 makes MAD a consistent estimator of the std-dev for normal data.
  const tol = spread > 0 ? rejectK * spread * 1.4826 : Infinity;
  const kept = offsets.filter((v) => Math.abs(v - med) <= tol);
  const used = kept.length >= 3 ? kept : offsets;

  const finalMed = median(used);
  return {
    count: used.length,
    medianMs: finalMed,
    madMs: mad(used, finalMed),
    minMs: Math.min(...used),
    maxMs: Math.max(...used),
  };
}
