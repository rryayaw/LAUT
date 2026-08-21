import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { getAuthenticatedUser, requireAuthenticatedUser } from "../auth/auth.middleware.js";
import { assertUserOwnsManufacturingSite } from "../processing-config/site-access.service.js";

type DatabaseRow = Record<string, unknown>;

const idSchema = z.string().uuid();
const dateSchema = z.string().date();
const optionalText = z.string().trim().min(1).max(2_000).optional().nullable();
const optionalMass = z.coerce.number().finite().min(0).max(10_000_000).optional().nullable();
const optionalWholeNumber = z.coerce.number().int().min(0).max(1_000_000).optional().nullable();
const optionalTemperature = z.coerce.number().finite().min(-100).max(100).optional().nullable();

const productionLineIdsSchema = z
  .array(idSchema)
  .min(1)
  .max(50)
  .refine((ids) => new Set(ids).size === ids.length, "Production line IDs must be unique.");

const batchFieldsSchema = z.object({
  batchReference: optionalText,
  productionDate: dateSchema.optional(),
  species: optionalText,
  productSpecification: optionalText,
  rawInputKg: optionalMass,
  sellableOutputKg: optionalMass,
  trimmingKg: optionalMass,
  qualityRejectKg: optionalMass,
  byproductKg: optionalMass,
  spoilageKg: optionalMass,
  otherLossKg: optionalMass,
  supplier: optionalText,
  shift: optionalText,
  fishSizeCategory: optionalText,
  storageState: optionalText,
  receivingCondition: optionalText,
  receivingTemperatureC: optionalTemperature,
  deliveryDelayMinutes: optionalWholeNumber,
  productionDurationMinutes: optionalWholeNumber,
  operatorNotes: optionalText
});

const createBatchSchema = batchFieldsSchema.extend({
  manufacturingSiteId: idSchema,
  productionLineIds: productionLineIdsSchema,
  sourceChannel: z.enum(["web", "whatsapp"]).default("web")
});
const updateBatchSchema = batchFieldsSchema.extend({ productionLineIds: productionLineIdsSchema.optional() });

class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

function requirePrisma() {
  if (!prisma) throw new ApiError(503, "Database access is not configured.");
  return prisma;
}

function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ApiError(400, "Request data is invalid.");
  return result.data;
}

function parseId(value: unknown): string {
  return parseOrThrow(idSchema, value);
}

function nullable(value: string | number | null | undefined): string | number | null {
  return value ?? null;
}

function sendError(response: Response, error: unknown): void {
  if (error instanceof ApiError) {
    response.status(error.status).json({ error: error.message });
    return;
  }

  const code = typeof error === "object" && error && "code" in error ? (error as { code?: string }).code : undefined;
  if (code === "23505") {
    response.status(409).json({ error: "A record with that value already exists." });
    return;
  }
  if (code === "23503" || code === "23514") {
    response.status(400).json({ error: "The batch data conflicts with the current configuration." });
    return;
  }
  console.error("Batch reporting request failed.", error);
  response.status(500).json({ error: "An unexpected error occurred." });
}

function route(handler: (request: Request, response: Response) => Promise<void>) {
  return (request: Request, response: Response): void => {
    void handler(request, response).catch((error: unknown) => sendError(response, error));
  };
}

async function assertUserOwnsBatch(userId: string, batchId: string): Promise<DatabaseRow> {
  const rows = await requirePrisma().$queryRawUnsafe<DatabaseRow[]>(
    `select batch.id, batch.manufacturing_site_id
     from public.production_batch as batch
     join public.manufacturing_sites as site on site.id = batch.manufacturing_site_id
     where batch.id = $1::uuid and site.owner_id = $2::uuid
     limit 1`,
    batchId,
    userId
  );
  if (!rows[0]) throw new ApiError(404, "Production batch was not found.");
  return rows[0];
}

