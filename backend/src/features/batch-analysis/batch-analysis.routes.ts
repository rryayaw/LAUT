import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { getAuthenticatedUser, requireAuthenticatedUser } from "../auth/auth.middleware.js";
import { runProductionAnalysis, type AnalysisEvidence } from "./production-analysis.graph.js";

type Row = Record<string, unknown>;
const idSchema = z.string().uuid();

class ApiError extends Error { constructor(public readonly status: number, message: string) { super(message); } }
function database() { if (!prisma) throw new ApiError(503, "Database access is not configured."); return prisma; }
function id(value: unknown) { const parsed = idSchema.safeParse(value); if (!parsed.success) throw new ApiError(400, "Batch ID is invalid."); return parsed.data; }
function numberValue(value: unknown) { const result = Number(value); return Number.isFinite(result) ? result : null; }
function textValue(value: unknown) { return typeof value === "string" && value.trim() ? value : null; }
function dateValue(value: unknown) { return value instanceof Date ? value.toISOString().slice(0, 10) : textValue(value); }
function route(handler: (request: Request, response: Response) => Promise<void>) { return (request: Request, response: Response) => void handler(request, response).catch((error: unknown) => sendError(response, error)); }
function sendError(response: Response, error: unknown) {
  if (error instanceof ApiError) return response.status(error.status).json({ error: error.message });
  console.error("Batch analysis request failed.", error);
  return response.status(500).json({ error: "An unexpected error occurred." });
}

async function ownedConfirmedBatch(userId: string, batchId: string): Promise<Row> {
  const rows = await database().$queryRawUnsafe<Row[]>(
    `select batch.* from public.production_batch as batch
     join public.manufacturing_sites as site on site.id = batch.manufacturing_site_id
     where batch.id = $1::uuid and batch.status = 'confirmed' and site.owner_id = $2::uuid limit 1`, batchId, userId);
  if (!rows[0]) throw new ApiError(404, "Confirmed production batch was not found.");
  return rows[0];
}

