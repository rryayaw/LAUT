// Analysis aggregates.
//
// Group comparison and conditional statistics only (mastersheet §8F). Everything
// is computed from confirmed batches; nothing here is authored by an LLM.
// Replace with `/v1/analysis/overview` when the endpoint exists.

import type { BatchListItem, BatchStatus } from "@/types/domain";
import { listBatches } from "@/features/batches/api/batches.api";
import type {
  AnalysisDimension,
  AnalysisOverview,
  DistributionBin,
  GroupComparison,
  LossTrendRow,
  TrendPoint
} from "../types/analysis.types";

const TRUSTED: BatchStatus[] = ["confirmed", "analyzed", "closed"];

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
  return round(value);
}

function metricValues(batches: BatchListItem[], pick: (batch: BatchListItem) => number | undefined): number[] {
  return batches.map(pick).filter((value): value is number => value !== undefined);
}

function compareGroups(
  batches: BatchListItem[],
  keyOf: (batch: BatchListItem) => string | undefined
): GroupComparison[] {
  const groups = new Map<string, BatchListItem[]>();

  for (const batch of batches) {
    const key = keyOf(batch);
    if (key === undefined) continue;
    groups.set(key, [...(groups.get(key) ?? []), batch]);
  }

  return [...groups.entries()]
    .map(([group, groupBatches]) => ({
      group,
      batches: groupBatches.length,
      medianYieldPct: median(metricValues(groupBatches, (batch) => batch.analysis.metrics.sellableYieldPct)),
      rejectPct: median(metricValues(groupBatches, (batch) => batch.analysis.metrics.rejectPct)),
      trimmingPct: median(metricValues(groupBatches, (batch) => batch.analysis.metrics.trimmingPct)),
      delayedShare: round(
        (groupBatches.filter((batch) => (batch.deliveryDelayMinutes ?? 0) >= 90).length / groupBatches.length) * 100
      )
    }))
    .sort((a, b) => a.medianYieldPct - b.medianYieldPct);
}

function buildDistribution(batches: BatchListItem[], focus: BatchListItem | undefined): DistributionBin[] {
  const yields = metricValues(batches, (batch) => batch.analysis.metrics.sellableYieldPct);
  if (yields.length === 0) return [];

  const focusYield = focus?.analysis.metrics.sellableYieldPct;
  const lowest = Math.floor(Math.min(...yields));
  const highest = Math.ceil(Math.max(...yields));
  const binCount = Math.max(4, Math.min(8, highest - lowest));
  const width = (highest - lowest) / binCount;

  return Array.from({ length: binCount }, (_unused, index) => {
    const lowerPct = round(lowest + index * width);
    const upperPct = round(lowerPct + width);
    const isLast = index === binCount - 1;

    const inBin = (value: number) => (isLast ? value >= lowerPct && value <= upperPct : value >= lowerPct && value < upperPct);

    return {
      rangeLabel: `${lowerPct}–${upperPct}%`,
      lowerPct,
      count: yields.filter(inBin).length,
      containsFocus: focusYield !== undefined && inBin(focusYield)
    } satisfies DistributionBin;
  });
}

/** Groups batches by production date so a date never appears twice on an axis. */
function groupByDate(batches: BatchListItem[]): Array<[string, BatchListItem[]]> {
  const byDate = new Map<string, BatchListItem[]>();
  for (const batch of batches) {
    byDate.set(batch.productionDate, [...(byDate.get(batch.productionDate) ?? []), batch]);
  }
  return [...byDate.entries()].sort(([left], [right]) => left.localeCompare(right));
}

function buildLossTrend(batches: BatchListItem[]): LossTrendRow[] {
  return groupByDate(batches)
    .slice(-8)
    .map(([date, group]) => ({
      label: date.slice(5),
      trimmingPct: median(metricValues(group, (batch) => batch.analysis.metrics.trimmingPct)),
      rejectPct: median(metricValues(group, (batch) => batch.analysis.metrics.rejectPct)),
      spoilagePct: median(metricValues(group, (batch) => batch.analysis.metrics.spoilagePct)),
      batchCount: group.length
    }));
}

function buildYieldTrend(batches: BatchListItem[]): TrendPoint[] {
  return groupByDate(batches.filter((batch) => batch.analysis.metrics.sellableYieldPct !== undefined))
    .slice(-12)
    .map(([date, group]) => ({
      label: date.slice(5),
      yieldPct: median(metricValues(group, (batch) => batch.analysis.metrics.sellableYieldPct)),
      baselinePct: median(group.map((batch) => batch.analysis.baseline?.medianYieldPct ?? 0)),
      batchCount: group.length
    }));
}

export async function getAnalysisOverview(siteId?: string): Promise<AnalysisOverview> {
  const all = await listBatches(siteId ? { siteId } : {});
  const trusted = all.filter((batch) => TRUSTED.includes(batch.status));

  const focusBatch =
    all.find((batch) => batch.analysis.anomaly?.severity === "abnormal") ??
    all.find((batch) => batch.analysis.anomaly?.severity === "watch");

  const comparisons: Record<AnalysisDimension, GroupComparison[]> = {
    line: compareGroups(trusted, (batch) => batch.lineNames[0]),
    supplier: compareGroups(trusted, (batch) => batch.supplier),
    shift: compareGroups(trusted, (batch) => batch.shift),
    fishSize: compareGroups(trusted, (batch) => batch.fishSizeCategory)
  };

  return {
    period: "Last 14 production days",
    trustedBatchCount: trusted.length,
    species: trusted[0]?.species ?? "Red snapper",
    productSpec: trusted[0]?.productSpec ?? "Skinless chilled fillet",
    yieldTrend: buildYieldTrend(trusted),
    distribution: buildDistribution(trusted, focusBatch),
    lossTrend: buildLossTrend(trusted),
    comparisons,
    focusBatch
  };
}
