// Batch ledger access.
//
// Backed by `/v1/production-batches`. The list endpoint provides each batch's
// measured values and linked lines in one response, so pages never trigger a
// request per batch when a test account has a large history.

import type { Batch, BatchListItem, BatchSource, BatchStatus, ProductionSite } from "@/types/domain";
import { ApiError, apiRequest, toDateOnly, toIsoTimestamp, toNumber, toRequiredNumber, toText } from "@/api/client";
import { cached, invalidateCache } from "@/api/cache";
import { listProcessTags, listProductionSites } from "@/features/production-sites/api/production-sites.api";
import { withAnalysis } from "../utils/batch-metrics";

type DetailRow = {
  batch: Record<string, unknown>;
  production_lines: Array<{ id: string; name: string; description: string | null; isActive: boolean }>;
};

type SummaryRow = DetailRow & { has_analysis: boolean };

function toStatus(value: unknown): BatchStatus {
  // The backend persists `draft` and `confirmed` only; anything else it adds later
  // already matches a lifecycle state this type declares.
  const text = toText(value) ?? "draft";
  const known: BatchStatus[] = ["draft", "needs_confirmation", "confirmed", "analyzed", "closed", "canceled"];
  return known.includes(text as BatchStatus) ? (text as BatchStatus) : "draft";
}

function toSource(value: unknown): BatchSource {
  const text = toText(value);
  return text === "whatsapp" || text === "import" || text === "iot" ? text : "web";
}

