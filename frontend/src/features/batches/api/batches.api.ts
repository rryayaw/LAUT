// Batch ledger access.
//
// Swap these bodies for `/v1/batches` calls when the endpoint exists. The
// `analysis` block is computed here only because the backend does not yet
// return it — see `src/placeholder/derive.ts`.

import type { Batch, BatchListItem, BatchSource, BatchStatus } from "@/types/domain";
import { batches } from "@/placeholder/mock-db";
import { batchContext } from "@/placeholder/lookups";
import { withAnalysis } from "@/placeholder/derive";

function expand(batch: Batch): BatchListItem {
  return { ...withAnalysis(batch, batches), ...batchContext(batch) };
}

export type BatchFilter = {
  siteId?: string;
  lineId?: string;
  status?: BatchStatus[];
  source?: BatchSource;
};

export async function listBatches(filter: BatchFilter = {}): Promise<BatchListItem[]> {
  return batches
    .filter((batch) => (filter.siteId ? batch.productionSiteId === filter.siteId : true))
    .filter((batch) => (filter.lineId ? batch.productionLineIds.includes(filter.lineId) : true))
    .filter((batch) => (filter.status ? filter.status.includes(batch.status) : true))
    .filter((batch) => (filter.source ? batch.source === filter.source : true))
    .map(expand);
}

export async function getBatch(batchId: string): Promise<BatchListItem | undefined> {
  const batch = batches.find((candidate) => candidate.id === batchId);
  return batch ? expand(batch) : undefined;
}

export type CreateBatchInput = {
  productionSiteId: string;
  productionLineIds: string[];
  species: string;
  productSpec: string;
  shift: string;
  supplier?: string;
  fishSizeCategory?: string;
  deliveryDelayMinutes?: number;
  rejectReason?: string;
  notes?: string;
  rawInputKg: number;
  sellableOutputKg?: number;
  normalByproductKg?: number;
  trimmingKg?: number;
  qualityRejectKg?: number;
  spoilageKg?: number;
};

function nextCode(): string {
  const highest = batches.reduce((max, batch) => {
    const value = Number(batch.code.replace("B-", ""));
    return Number.isFinite(value) && value > max ? value : max;
  }, 0);
  return `B-${highest + 1}`;
}

/**
 * Creates a record that is explicitly NOT trusted history yet. It enters as a
 * draft and only a human confirmation moves it forward (mastersheet guardrail 1).
 */
export async function createBatch(input: CreateBatchInput): Promise<BatchListItem> {
  const now = new Date();
  const batch: Batch = {
    id: `batch-${now.getTime()}`,
    code: nextCode(),
    productionSiteId: input.productionSiteId,
    productionLineIds: input.productionLineIds,
    species: input.species,
    productSpec: input.productSpec,
    status: "draft",
    source: "web",
    productionDate: now.toISOString().slice(0, 10),
    reportedAt: "Just now",
    shift: input.shift,
    supplier: input.supplier,
    fishSizeCategory: input.fishSizeCategory,
    deliveryDelayMinutes: input.deliveryDelayMinutes,
    rejectReason: input.rejectReason,
    notes: input.notes,
    quantities: {
      rawInputKg: input.rawInputKg,
      sellableOutputKg: input.sellableOutputKg,
      normalByproductKg: input.normalByproductKg,
      trimmingKg: input.trimmingKg,
      qualityRejectKg: input.qualityRejectKg,
      spoilageKg: input.spoilageKg
    },
    isDemo: false
  };

  batches.unshift(batch);
  return expand(batch);
}

/** Only confirmed records become trusted historical data. */
export async function confirmBatch(batchId: string): Promise<BatchListItem> {
  const batch = batches.find((candidate) => candidate.id === batchId);
  if (!batch) throw new Error(`Batch ${batchId} was not found.`);
  batch.status = "confirmed";
  return expand(batch);
}

export async function updateBatchQuantities(
  batchId: string,
  quantities: Partial<Batch["quantities"]>
): Promise<BatchListItem> {
  const batch = batches.find((candidate) => candidate.id === batchId);
  if (!batch) throw new Error(`Batch ${batchId} was not found.`);
  batch.quantities = { ...batch.quantities, ...quantities };
  return expand(batch);
}
