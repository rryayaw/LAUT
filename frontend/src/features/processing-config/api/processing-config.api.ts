// Processing configuration: species, product spec, loss taxonomy, tolerance.
// Swap for `/v1/processing-config` when the endpoint exists.

import type { LossCategoryConfig, ProcessTag, ProductConfig } from "@/types/domain";
import { lossCategories, productConfigs, productionSites } from "@/placeholder/mock-db";
import { processTagCatalogue } from "@/placeholder/process-tags";

export type ProductConfigListItem = ProductConfig & { siteName: string };

export async function listProductConfigs(): Promise<ProductConfigListItem[]> {
  return productConfigs.map((config) => ({
    ...config,
    siteName: productionSites.find((site) => site.id === config.productionSiteId)?.name ?? "Unknown site"
  }));
}

export async function listLossCategories(): Promise<LossCategoryConfig[]> {
  return structuredClone(lossCategories);
}

export async function listProcessTags(): Promise<ProcessTag[]> {
  return structuredClone(processTagCatalogue);
}

export type CreateProductConfigInput = {
  productionSiteId: string;
  species: string;
  productSpec: string;
  chilledOrFrozen: ProductConfig["chilledOrFrozen"];
  expectedYieldPct: number;
  massBalanceTolerancePct: number;
};

export async function createProductConfig(input: CreateProductConfigInput): Promise<ProductConfigListItem> {
  const config: ProductConfig = { id: `cfg-${productConfigs.length + 1}`, ...input };
  productConfigs.push(config);
  return {
    ...config,
    siteName: productionSites.find((site) => site.id === config.productionSiteId)?.name ?? "Unknown site"
  };
}