async function assertLinesBelongToSite(manufacturingSiteId: string, productionLineIds: string[]): Promise<void> {
  const rows = await requirePrisma().$queryRawUnsafe<{ line_count: number }[]>(
    `select count(*)::int as line_count
     from public.production_lines
     where manufacturing_site_id = $1::uuid
       and id = any($2::uuid[])`,
    manufacturingSiteId,
    productionLineIds
  );
  if (rows[0]?.line_count !== productionLineIds.length) {
    throw new ApiError(400, "Every production line must belong to the batch's manufacturing site.");
  }
}

async function getBatchDetail(batchId: string): Promise<DatabaseRow> {
  const rows = await requirePrisma().$queryRawUnsafe<DatabaseRow[]>(
    `select
       to_jsonb(batch) as batch,
       coalesce(
         jsonb_agg(
           jsonb_build_object('id', line.id, 'name', line.name, 'description', line.description, 'isActive', line.is_active)
           order by line.name
         ) filter (where line.id is not null),
         '[]'::jsonb
       ) as production_lines
     from public.production_batch as batch
     left join public.production_batch_lines as link on link.production_batch_id = batch.id
     left join public.production_lines as line on line.id = link.production_line_id
     where batch.id = $1::uuid
     group by batch.id`,
    batchId
  );
  if (!rows[0]) throw new ApiError(404, "Production batch was not found.");
  return rows[0];
}

function readMass(row: DatabaseRow, key: string): number | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function validateBatch(row: DatabaseRow, linkedLineCount: number) {
  const rawInputKg = readMass(row, "raw_input_kg");
  const sellableOutputKg = readMass(row, "sellable_output_kg");
  const lossFields = ["trimming_kg", "quality_reject_kg", "byproduct_kg", "spoilage_kg", "other_loss_kg"] as const;
  const losses = Object.fromEntries(lossFields.map((field) => [field, readMass(row, field)]));
  const allMassFields = [rawInputKg, sellableOutputKg, ...Object.values(losses)];
  const missingMassFields = [
    ...(rawInputKg === null ? ["rawInputKg"] : []),
    ...(sellableOutputKg === null ? ["sellableOutputKg"] : []),
    ...lossFields.filter((field) => losses[field] === null)
  ];
  const accountedMassKg = allMassFields.every((value) => value !== null)
    ? allMassFields.slice(1).reduce<number>((total, value) => total + (value ?? 0), 0)
    : null;
  const massBalanceDifferenceKg = rawInputKg !== null && accountedMassKg !== null ? rawInputKg - accountedMassKg : null;
  const lossMassKg = lossFields.reduce<number>((total, field) => total + (losses[field] ?? 0), 0);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (linkedLineCount < 1) errors.push("At least one production line is required.");
  if (rawInputKg === null || rawInputKg <= 0) errors.push("rawInputKg must be greater than zero before confirmation.");
  if (sellableOutputKg === null) warnings.push("Sellable output is still missing.");
  if (missingMassFields.length > 0) warnings.push(`Mass balance is incomplete; missing: ${missingMassFields.join(", ")}.`);
  if (massBalanceDifferenceKg !== null && massBalanceDifferenceKg < -0.001) {
    errors.push("Accounted mass exceeds raw input mass.");
  }

  return {
    isValid: errors.length === 0,
    isReadyToConfirm: errors.length === 0 && missingMassFields.length === 0,
    errors,
    warnings,
    linkedLineCount,
    metrics: {
      rawInputKg,
      sellableOutputKg,
      accountedMassKg,
      knownLossMassKg: lossMassKg,
      massBalanceDifferenceKg,
      sellableYieldPercent: rawInputKg && sellableOutputKg !== null ? (sellableOutputKg / rawInputKg) * 100 : null,
      lossPercent: rawInputKg ? (lossMassKg / rawInputKg) * 100 : null
    }
  };
}

export const batchReportingRouter = Router();
batchReportingRouter.use(requireAuthenticatedUser);

