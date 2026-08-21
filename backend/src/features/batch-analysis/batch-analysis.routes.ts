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
  const comparables = await database().$queryRawUnsafe<Row[]>(
    `with subject_lines as (select production_line_id from public.production_batch_lines where production_batch_id = $1::uuid),
      subject_tags as (select distinct tag.capability_tag_id from public.production_batch_lines as link join public.production_line_capability_tags as tag on tag.production_line_id = link.production_line_id where link.production_batch_id = $1::uuid)
     select candidate.raw_input_kg, candidate.sellable_output_kg,
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
  const comparableYields = comparables.map((row) => {
    const input = numberValue(row.raw_input_kg); const output = numberValue(row.sellable_output_kg);
    return input && output !== null ? (output / input) * 100 : null;
  }).filter((value): value is number => value !== null);
  const evidence: AnalysisEvidence = {
    batchId, rawInputKg: confirmedRawInputKg, sellableOutputKg: confirmedSellableOutputKg, sellableYieldPercent: (confirmedSellableOutputKg / confirmedRawInputKg) * 100,
    knownLossPercent: (knownLossKg / confirmedRawInputKg) * 100,
    massBalanceDifferenceKg: confirmedRawInputKg - confirmedSellableOutputKg - knownLossKg,
    comparableYields, comparableCount: comparableYields.length,
    sharedContext: ["same manufacturing site", "same species", "same product specification", "shared production-line or capability context"]
  };
  response.status(200).json({ analysis: await runProductionAnalysis(evidence) });
}));
