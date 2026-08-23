import { prisma } from "../../db/prisma.js";
import { runProductionAnalysis, type AnalysisEvidence } from "./production-analysis.graph.js";

type Row = Record<string, unknown>;
export class BatchAnalysisError extends Error { constructor(public readonly status: number, message: string) { super(message); } }

function database() { if (!prisma) throw new BatchAnalysisError(503, "Database access is not configured."); return prisma; }
function numberValue(value: unknown) { const result = Number(value); return Number.isFinite(result) ? result : null; }
function textValue(value: unknown) { return typeof value === "string" && value.trim() ? value : null; }
function dateValue(value: unknown) { return value instanceof Date ? value.toISOString().slice(0, 10) : textValue(value); }

async function ownedConfirmedBatch(userId: string, batchId: string): Promise<Row> {
  const rows = await database().$queryRawUnsafe<Row[]>(
    `select batch.* from public.production_batch as batch
     join public.manufacturing_sites as site on site.id = batch.manufacturing_site_id
     where batch.id = $1::uuid and batch.status = 'confirmed' and site.owner_id = $2::uuid limit 1`, batchId, userId);
  if (!rows[0]) throw new BatchAnalysisError(404, "Confirmed production batch was not found.");
  return rows[0];
}

export async function buildAnalysisEvidence(userId: string, batchId: string): Promise<AnalysisEvidence> {
  const batch = await ownedConfirmedBatch(userId, batchId);
  const rawInputKg = numberValue(batch.raw_input_kg);
  const sellableOutputKg = numberValue(batch.sellable_output_kg);
  const lossKeys = ["trimming_kg", "quality_reject_kg", "byproduct_kg", "spoilage_kg", "other_loss_kg"];
  const losses = lossKeys.map((key) => numberValue(batch[key]));
  if (rawInputKg === null || rawInputKg <= 0 || sellableOutputKg === null || losses.some((value) => value === null)) {
    throw new BatchAnalysisError(422, "Confirmed batch measurements are incomplete for analysis.");
  }
  const knownLossKg = losses.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  const lossBreakdownKg = Object.fromEntries(lossKeys.map((key, index) => [key, losses[index] ?? 0]));
  const productionLines = await database().$queryRawUnsafe<Row[]>(
    `select line.name, line.description, link.sequence,
      coalesce(jsonb_agg(jsonb_build_object('label', tag.label, 'description', tag.description, 'otherContext', line_tag.other_context) order by tag.label) filter (where tag.id is not null), '[]'::jsonb) as capability_tags
     from public.production_batch_lines as link join public.production_lines as line on line.id = link.production_line_id
     left join public.production_line_capability_tags as line_tag on line_tag.production_line_id = line.id
     left join public.capability_tags as tag on tag.id = line_tag.capability_tag_id
     where link.production_batch_id = $1::uuid group by line.id, link.sequence order by link.sequence asc nulls last, line.name asc`, batchId);
  const comparables = await database().$queryRawUnsafe<Row[]>(
    `with subject_lines as (select production_line_id from public.production_batch_lines where production_batch_id = $1::uuid),
      subject_tags as (select distinct tag.capability_tag_id from public.production_batch_lines as link join public.production_line_capability_tags as tag on tag.production_line_id = link.production_line_id where link.production_batch_id = $1::uuid)
     select candidate.raw_input_kg, candidate.sellable_output_kg, candidate.trimming_kg, candidate.quality_reject_kg, candidate.byproduct_kg, candidate.spoilage_kg, candidate.other_loss_kg, candidate.production_date, candidate.shift, candidate.receiving_condition, candidate.receiving_temperature_c, candidate.delivery_delay_minutes, candidate.production_duration_minutes,
       (select count(*)::int from public.production_batch_lines as link join subject_lines on subject_lines.production_line_id = link.production_line_id where link.production_batch_id = candidate.id) as shared_line_count,
       (select count(distinct tag.capability_tag_id)::int from public.production_batch_lines as link join public.production_line_capability_tags as tag on tag.production_line_id = link.production_line_id join subject_tags on subject_tags.capability_tag_id = tag.capability_tag_id where link.production_batch_id = candidate.id) as shared_capability_tag_count
     from public.production_batch as candidate where candidate.status = 'confirmed' and candidate.id <> $1::uuid and candidate.manufacturing_site_id = $2::uuid and candidate.species = $3 and candidate.product_specification = $4
       and ($5::text is null or candidate.fish_size_category is not distinct from $5::text) and ($6::text is null or candidate.storage_state is not distinct from $6::text)
       and (exists (select 1 from public.production_batch_lines as link join subject_lines on subject_lines.production_line_id = link.production_line_id where link.production_batch_id = candidate.id) or exists (select 1 from public.production_batch_lines as link join public.production_line_capability_tags as tag on tag.production_line_id = link.production_line_id join subject_tags on subject_tags.capability_tag_id = tag.capability_tag_id where link.production_batch_id = candidate.id)) limit 100`,
    batchId, batch.manufacturing_site_id, batch.species, batch.product_specification, batch.fish_size_category ?? null, batch.storage_state ?? null);
  const comparableBatches = comparables.map((row) => {
    const input = numberValue(row.raw_input_kg); const output = numberValue(row.sellable_output_kg);
    if (!input || output === null) return null;
    const comparableLosses = lossKeys.map((key) => numberValue(row[key]) ?? 0);
    return { sellableYieldPercent: (output / input) * 100, knownLossPercent: (comparableLosses.reduce((sum, value) => sum + value, 0) / input) * 100, lossBreakdownKg: Object.fromEntries(lossKeys.map((key, index) => [key, comparableLosses[index]])), productionDate: dateValue(row.production_date), shift: textValue(row.shift), receivingCondition: textValue(row.receiving_condition), receivingTemperatureC: numberValue(row.receiving_temperature_c), deliveryDelayMinutes: numberValue(row.delivery_delay_minutes), productionDurationMinutes: numberValue(row.production_duration_minutes), sharedLineCount: numberValue(row.shared_line_count) ?? 0, sharedCapabilityTagCount: numberValue(row.shared_capability_tag_count) ?? 0 };
  }).filter((value): value is NonNullable<typeof value> => value !== null);
  const comparableYields = comparableBatches.map((candidate) => candidate.sellableYieldPercent);
  return {
    batchId, rawInputKg, sellableOutputKg, sellableYieldPercent: (sellableOutputKg / rawInputKg) * 100, knownLossPercent: (knownLossKg / rawInputKg) * 100, massBalanceDifferenceKg: rawInputKg - sellableOutputKg - knownLossKg,
    comparableYields, comparableCount: comparableYields.length, sharedContext: ["same manufacturing site", "same species", "same product specification", "shared production-line or capability context"],
    batchContext: { batchReference: textValue(batch.batch_reference), productionDate: dateValue(batch.production_date), species: textValue(batch.species), productSpecification: textValue(batch.product_specification), lossBreakdownKg, supplier: textValue(batch.supplier), shift: textValue(batch.shift), fishSizeCategory: textValue(batch.fish_size_category), storageState: textValue(batch.storage_state), receivingCondition: textValue(batch.receiving_condition), receivingTemperatureC: numberValue(batch.receiving_temperature_c), deliveryDelayMinutes: numberValue(batch.delivery_delay_minutes), productionDurationMinutes: numberValue(batch.production_duration_minutes), operatorNotes: textValue(batch.operator_notes) },
    productionLines: productionLines.map((line) => ({ name: textValue(line.name) ?? "Unnamed production line", description: textValue(line.description), sequence: numberValue(line.sequence), capabilityTags: Array.isArray(line.capability_tags) ? line.capability_tags.map((tag) => ({ label: textValue(tag?.label) ?? "Unnamed capability", description: textValue(tag?.description), otherContext: textValue(tag?.otherContext) })) : [] })),
    comparableBatches: comparableBatches.slice(0, 20)
  };
}