batchReportingRouter.get(
  "/v1/production-batches",
  route(async (request, response) => {
    const user = getAuthenticatedUser(response);
    const siteId = request.query.manufacturingSiteId === undefined ? undefined : parseId(request.query.manufacturingSiteId);
    if (siteId) await assertUserOwnsManufacturingSite(user.id, siteId);
    const rows = await requirePrisma().$queryRawUnsafe<DatabaseRow[]>(
      `select batch.id, batch.manufacturing_site_id, batch.status, batch.source_channel, batch.batch_reference,
              batch.production_date, batch.species, batch.product_specification, batch.raw_input_kg,
              batch.sellable_output_kg, batch.created_at, batch.updated_at,
              count(link.production_line_id)::int as production_line_count
       from public.production_batch as batch
       join public.manufacturing_sites as site on site.id = batch.manufacturing_site_id
       left join public.production_batch_lines as link on link.production_batch_id = batch.id
       where site.owner_id = $1::uuid and ($2::uuid is null or batch.manufacturing_site_id = $2::uuid)
       group by batch.id
       order by batch.production_date desc, batch.created_at desc`,
      user.id,
      siteId ?? null
    );
    response.status(200).json({ productionBatches: rows });
  })
);

batchReportingRouter.post(
  "/v1/production-batches",
  route(async (request, response) => {
    const user = getAuthenticatedUser(response);
    const input = parseOrThrow(createBatchSchema, request.body);
    await assertUserOwnsManufacturingSite(user.id, input.manufacturingSiteId);
    await assertLinesBelongToSite(input.manufacturingSiteId, input.productionLineIds);
    const database = requirePrisma();
    const batch = await database.$transaction(async (transaction) => {
      const rows = await transaction.$queryRawUnsafe<DatabaseRow[]>(
        `insert into public.production_batch (
          manufacturing_site_id, source_channel, batch_reference, production_date, species, product_specification,
          raw_input_kg, sellable_output_kg, trimming_kg, quality_reject_kg, byproduct_kg, spoilage_kg, other_loss_kg,
          supplier, shift, fish_size_category, storage_state, receiving_condition, receiving_temperature_c,
          delivery_delay_minutes, production_duration_minutes, operator_notes
        ) values (
          $1::uuid, $2, $3, coalesce($4::date, current_date), $5, $6, $7, $8, $9, $10, $11, $12, $13,
          $14, $15, $16, $17, $18, $19, $20, $21, $22
        ) returning id`,
        input.manufacturingSiteId, input.sourceChannel, nullable(input.batchReference), input.productionDate ?? null,
        nullable(input.species), nullable(input.productSpecification), nullable(input.rawInputKg), nullable(input.sellableOutputKg),
        nullable(input.trimmingKg), nullable(input.qualityRejectKg), nullable(input.byproductKg), nullable(input.spoilageKg),
        nullable(input.otherLossKg), nullable(input.supplier), nullable(input.shift), nullable(input.fishSizeCategory),
        nullable(input.storageState), nullable(input.receivingCondition), nullable(input.receivingTemperatureC),
        nullable(input.deliveryDelayMinutes), nullable(input.productionDurationMinutes), nullable(input.operatorNotes)
      );
      const created = rows[0];
      if (!created || typeof created.id !== "string") throw new ApiError(500, "Batch creation did not return an ID.");
      for (const productionLineId of input.productionLineIds) {
        await transaction.$executeRawUnsafe(
          `insert into public.production_batch_lines (production_batch_id, production_line_id, manufacturing_site_id)
           values ($1::uuid, $2::uuid, $3::uuid)`,
          created.id,
          productionLineId,
          input.manufacturingSiteId
        );
      }
      return created.id;
    });
    response.status(201).json({ productionBatch: await getBatchDetail(batch) });
  })
);

