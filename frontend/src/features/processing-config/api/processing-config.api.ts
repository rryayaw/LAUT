// Processing configuration: what LAUT treats as comparable, how loss is
// categorised, and the measurement tolerance it applies.
//
// The backend has no configuration table yet, so the comparison basis is observed
// from confirmed batches rather than declared. The loss taxonomy is not observed —
// it is the fixed set of mass-balance columns the API accepts, so it is stated here
// as a contract rather than fetched.

import type { LossCategoryConfig, ProcessTag, ProductConfig } from "@/types/domain";
import { listBatches } from "@/features/batches/api/batches.api";
import { listProcessTags as listCapabilityTags } from "@/features/production-sites/api/production-sites.api";
import { DEFAULT_TOLERANCE_PCT } from "@/features/batches/utils/batch-metrics";

export type ProductConfigListItem = ProductConfig & { siteName: string };

/** Mirrors the mass-balance columns on `production_batch`. */
const LOSS_CATEGORIES: LossCategoryConfig[] = [
  {
    code: "sellable",
    label: "Sellable output",
    description: "Product that meets the specification and can be sold. The numerator of sellable yield.",
    tone: "sellable",
    countsAsLoss: false
  },
  {
    code: "byproduct",
    label: "Normal by-product",
    description: "Heads, frames, and skin separated by design. Expected output of the process, not a loss.",
    tone: "normal",
    countsAsLoss: false
  },
  {
    code: "trimming",
    label: "Trimming",
    description: "Material removed to reach the required shape or specification.",
    tone: "normal",
    countsAsLoss: true
  },
  {
    code: "reject",
    label: "Quality reject",
    description: "Product that failed the quality standard and cannot be sold as specified.",
    tone: "warning",
    countsAsLoss: true
  },
  {
    code: "spoilage",
    label: "Spoilage",
    description: "Material lost to deterioration before or during processing.",
    tone: "warning",
    countsAsLoss: true
  },
  {
    code: "other",
    label: "Other loss",
    description: "Recorded loss that does not fit the categories above.",
    tone: "muted",
    countsAsLoss: true
  }
];

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
  return Math.round(value * 10) / 10;
}

/**
 * One row per species and specification the site has actually confirmed batches
 * for. Only trusted records contribute, so a draft cannot introduce a comparison
 * basis that no one has reviewed.
 */
export async function listProductConfigs(): Promise<ProductConfigListItem[]> {
  const batches = await listBatches({ status: ["confirmed", "analyzed", "closed"] });
  const groups = new Map<string, typeof batches>();

  for (const batch of batches) {
    const key = `${batch.productionSiteId}|${batch.species}|${batch.productSpec}`;
    groups.set(key, [...(groups.get(key) ?? []), batch]);
  }

  return [...groups.entries()]
    .map(([key, group]) => {
      const first = group[0];
      const yields = group
        .map((batch) => batch.analysis.metrics.sellableYieldPct)
        .filter((value): value is number => value !== undefined);

      return {
        id: key,
        productionSiteId: first.productionSiteId,
        species: first.species,
        productSpec: first.productSpec,
        // `storage_state` is the only field describing how product is held.
        chilledOrFrozen: /frozen/i.test(first.productSpec) ? "frozen" : "chilled",
        observedMedianYieldPct: yields.length > 0 ? median(yields) : 0,
        sampleSize: group.length,
        massBalanceTolerancePct: DEFAULT_TOLERANCE_PCT,
        siteName: first.siteName
      } satisfies ProductConfigListItem;
    })
    .sort((left, right) => left.species.localeCompare(right.species) || left.productSpec.localeCompare(right.productSpec));
}

export async function listLossCategories(): Promise<LossCategoryConfig[]> {
  return LOSS_CATEGORIES;
}

export async function listProcessTags(): Promise<ProcessTag[]> {
  return listCapabilityTags();
}
