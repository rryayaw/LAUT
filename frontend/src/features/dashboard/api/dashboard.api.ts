// Dashboard overview.
//
// Every figure below is derived from the shared dataset rather than typed in, so
// the dashboard stays consistent with the batch ledger as data changes. Replace
// with a single `/v1/dashboard/overview` call once it exists.

import type { BatchListItem, BatchStatus } from "@/types/domain";
import { lossCategories, productionSites } from "@/placeholder/mock-db";
import { listBatches } from "@/features/batches/api/batches.api";
import { listInvestigations } from "@/features/investigations/api/investigations.api";
import type {
  DashboardOverview,
  LossSlice,
  ProductionSiteSignal,
  YieldPoint
} from "../types/dashboard.types";

const TRUSTED: BatchStatus[] = ["confirmed", "analyzed", "closed"];

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
  return Math.round(value * 10) / 10;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * One point per production date. Several batches can run on the same day, so they
 * are aggregated to the daily median rather than plotted as repeated x-values.
 */
function buildYieldTrend(batches: BatchListItem[]): YieldPoint[] {
  const byDate = new Map<string, BatchListItem[]>();

  for (const batch of batches) {
    if (batch.analysis.metrics.sellableYieldPct === undefined) continue;
    byDate.set(batch.productionDate, [...(byDate.get(batch.productionDate) ?? []), batch]);
  }

  return [...byDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-8)
    .map(([date, group]) => ({
      label: date.slice(5),
      yieldPct: median(group.map((batch) => batch.analysis.metrics.sellableYieldPct ?? 0)),
      baselinePct: median(group.map((batch) => batch.analysis.baseline?.medianYieldPct ?? 0)),
      batchCount: group.length
    }));
}

function buildLossDistribution(batch: BatchListItem | undefined): LossSlice[] {
  if (!batch) return [];
  const { quantities, analysis } = batch;
  const input = quantities.rawInputKg;

  const rows: Array<{ code: string; kg: number | undefined }> = [
    { code: "sellable", kg: quantities.sellableOutputKg },
    { code: "byproduct", kg: quantities.normalByproductKg },
    { code: "trimming", kg: quantities.trimmingKg },
    { code: "reject", kg: quantities.qualityRejectKg },
    { code: "spoilage", kg: quantities.spoilageKg },
    { code: "other", kg: quantities.otherLossKg }
  ];

  const slices = rows
    .filter((row): row is { code: string; kg: number } => row.kg !== undefined && row.kg > 0)
    .map((row) => {
      const category = lossCategories.find((candidate) => candidate.code === row.code);
      return {
        name: category?.label ?? row.code,
        kg: row.kg,
        pct: round((row.kg / input) * 100),
        tone: category?.tone ?? "normal"
      } satisfies LossSlice;
    });

  if (analysis.metrics.unexplainedKg > 0) {
    slices.push({
      name: "Unexplained",
      kg: analysis.metrics.unexplainedKg,
      pct: round((analysis.metrics.unexplainedKg / input) * 100),
      tone: "warning"
    });
  }

  return slices;
}

function buildSiteSignals(batches: BatchListItem[]): ProductionSiteSignal[] {
  return productionSites.map((site) => {
    const siteBatches = batches.filter(
      (batch) => batch.productionSiteId === site.id && TRUSTED.includes(batch.status)
    );

    const yields = siteBatches
      .map((batch) => batch.analysis.metrics.sellableYieldPct)
      .filter((value): value is number => value !== undefined);

    const rejects = siteBatches
      .map((batch) => batch.analysis.metrics.rejectPct)
      .filter((value): value is number => value !== undefined);

    const delayedBatches = siteBatches.filter((batch) => (batch.deliveryDelayMinutes ?? 0) >= 90);
    const delayRate = siteBatches.length > 0 ? round((delayedBatches.length / siteBatches.length) * 100) : 0;

    const delayedSuppliers = new Set(
      delayedBatches.map((batch) => batch.supplier).filter((value): value is string => value !== undefined)
    );

    let note: string;
    if (delayedBatches.length === 0) {
      note = "No delivery delays above 90 minutes recorded in this period.";
    } else if (delayedSuppliers.size === 1) {
      const supplier = [...delayedSuppliers][0];
      note = `${delayedBatches.length} of ${siteBatches.length} trusted batches arrived over 90 minutes late, all from ${supplier}.`;
    } else {
      note = `${delayedBatches.length} of ${siteBatches.length} trusted batches arrived over 90 minutes late.`;
    }

    return {
      productionSite: site.name,
      batches: siteBatches.length,
      medianYield: median(yields),
      rejectRate: median(rejects),
      delayRate,
      note
    } satisfies ProductionSiteSignal;
  });
}

