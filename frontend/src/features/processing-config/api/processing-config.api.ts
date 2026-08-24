// Processing configuration: what LAUT treats as comparable, how loss is
// categorised, and the measurement tolerance it applies.
//
// Fish products are declared per production site. The loss taxonomy is not
// configurable: it is the fixed set of mass-balance columns the API accepts.

import type { LossCategoryConfig, ProcessTag, ProductConfig } from "@/types/domain";
import { listProcessTags as listCapabilityTags } from "@/features/production-sites/api/production-sites.api";
import { apiRequest, toNumber } from "@/api/client";
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

type ProductConfigRow = {
  id: string;
  manufacturing_site_id: string;
  species: string;
  product_specification: string;
  site_name: string;
  observed_median_yield_pct: number | string;
  sample_size: number | string;
};

/** One row per fish product declared for a production site. */
export async function listProductConfigs(): Promise<ProductConfigListItem[]> {
  const { productConfigs } = await apiRequest<{ productConfigs: ProductConfigRow[] }>("/v1/product-configs");
  return productConfigs.map((config) => ({
    id: config.id,
    productionSiteId: config.manufacturing_site_id,
    species: config.species,
    productSpec: config.product_specification,
    chilledOrFrozen: /frozen/i.test(config.product_specification) ? "frozen" : "chilled",
    observedMedianYieldPct: Math.round((toNumber(config.observed_median_yield_pct) ?? 0) * 10) / 10,
    sampleSize: toNumber(config.sample_size) ?? 0,
    massBalanceTolerancePct: DEFAULT_TOLERANCE_PCT,
    siteName: config.site_name
  }));
}

export async function addSiteProductConfig(siteId: string, input: { species: string; productSpecification: string }): Promise<void> {
  await apiRequest(`/v1/manufacturing-sites/${siteId}/product-configs`, { method: "POST", body: input });
}

export async function listLossCategories(): Promise<LossCategoryConfig[]> {
  return LOSS_CATEGORIES;
}

export async function listProcessTags(): Promise<ProcessTag[]> {
  return listCapabilityTags();
}