export const batchAnalysisRouter = Router();
batchAnalysisRouter.use(requireAuthenticatedUser);
batchAnalysisRouter.post("/v1/production-batches/:batchId/analysis", route(async (request, response) => {
  const user = getAuthenticatedUser(response);
  const batchId = id(request.params.batchId);
  const batch = await ownedConfirmedBatch(user.id, batchId);
  const rawInputKg = numberValue(batch.raw_input_kg);
  const sellableOutputKg = numberValue(batch.sellable_output_kg);
  const lossKeys = ["trimming_kg", "quality_reject_kg", "byproduct_kg", "spoilage_kg", "other_loss_kg"];
  const losses = lossKeys.map((key) => numberValue(batch[key]));
  if (rawInputKg === null || rawInputKg <= 0 || sellableOutputKg === null || losses.some((value) => value === null)) {
    throw new ApiError(422, "Confirmed batch measurements are incomplete for analysis.");
  }
  const confirmedRawInputKg = rawInputKg as number;
  const confirmedSellableOutputKg = sellableOutputKg as number;
  const knownLossKg = losses.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  const lossBreakdownKg = Object.fromEntries(lossKeys.map((key, index) => [key, losses[index] ?? 0]));
  const productionLines = await database().$queryRawUnsafe<Row[]>(
    `select line.name, line.description, link.sequence,
      coalesce(jsonb_agg(jsonb_build_object(
        'label', tag.label,
        'description', tag.description,
        'otherContext', line_tag.other_context
      ) order by tag.label) filter (where tag.id is not null), '[]'::jsonb) as capability_tags
     from public.production_batch_lines as link
     join public.production_lines as line on line.id = link.production_line_id
     left join public.production_line_capability_tags as line_tag on line_tag.production_line_id = line.id
     left join public.capability_tags as tag on tag.id = line_tag.capability_tag_id
     where link.production_batch_id = $1::uuid
     group by line.id, link.sequence
     order by link.sequence asc nulls last, line.name asc`, batchId);
  const comparables = await database().$queryRawUnsafe<Row[]>(
    `with subject_lines as (select production_line_id from public.production_batch_lines where production_batch_id = $1::uuid),
      subject_tags as (select distinct tag.capability_tag_id from public.production_batch_lines as link join public.production_line_capability_tags as tag on tag.production_line_id = link.production_line_id where link.production_batch_id = $1::uuid)
     select candidate.raw_input_kg, candidate.sellable_output_kg, candidate.trimming_kg,
       candidate.quality_reject_kg, candidate.byproduct_kg, candidate.spoilage_kg, candidate.other_loss_kg,
       candidate.production_date, candidate.shift, candidate.receiving_condition, candidate.receiving_temperature_c,
       candidate.delivery_delay_minutes, candidate.production_duration_minutes,
       (select count(*)::int from public.production_batch_lines as link join subject_lines on subject_lines.production_line_id = link.production_line_id where link.production_batch_id = candidate.id) as shared_line_count,
       (select count(distinct tag.capability_tag_id)::int from public.production_batch_lines as link join public.production_line_capability_tags as tag on tag.production_line_id = link.production_line_id join subject_tags on subject_tags.capability_tag_id = tag.capability_tag_id where link.production_batch_id = candidate.id) as shared_capability_tag_count
     from public.production_batch as candidate
     where candidate.status = 'confirmed' and candidate.id <> $1::uuid and candidate.manufacturing_site_id = $2::uuid
       and candidate.species = $3 and candidate.product_specification = $4
       and ($5::text is null or candidate.fish_size_category is not distinct from $5::text)
       and ($6::text is null or candidate.storage_state is not distinct from $6::text)
       and (exists (select 1 from public.production_batch_lines as link join subject_lines on subject_lines.production_line_id = link.production_line_id where link.production_batch_id = candidate.id)
         or exists (select 1 from public.production_batch_lines as link join public.production_line_capability_tags as tag on tag.production_line_id = link.production_line_id join subject_tags on subject_tags.capability_tag_id = tag.capability_tag_id where link.production_batch_id = candidate.id))
     limit 100`, batchId, batch.manufacturing_site_id, batch.species, batch.product_specification, batch.fish_size_category ?? null, batch.storage_state ?? null);
  const comparableBatches = comparables.map((row) => {
    const input = numberValue(row.raw_input_kg); const output = numberValue(row.sellable_output_kg);
    if (!input || output === null) return null;
    const comparableLosses = lossKeys.map((key) => numberValue(row[key]) ?? 0);
    return {
      sellableYieldPercent: (output / input) * 100,
      knownLossPercent: (comparableLosses.reduce((sum, value) => sum + value, 0) / input) * 100,
      lossBreakdownKg: Object.fromEntries(lossKeys.map((key, index) => [key, comparableLosses[index]])),
      productionDate: dateValue(row.production_date),
      shift: textValue(row.shift),
      receivingCondition: textValue(row.receiving_condition),
      receivingTemperatureC: numberValue(row.receiving_temperature_c),
      deliveryDelayMinutes: numberValue(row.delivery_delay_minutes),
      productionDurationMinutes: numberValue(row.production_duration_minutes),
      sharedLineCount: numberValue(row.shared_line_count) ?? 0,
      sharedCapabilityTagCount: numberValue(row.shared_capability_tag_count) ?? 0
    };
  }).filter((value): value is NonNullable<typeof value> => value !== null);
  const comparableYields = comparableBatches.map((batch) => batch.sellableYieldPercent);
  const evidence: AnalysisEvidence = {
    batchId, rawInputKg: confirmedRawInputKg, sellableOutputKg: confirmedSellableOutputKg, sellableYieldPercent: (confirmedSellableOutputKg / confirmedRawInputKg) * 100,
    knownLossPercent: (knownLossKg / confirmedRawInputKg) * 100,
    massBalanceDifferenceKg: confirmedRawInputKg - confirmedSellableOutputKg - knownLossKg,
    comparableYields, comparableCount: comparableYields.length,
    sharedContext: ["same manufacturing site", "same species", "same product specification", "shared production-line or capability context"],
    batchContext: {
      batchReference: textValue(batch.batch_reference),
      productionDate: dateValue(batch.production_date),
      species: textValue(batch.species),
      productSpecification: textValue(batch.product_specification),
      lossBreakdownKg,
      supplier: textValue(batch.supplier),
      shift: textValue(batch.shift),
      fishSizeCategory: textValue(batch.fish_size_category),
      storageState: textValue(batch.storage_state),
      receivingCondition: textValue(batch.receiving_condition),
      receivingTemperatureC: numberValue(batch.receiving_temperature_c),
      deliveryDelayMinutes: numberValue(batch.delivery_delay_minutes),
      productionDurationMinutes: numberValue(batch.production_duration_minutes),
      operatorNotes: textValue(batch.operator_notes)
    },
    productionLines: productionLines.map((line) => ({
      name: textValue(line.name) ?? "Unnamed production line",
      description: textValue(line.description),
      sequence: numberValue(line.sequence),
      capabilityTags: Array.isArray(line.capability_tags) ? line.capability_tags.map((tag) => ({
        label: textValue(tag?.label) ?? "Unnamed capability",
        description: textValue(tag?.description),
        otherContext: textValue(tag?.otherContext)
      })) : []
    })),
    comparableBatches: comparableBatches.slice(0, 20)
  };
  response.status(200).json({ analysis: await runProductionAnalysis(evidence) });
}));