export async function getDashboardOverview(): Promise<DashboardOverview> {
  const [batches, investigations] = await Promise.all([listBatches(), listInvestigations()]);

  const trusted = batches.filter((batch) => TRUSTED.includes(batch.status));
  const totalInput = trusted.reduce((sum, batch) => sum + batch.quantities.rawInputKg, 0);

  const yields = trusted
    .map((batch) => batch.analysis.metrics.sellableYieldPct)
    .filter((value): value is number => value !== undefined);

  // Only a genuine discrepancy counts. A draft that has not reported its by-product
  // yet is an incomplete report, not missing mass, and is surfaced separately.
  const unexplained = round(
    trusted
      .filter((batch) => batch.analysis.metrics.massBalance === "unexplained")
      .reduce((sum, batch) => sum + Math.max(0, batch.analysis.metrics.unexplainedKg), 0)
  );
  const awaitingConfirmation = batches.filter(
    (batch) => batch.status === "draft" || batch.status === "needs_confirmation"
  ).length;

  // Analysis only applies to confirmed records, so the review panel never promotes
  // an unconfirmed draft.
  const priorityBatch =
    trusted.find((batch) => batch.analysis.anomaly?.severity === "abnormal") ??
    trusted.find((batch) => batch.analysis.anomaly?.severity === "watch");

  const openInvestigations = investigations.filter(
    (investigation) => investigation.status !== "resolved" && investigation.status !== "dismissed"
  );

  const medianYield = median(yields);
  const expected = priorityBatch?.analysis.baseline?.medianYieldPct ?? medianYield;
  const yieldDelta = round(medianYield - expected);

  return {
    facilityName: productionSites[0]?.name ?? "Production site",
    location: productionSites[0]?.location ?? "",
    activeProcess: "Red snapper to chilled fillet",
    period: "Last 14 production days",
    updatedAt: "19 Aug 2026, 09:42",
    metrics: [
      {
        label: "Confirmed input",
        value: `${totalInput.toLocaleString("en-US")} kg`,
        delta: `${trusted.length} batches`,
        helper: "Across trusted historical records"
      },
      {
        label: "Median fillet yield",
        value: `${medianYield}%`,
        delta: `${yieldDelta >= 0 ? "+" : ""}${yieldDelta} pp`,
        helper: "Against the comparable median"
      },
      {
        label: "Unexplained mass",
        value: `${unexplained} kg`,
        delta: `${awaitingConfirmation} awaiting confirmation`,
        helper: "Across confirmed records only"
      },
      {
        label: "Open investigations",
        value: String(openInvestigations.length),
        delta: `${openInvestigations.filter((item) => item.status === "suggested").length} suggested`,
        helper: "Awaiting a human decision"
      }
    ],
    yieldTrend: buildYieldTrend(trusted),
    priorityBatch,
    lossDistribution: buildLossDistribution(priorityBatch),
    comparableCount: priorityBatch?.analysis.baseline?.sampleSize ?? 0,
    recentBatches: batches.slice(0, 6),
    investigations: openInvestigations,
    productionSiteSignals: buildSiteSignals(batches)
  };
}