batchReportingRouter.get(
  "/v1/production-batches/:batchId",
  route(async (request, response) => {
    const user = getAuthenticatedUser(response);
    const batchId = parseId(request.params.batchId);
    await assertUserOwnsBatch(user.id, batchId);
    response.status(200).json({ productionBatch: await getBatchDetail(batchId) });
  })
);

batchReportingRouter.patch(
  "/v1/production-batches/:batchId",
  route(async (request, response) => {
    const user = getAuthenticatedUser(response);
    const batchId = parseId(request.params.batchId);
    const input = parseOrThrow(updateBatchSchema, request.body);
    if (Object.keys(input).length === 0) throw new ApiError(400, "Provide at least one field to update.");
    const batch = await assertUserOwnsBatch(user.id, batchId);
    if (typeof batch.manufacturing_site_id !== "string") throw new ApiError(500, "Batch site is invalid.");
    if (batch.status !== "draft") throw new ApiError(409, "Only draft production batches can be changed.");
    if (input.productionLineIds) await assertLinesBelongToSite(batch.manufacturing_site_id, input.productionLineIds);

    const columnByField: Record<string, string> = {
      batchReference: "batch_reference", productionDate: "production_date", species: "species",
      productSpecification: "product_specification", rawInputKg: "raw_input_kg", sellableOutputKg: "sellable_output_kg",
      trimmingKg: "trimming_kg", qualityRejectKg: "quality_reject_kg", byproductKg: "byproduct_kg",
      spoilageKg: "spoilage_kg", otherLossKg: "other_loss_kg", supplier: "supplier", shift: "shift",
      fishSizeCategory: "fish_size_category", storageState: "storage_state", receivingCondition: "receiving_condition",
      receivingTemperatureC: "receiving_temperature_c", deliveryDelayMinutes: "delivery_delay_minutes",
      productionDurationMinutes: "production_duration_minutes", operatorNotes: "operator_notes"
    };
    const parameters: Array<string | number | null> = [batchId];
    const updates: string[] = [];
    for (const [field, column] of Object.entries(columnByField)) {
      if (Object.hasOwn(input, field)) {
        parameters.push(nullable(input[field as keyof typeof input] as string | number | null | undefined));
        updates.push(`${column} = $${parameters.length}`);
      }
    }
    const database = requirePrisma();
    await database.$transaction(async (transaction) => {
      if (updates.length > 0) {
        await transaction.$executeRawUnsafe(
          `update public.production_batch set ${updates.join(", ")} where id = $1::uuid and status = 'draft'`,
          ...parameters
        );
      }
      if (input.productionLineIds) {
        await transaction.$executeRawUnsafe(`delete from public.production_batch_lines where production_batch_id = $1::uuid`, batchId);
        for (const productionLineId of input.productionLineIds) {
          await transaction.$executeRawUnsafe(
            `insert into public.production_batch_lines (production_batch_id, production_line_id, manufacturing_site_id)
             values ($1::uuid, $2::uuid, $3::uuid)`,
            batchId,
            productionLineId,
            batch.manufacturing_site_id
          );
        }
      }
    });
    response.status(200).json({ productionBatch: await getBatchDetail(batchId) });
  })
);

batchReportingRouter.get(
  "/v1/production-batches/:batchId/validation",
  route(async (request, response) => {
    const user = getAuthenticatedUser(response);
    const batchId = parseId(request.params.batchId);
    await assertUserOwnsBatch(user.id, batchId);
    const rows = await requirePrisma().$queryRawUnsafe<DatabaseRow[]>(
      `select batch.*, count(link.production_line_id)::int as linked_line_count
       from public.production_batch as batch
       left join public.production_batch_lines as link on link.production_batch_id = batch.id
       where batch.id = $1::uuid
       group by batch.id`,
      batchId
    );
    const batch = rows[0];
    if (!batch) throw new ApiError(404, "Production batch was not found.");
    response.status(200).json({ validation: validateBatch(batch, Number(batch.linked_line_count)) });
  })
);