export type SavedBatchAnalysis = Awaited<ReturnType<typeof runProductionAnalysis>> & {
  batchId: string;
  evidence: AnalysisEvidence;
  createdAt?: string;
};

export async function getSavedBatchAnalysis(userId: string, batchId: string): Promise<SavedBatchAnalysis | null> {
  await ownedConfirmedBatch(userId, batchId);
  const rows = await database().$queryRawUnsafe<Row[]>(`select assessment, guidance, evidence, ai_status, created_at from public.production_batch_analyses where production_batch_id = $1::uuid limit 1`, batchId);
  const row = rows[0];
  if (!row || !row.assessment || typeof row.assessment !== "object" || !row.evidence || typeof row.evidence !== "object") return null;
  return { batchId, assessment: row.assessment as SavedBatchAnalysis["assessment"], guidance: row.guidance as SavedBatchAnalysis["guidance"], evidence: row.evidence as AnalysisEvidence, aiStatus: row.ai_status as SavedBatchAnalysis["aiStatus"], createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : undefined };
}

export async function analyzeAndSaveBatch(userId: string, batchId: string): Promise<SavedBatchAnalysis> {
  const saved = await getSavedBatchAnalysis(userId, batchId);
  if (saved) return saved;
  const evidence = await buildAnalysisEvidence(userId, batchId);
  const analysis = await runProductionAnalysis(evidence);
  await database().$executeRawUnsafe(
    `insert into public.production_batch_analyses (production_batch_id, assessment, guidance, evidence, ai_status) values ($1::uuid, $2::jsonb, $3::jsonb, $4::jsonb, $5) on conflict (production_batch_id) do nothing`,
    batchId, JSON.stringify(analysis.assessment), analysis.guidance ? JSON.stringify(analysis.guidance) : null, JSON.stringify(evidence), analysis.aiStatus
  );
  return (await getSavedBatchAnalysis(userId, batchId)) ?? { batchId, evidence, ...analysis };
}

export function formatWhatsAppAnalysisSummary(analysis: SavedBatchAnalysis): string {
  const assessment = analysis.assessment;
  const status: Record<string, string> = {
    insufficient_history: "Belum cukup riwayat pembanding",
    within_baseline: "Sesuai baseline",
    below_baseline: "Di bawah baseline",
    above_baseline: "Di atas baseline"
  };
  const lines = [
    "*Analisis awal*",
    "",
    `• Yield: ${analysis.evidence?.sellableYieldPercent?.toFixed?.(2) ?? "-"}%`,
    `• Batch pembanding: ${analysis.evidence?.comparableCount ?? "-"}`,
    `• Status: ${status[assessment.status] ?? assessment.status}`
  ];
  if (assessment.comparableAverageYieldPercent !== null) {
    lines.push(`• Rata-rata pembanding: ${assessment.comparableAverageYieldPercent.toFixed(2)}%`);
  }
  if (assessment.yieldDifferencePercentagePoints !== null) {
    lines.push(`• Selisih: ${assessment.yieldDifferencePercentagePoints.toFixed(2)} poin`);
  }
  if (analysis.guidance?.summary) lines.push("", analysis.guidance.summary);
  lines.push("", "_Ini perbandingan data, bukan bukti sebab-akibat._");
  return lines.join("\n");
}
