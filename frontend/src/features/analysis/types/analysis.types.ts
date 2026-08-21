import type { BatchListItem } from "@/types/domain";

export type TrendPoint = {
  /** Production date, unique per point. */
  label: string;
  yieldPct: number;
  baselinePct: number;
  batchCount: number;
};

/**
 * Group comparison from mastersheet §8F. Deliberately descriptive: it reports what
 * co-occurs, never that a group caused anything.
 */
export type GroupComparison = {
  group: string;
  batches: number;
  medianYieldPct: number;
  rejectPct: number;
  trimmingPct: number;
  delayedShare: number;
};

export type DistributionBin = {
  rangeLabel: string;
  lowerPct: number;
  count: number;
  containsFocus: boolean;
};

export type LossTrendRow = {
  /** Production date, unique per row. */
  label: string;
  trimmingPct: number;
  rejectPct: number;
  spoilagePct: number;
  batchCount: number;
};

export type AnalysisDimension = "line" | "supplier" | "shift" | "fishSize";

export type AnalysisOverview = {
  period: string;
  trustedBatchCount: number;
  species: string;
  productSpec: string;
  yieldTrend: TrendPoint[];
  distribution: DistributionBin[];
  lossTrend: LossTrendRow[];
  comparisons: Record<AnalysisDimension, GroupComparison[]>;
  focusBatch?: BatchListItem;
};
