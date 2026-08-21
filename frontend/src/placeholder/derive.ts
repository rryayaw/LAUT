// Deterministic batch calculations.
//
// TEMPORARY. The backend owns this logic (mastersheet §7 and §8B) — it lives here
// only so the frontend has something to render before the API exists. When
// `/v1/batches` returns a computed `analysis` object, delete this file; no
// component reads it directly.
//
// No LLM is involved in anything below, and none ever should be.

import type {
  AnalyzedBatch,
  AnomalySeverity,
  Batch,
  BatchAnalysis,
  BatchAnomaly,
  BatchMetrics,
  ComparableBaseline,
  MassBalanceStatus
} from "@/types/domain";

/** Operator-configured tolerance; never inferred. Mirrors ProductConfig. */
const DEFAULT_TOLERANCE_PCT = 1.5;

function ratio(part: number | undefined, whole: number): number | undefined {
  if (part === undefined || whole <= 0) return undefined;
  return round(part / whole * 100);
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

export function calculateMetrics(batch: Batch, tolerancePct = DEFAULT_TOLERANCE_PCT): BatchMetrics {
  const q = batch.quantities;
  const input = q.rawInputKg;

  const parts = [
    q.sellableOutputKg,
    q.normalByproductKg,
    q.trimmingKg,
    q.qualityRejectKg,
    q.spoilageKg,
    q.otherLossKg
  ];

  const accountedKg = round(parts.reduce<number>((total, part) => total + (part ?? 0), 0));
  const unexplainedKg = round(input - accountedKg);

  const hasEveryOutput = q.sellableOutputKg !== undefined && q.normalByproductKg !== undefined;
  const toleranceKg = input * (tolerancePct / 100);

  let massBalance: MassBalanceStatus;
  if (!hasEveryOutput) {
    massBalance = "incomplete";
  } else if (Math.abs(unexplainedKg) <= toleranceKg) {
    massBalance = "balanced";
  } else {
    massBalance = "unexplained";
  }

  return {
    sellableYieldPct: ratio(q.sellableOutputKg, input),
    trimmingPct: ratio(q.trimmingKg, input),
    rejectPct: ratio(q.qualityRejectKg, input),
    spoilagePct: ratio(q.spoilageKg, input),
    byproductPct: ratio(q.normalByproductKg, input),
    accountedKg,
    unexplainedKg,
    massBalance
  };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

/**
 * Compare like with like (mastersheet §2.4): same species, same product spec, and
 * only batches whose data is trusted. Unrelated products are never pooled to
 * inflate the sample.
 */
export function findComparables(batch: Batch, all: Batch[]): Batch[] {
  const trusted: Batch["status"][] = ["confirmed", "analyzed", "closed"];

  return all.filter(
    (candidate) =>
      candidate.id !== batch.id &&
      trusted.includes(candidate.status) &&
      candidate.species === batch.species &&
      candidate.productSpec === batch.productSpec &&
      candidate.quantities.sellableOutputKg !== undefined
  );
}

export function buildBaseline(batch: Batch, all: Batch[]): ComparableBaseline | undefined {
  const comparables = findComparables(batch, all);
  if (comparables.length < 3) return undefined;

  const yields = comparables
    .map((candidate) => calculateMetrics(candidate).sellableYieldPct)
    .filter((value): value is number => value !== undefined);

  if (yields.length < 3) return undefined;

  const sharesLine = comparables.some((candidate) =>
    candidate.productionLineIds.some((lineId) => batch.productionLineIds.includes(lineId))
  );

  return {
    medianYieldPct: round(median(yields)),
    sampleSize: yields.length,
    batchCodes: comparables.slice(0, 12).map((candidate) => candidate.code),
    limitation: sharesLine
      ? undefined
      : "No comparable batch shares a production line with this batch; treat the median as indicative only."
  };
}

/**
 * Placeholder stand-in for the Isolation Forest / robust Z-score pair described in
 * mastersheet §8E. Deliberately simple and explainable — it exists to give the UI
 * realistic severities, not to be the shipped model.
 */
export function detectAnomaly(
  metrics: BatchMetrics,
  baseline: ComparableBaseline | undefined
): BatchAnomaly | undefined {
  if (!baseline || metrics.sellableYieldPct === undefined) return undefined;

  // Mastersheet §7: a batch does not receive operational analysis while major
  // quantities remain unexplained. An incomplete report is a reporting gap, not
  // a production signal, and must not be presented as one.
  if (metrics.massBalance !== "balanced") return undefined;

  const drivers: string[] = [];
  const yieldGap = metrics.sellableYieldPct - baseline.medianYieldPct;

  if (yieldGap <= -3) drivers.push(`Sellable yield ${round(Math.abs(yieldGap))} pp below comparable median`);
  else if (yieldGap <= -1.5) drivers.push(`Sellable yield ${round(Math.abs(yieldGap))} pp under comparable median`);

  if ((metrics.rejectPct ?? 0) >= 3) drivers.push(`Quality reject at ${metrics.rejectPct}% of input`);
  if ((metrics.trimmingPct ?? 0) >= 9) drivers.push(`Trimming at ${metrics.trimmingPct}% of input`);
  if ((metrics.spoilagePct ?? 0) >= 1.5) drivers.push(`Spoilage at ${metrics.spoilagePct}% of input`);

  let severity: AnomalySeverity = "normal";
  if (yieldGap <= -3 || drivers.length >= 3) severity = "abnormal";
  else if (drivers.length >= 1) severity = "watch";

  const score = Math.min(1, Math.max(0, Math.abs(Math.min(yieldGap, 0)) / 6 + drivers.length * 0.12));

  return { severity, score: Math.round(score * 100) / 100, drivers };
}

export function analyzeBatch(batch: Batch, all: Batch[]): BatchAnalysis {
  const metrics = calculateMetrics(batch);
  const baseline = buildBaseline(batch, all);
  const anomaly = detectAnomaly(metrics, baseline);
  return { metrics, baseline, anomaly };
}

export function withAnalysis(batch: Batch, all: Batch[]): AnalyzedBatch {
  return { ...batch, analysis: analyzeBatch(batch, all) };
}