/** "3 days ago" style label from a timestamp, for the ledger's reported column. */
function relativeLabel(value: unknown): string {
  const text = toText(value);
  if (!text) return "Unknown";
  const at = new Date(text);
  if (Number.isNaN(at.getTime())) return "Unknown";

  const minutes = Math.round((Date.now() - at.getTime()) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "Yesterday" : `${days} days ago`;
}

function toBatch(row: DetailRow): Batch {
  const batch = row.batch;
  const id = String(batch.id);

  return {
    id,
    code: toText(batch.batch_reference) ?? `B-${id.slice(0, 6)}`,
    productionSiteId: String(batch.manufacturing_site_id),
    productionLineIds: row.production_lines.map((line) => line.id),
    species: toText(batch.species) ?? "Unspecified species",
    productSpec: toText(batch.product_specification) ?? "Unspecified specification",
    status: toStatus(batch.status),
    source: toSource(batch.source_channel),
    productionDate: toDateOnly(batch.production_date) ?? toDateOnly(batch.created_at) ?? "",
    createdAt: toIsoTimestamp(batch.created_at) ?? "",
    reportedAt: relativeLabel(batch.created_at),
    shift: toText(batch.shift) ?? "Unspecified shift",
    supplier: toText(batch.supplier),
    fishSizeCategory: toText(batch.fish_size_category),
    deliveryDelayMinutes: toNumber(batch.delivery_delay_minutes),
    receivingTempC: toNumber(batch.receiving_temperature_c),
    rejectReason: toText(batch.receiving_condition),
    notes: toText(batch.operator_notes),
    quantities: {
      rawInputKg: toRequiredNumber(batch.raw_input_kg),
      sellableOutputKg: toNumber(batch.sellable_output_kg),
      normalByproductKg: toNumber(batch.byproduct_kg),
      trimmingKg: toNumber(batch.trimming_kg),
      qualityRejectKg: toNumber(batch.quality_reject_kg),
      spoilageKg: toNumber(batch.spoilage_kg),
      otherLossKg: toNumber(batch.other_loss_kg)
    },
    isDemo: false,
    hasSavedAnalysis: "has_analysis" in row ? row.has_analysis === true : undefined
  };
}

async function fetchAllBatches(): Promise<Batch[]> {
  const { productionBatches } = await apiRequest<{ productionBatches: SummaryRow[] }>("/v1/production-batches");
  return productionBatches.map(toBatch);
}

/** Resolves site, line, and tag names the way a list endpoint eventually will. */
function buildContext(sites: ProductionSite[], tagLabelByCode: Map<string, string>) {
  const siteNames = new Map(sites.map((site) => [site.id, site.name]));
  const lines = new Map(sites.flatMap((site) => site.lines).map((line) => [line.id, line]));

  return (batch: Batch) => ({
    siteName: siteNames.get(batch.productionSiteId) ?? "Unknown site",
    lineNames: batch.productionLineIds.map((lineId) => lines.get(lineId)?.name ?? "Unknown line"),
    tagLabels: [...new Set(batch.productionLineIds.flatMap((lineId) => lines.get(lineId)?.tagCodes ?? []))].map(
      (code) => tagLabelByCode.get(code) ?? code
    )
  });
}

/**
 * Every batch with its context and derived analysis. Views filter this rather than
 * issuing one query per filter, because the baseline for any batch depends on the
 * whole trusted set.
 */
async function loadLedger(): Promise<BatchListItem[]> {
  return cached("batches", async () => {
    const [batches, sites, tags] = await Promise.all([fetchAllBatches(), listProductionSites(), listProcessTags()]);
    const context = buildContext(sites, new Map(tags.map((tag) => [tag.code, tag.label])));
    return batches.map((batch) => ({ ...withAnalysis(batch, batches), ...context(batch) }));
  });
}

export type BatchFilter = {
  siteId?: string;
  lineId?: string;
  status?: BatchStatus[];
  source?: BatchSource;
};

export async function listBatches(filter: BatchFilter = {}): Promise<BatchListItem[]> {
  const ledger = await loadLedger();
  return ledger
    .filter((batch) => (filter.siteId ? batch.productionSiteId === filter.siteId : true))
    .filter((batch) => (filter.lineId ? batch.productionLineIds.includes(filter.lineId) : true))
    .filter((batch) => (filter.status ? filter.status.includes(batch.status) : true))
    .filter((batch) => (filter.source ? batch.source === filter.source : true));
}

export async function getBatch(batchId: string): Promise<BatchListItem | undefined> {
  const ledger = await loadLedger();
  return ledger.find((batch) => batch.id === batchId);
}

/**
 * A rejected confirmation comes back as a generic "not ready to confirm". The
 * backend does say exactly what is missing or inconsistent, in the validation body,
 * so that is what the operator is shown.
 */
function withConfirmationReasons(error: ApiError): ApiError {
  const detail = error.detail;
  if (typeof detail !== "object" || detail === null || !("validation" in detail)) return error;

  const validation = (detail as { validation?: { errors?: string[]; warnings?: string[] } }).validation;
  const reasons = [...(validation?.errors ?? []), ...(validation?.warnings ?? [])];
  if (reasons.length === 0) return error;

  return new ApiError(`${error.message} ${reasons.join(" ")}`, error.status, detail);
}

/** Re-reads the ledger so a freshly written batch carries context and a baseline. */
async function decorate(batch: Batch): Promise<BatchListItem> {
  const ledger = await loadLedger();
  return (
    ledger.find((candidate) => candidate.id === batch.id) ?? {
      ...withAnalysis(batch, []),
      siteName: "Unknown site",
      lineNames: [],
      tagLabels: []
    }
  );
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
  /**
   * The backend will not let a batch be confirmed while any mass field is unreported,
   * so this is collected as 0 rather than left blank when there is no other loss.
   */
  otherLossKg?: number;
};

export type BatchTextExtraction = {
  language: "id" | "en" | "unknown";
  tone: "casual" | "neutral" | "formal" | "unknown";
  fields: {
    manufacturingSiteName?: string;
    productionLineNames?: string[];
    species?: string;
    productSpecification?: string;
    rawInputKg?: number;
    sellableOutputKg?: number;
    trimmingKg?: number;
    qualityRejectKg?: number;
    byproductKg?: number;
    spoilageKg?: number;
    otherLossKg?: number;
    shift?: string;
    supplier?: string;
    fishSizeCategory?: string;
    deliveryDelayMinutes?: number;
    receivingCondition?: string;
    operatorNotes?: string;
  };
  ambiguities: string[];
};

/** Extracts only facts explicitly stated in an informal batch description. */
export async function extractBatchText(message: string): Promise<BatchTextExtraction> {
  const { extraction } = await apiRequest<{ extraction: BatchTextExtraction }>("/v1/production-batches/extract", {
    method: "POST",
    body: { message }
  });
  return extraction;
}

/**
 * Creates a record that is explicitly NOT trusted history yet. The backend enters
 * it as a draft and only a human confirmation moves it forward (mastersheet
 * guardrail 1).
 */
export async function createBatch(input: CreateBatchInput): Promise<BatchListItem> {
  const { productionBatch } = await apiRequest<{ productionBatch: DetailRow }>("/v1/production-batches", {
    method: "POST",
    body: {
      manufacturingSiteId: input.productionSiteId,
      productionLineIds: input.productionLineIds,
      sourceChannel: "web",
      species: input.species,
      productSpecification: input.productSpec,
      shift: input.shift,
      supplier: input.supplier,
      fishSizeCategory: input.fishSizeCategory,
      deliveryDelayMinutes: input.deliveryDelayMinutes,
      receivingCondition: input.rejectReason,
      operatorNotes: input.notes,
      rawInputKg: input.rawInputKg,
      sellableOutputKg: input.sellableOutputKg,
      byproductKg: input.normalByproductKg,
      trimmingKg: input.trimmingKg,
      qualityRejectKg: input.qualityRejectKg,
      spoilageKg: input.spoilageKg,
      otherLossKg: input.otherLossKg
    }
  });

  invalidateCache("batches");
  return decorate(toBatch(productionBatch));
}

const QUANTITY_COLUMNS: Array<[keyof Batch["quantities"], string]> = [
  ["rawInputKg", "rawInputKg"],
  ["sellableOutputKg", "sellableOutputKg"],
  ["normalByproductKg", "byproductKg"],
  ["trimmingKg", "trimmingKg"],
  ["qualityRejectKg", "qualityRejectKg"],
  ["spoilageKg", "spoilageKg"],
  ["otherLossKg", "otherLossKg"]
];

/**
 * Drafts only — the backend rejects a change to a confirmed record.
 *
 * A key the caller did not mention is left alone. A key it mentioned as
 * `undefined` is sent as an explicit `null`, because clearing a weight back to
 * "not measured" is a real correction and `JSON.stringify` would otherwise drop it
 * and silently do nothing.
 */
export async function updateBatchQuantities(
  batchId: string,
  quantities: Partial<Batch["quantities"]>
): Promise<BatchListItem> {
  const body: Record<string, number | null> = {};
  for (const [field, column] of QUANTITY_COLUMNS) {
    if (Object.hasOwn(quantities, field)) body[column] = quantities[field] ?? null;
  }

  const { productionBatch } = await apiRequest<{ productionBatch: DetailRow }>(`/v1/production-batches/${batchId}`, {
    method: "PATCH",
    body
  });

  invalidateCache("batches");
  return decorate(toBatch(productionBatch));
}

/**
 * Only confirmed records become trusted historical data. Confirmation is also what
 * makes a batch eligible for analysis, so the analysis run is started here — and
 * allowed to fail, because the batch is confirmed whether or not guidance generates.
 */
export async function confirmBatch(batchId: string): Promise<BatchListItem> {
  const { productionBatch } = await apiRequest<{ productionBatch: DetailRow }>(
    `/v1/production-batches/${batchId}/confirm`,
    { method: "POST" }
  ).catch((cause: unknown) => {
    throw cause instanceof ApiError ? withConfirmationReasons(cause) : cause;
  });

  await apiRequest(`/v1/production-batches/${batchId}/analysis`, { method: "POST" }).catch(() => undefined);

  invalidateCache();
  return decorate(toBatch(productionBatch));
}
