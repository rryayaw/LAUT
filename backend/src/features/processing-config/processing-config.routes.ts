import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { getAuthenticatedUser, requireAuthenticatedUser } from "../auth/auth.middleware.js";
import { assertUserOwnsManufacturingSite } from "./site-access.service.js";

type DatabaseRow = Record<string, unknown>;

const idSchema = z.string().uuid();
const optionalText = z.string().trim().min(1).max(2_000).optional().nullable();
const siteInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  timezone: z.string().trim().min(1).max(80).default("Asia/Jakarta"),
  location: optionalText,
  notes: optionalText
});
const siteUpdateSchema = siteInputSchema.partial();
const lineInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: optionalText,
  isActive: z.boolean().optional()
});
const lineUpdateSchema = lineInputSchema.partial();
const tagAssignmentSchema = z.object({
  capabilityTagId: idSchema,
  otherContext: optionalText
});
const tagAssignmentUpdateSchema = z.object({
  otherContext: optionalText
});

function requirePrisma() {
  if (!prisma) {
    throw new ApiError(503, "Database access is not configured.");
  }
  return prisma;
}

class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ApiError(400, "Request data is invalid.");
  }
  return result.data;
}

function parseId(value: unknown): string {
  return parseOrThrow(idSchema, value);
}

function nullableText(value: string | null | undefined): string | null {
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
    response.status(400).json({ error: "The request conflicts with the current configuration." });
    return;
  }

  console.error("Processing configuration request failed.", error);
  response.status(500).json({ error: "An unexpected error occurred." });
}

function route(handler: (request: Request, response: Response) => Promise<void>) {
  return (request: Request, response: Response): void => {
    void handler(request, response).catch((error: unknown) => sendError(response, error));
  };
}

async function assertUserOwnsProductionLine(userId: string, productionLineId: string): Promise<DatabaseRow> {
  const database = requirePrisma();
  const rows = await database.$queryRawUnsafe<DatabaseRow[]>(
    `select line.id, line.manufacturing_site_id
     from public.production_lines as line
     join public.manufacturing_sites as site on site.id = line.manufacturing_site_id
     where line.id = $1::uuid and site.owner_id = $2::uuid
     limit 1`,
    productionLineId,
    userId
  );

  if (!rows[0]) {
    throw new ApiError(404, "Production line was not found.");
  }
  return rows[0];
}

export const processingConfigRouter = Router();

processingConfigRouter.use(requireAuthenticatedUser);

processingConfigRouter.get(
  "/v1/capability-tags",
  route(async (_request, response) => {
    const rows = await requirePrisma().$queryRawUnsafe<DatabaseRow[]>(
      `select id, code, label, description
       from public.capability_tags
       order by label asc`
    );
    response.status(200).json({ capabilityTags: rows });
  })
);

processingConfigRouter.get(
  "/v1/manufacturing-sites",
  route(async (_request, response) => {
    const user = getAuthenticatedUser(response);
    const rows = await requirePrisma().$queryRawUnsafe<DatabaseRow[]>(
      `select id, name, timezone, location, notes, created_at, updated_at
       from public.manufacturing_sites
       where owner_id = $1::uuid
       order by name asc`,
      user.id
    );
    response.status(200).json({ manufacturingSites: rows });
  })
);

processingConfigRouter.post(
  "/v1/manufacturing-sites",
  route(async (request, response) => {
    const user = getAuthenticatedUser(response);
    const input = parseOrThrow(siteInputSchema, request.body);
    const rows = await requirePrisma().$queryRawUnsafe<DatabaseRow[]>(
      `insert into public.manufacturing_sites (owner_id, name, timezone, location, notes)
       values ($1::uuid, $2, $3, $4, $5)
       returning id, name, timezone, location, notes, created_at, updated_at`,
      user.id,
      input.name,
      input.timezone,
      nullableText(input.location),
      nullableText(input.notes)
    );
    response.status(201).json({ manufacturingSite: rows[0] });
  })
);

processingConfigRouter.patch(
  "/v1/manufacturing-sites/:siteId",
  route(async (request, response) => {
    const user = getAuthenticatedUser(response);
    const siteId = parseId(request.params.siteId);
    const input = parseOrThrow(siteUpdateSchema, request.body);
    if (Object.keys(input).length === 0) throw new ApiError(400, "Provide at least one field to update.");
    await assertUserOwnsManufacturingSite(user.id, siteId);
    const rows = await requirePrisma().$queryRawUnsafe<DatabaseRow[]>(
      `update public.manufacturing_sites
       set name = coalesce($2, name), timezone = coalesce($3, timezone),
           location = case when $4::boolean then $5 else location end,
           notes = case when $6::boolean then $7 else notes end
       where id = $1::uuid and owner_id = $8::uuid
       returning id, name, timezone, location, notes, created_at, updated_at`,
      siteId,
      input.name ?? null,
      input.timezone ?? null,
      Object.hasOwn(input, "location"),
      nullableText(input.location),
      Object.hasOwn(input, "notes"),
      nullableText(input.notes),
      user.id
    );
    response.status(200).json({ manufacturingSite: rows[0] });
  })
);

processingConfigRouter.get(
  "/v1/manufacturing-sites/:siteId/production-lines",
  route(async (request, response) => {
    const user = getAuthenticatedUser(response);
    const siteId = parseId(request.params.siteId);
    await assertUserOwnsManufacturingSite(user.id, siteId);
    const rows = await requirePrisma().$queryRawUnsafe<DatabaseRow[]>(
      `select id, manufacturing_site_id, name, description, is_active, created_at, updated_at
       from public.production_lines
       where manufacturing_site_id = $1::uuid
       order by name asc`,
      siteId
    );
    response.status(200).json({ productionLines: rows });
  })
);

processingConfigRouter.post(
  "/v1/manufacturing-sites/:siteId/production-lines",
  route(async (request, response) => {
    const user = getAuthenticatedUser(response);
    const siteId = parseId(request.params.siteId);
    const input = parseOrThrow(lineInputSchema, request.body);
    await assertUserOwnsManufacturingSite(user.id, siteId);
    const rows = await requirePrisma().$queryRawUnsafe<DatabaseRow[]>(
      `insert into public.production_lines (manufacturing_site_id, name, description, is_active)
       values ($1::uuid, $2, $3, $4)
       returning id, manufacturing_site_id, name, description, is_active, created_at, updated_at`,
      siteId,
      input.name,
      nullableText(input.description),
      input.isActive ?? true
    );
    response.status(201).json({ productionLine: rows[0] });
  })
);

processingConfigRouter.patch(
  "/v1/production-lines/:productionLineId",
  route(async (request, response) => {
    const user = getAuthenticatedUser(response);
    const productionLineId = parseId(request.params.productionLineId);
    const input = parseOrThrow(lineUpdateSchema, request.body);
    if (Object.keys(input).length === 0) throw new ApiError(400, "Provide at least one field to update.");
    await assertUserOwnsProductionLine(user.id, productionLineId);
    const rows = await requirePrisma().$queryRawUnsafe<DatabaseRow[]>(
      `update public.production_lines
       set name = coalesce($2, name),
           description = case when $3::boolean then $4 else description end,
           is_active = coalesce($5, is_active)
       where id = $1::uuid
       returning id, manufacturing_site_id, name, description, is_active, created_at, updated_at`,
      productionLineId,
      input.name ?? null,
      Object.hasOwn(input, "description"),
      nullableText(input.description),
      input.isActive ?? null
    );
    response.status(200).json({ productionLine: rows[0] });
  })
);

processingConfigRouter.get(
  "/v1/production-lines/:productionLineId/capability-tags",
  route(async (request, response) => {
    const user = getAuthenticatedUser(response);
    const productionLineId = parseId(request.params.productionLineId);
    await assertUserOwnsProductionLine(user.id, productionLineId);
    const rows = await requirePrisma().$queryRawUnsafe<DatabaseRow[]>(
      `select tag.id, tag.code, tag.label, tag.description, link.other_context, link.created_at
       from public.production_line_capability_tags as link
       join public.capability_tags as tag on tag.id = link.capability_tag_id
       where link.production_line_id = $1::uuid
       order by tag.label asc`,
      productionLineId
    );
    response.status(200).json({ capabilityTags: rows });
  })
);

processingConfigRouter.post(
  "/v1/production-lines/:productionLineId/capability-tags",
  route(async (request, response) => {
    const user = getAuthenticatedUser(response);
    const productionLineId = parseId(request.params.productionLineId);
    const input = parseOrThrow(tagAssignmentSchema, request.body);
    await assertUserOwnsProductionLine(user.id, productionLineId);
    const rows = await requirePrisma().$queryRawUnsafe<DatabaseRow[]>(
      `insert into public.production_line_capability_tags (production_line_id, capability_tag_id, other_context)
       values ($1::uuid, $2::uuid, $3)
       returning production_line_id, capability_tag_id, other_context, created_at`,
      productionLineId,
      input.capabilityTagId,
      nullableText(input.otherContext)
    );
    response.status(201).json({ capabilityTagAssignment: rows[0] });
  })
);

processingConfigRouter.patch(
  "/v1/production-lines/:productionLineId/capability-tags/:capabilityTagId",
  route(async (request, response) => {
    const user = getAuthenticatedUser(response);
    const productionLineId = parseId(request.params.productionLineId);
    const capabilityTagId = parseId(request.params.capabilityTagId);
    const input = parseOrThrow(tagAssignmentUpdateSchema, request.body);
    if (!Object.hasOwn(input, "otherContext")) throw new ApiError(400, "Provide otherContext to update this assignment.");
    await assertUserOwnsProductionLine(user.id, productionLineId);
    const rows = await requirePrisma().$queryRawUnsafe<DatabaseRow[]>(
      `update public.production_line_capability_tags
       set other_context = $3
       where production_line_id = $1::uuid and capability_tag_id = $2::uuid
       returning production_line_id, capability_tag_id, other_context, created_at`,
      productionLineId,
      capabilityTagId,
      nullableText(input.otherContext)
    );
    if (!rows[0]) throw new ApiError(404, "Capability-tag assignment was not found.");
    response.status(200).json({ capabilityTagAssignment: rows[0] });
  })
);

processingConfigRouter.delete(
  "/v1/production-lines/:productionLineId/capability-tags/:capabilityTagId",
  route(async (request, response) => {
    const user = getAuthenticatedUser(response);
    const productionLineId = parseId(request.params.productionLineId);
    const capabilityTagId = parseId(request.params.capabilityTagId);
    await assertUserOwnsProductionLine(user.id, productionLineId);
    const rows = await requirePrisma().$queryRawUnsafe<DatabaseRow[]>(
      `delete from public.production_line_capability_tags
       where production_line_id = $1::uuid and capability_tag_id = $2::uuid
       returning production_line_id`,
      productionLineId,
      capabilityTagId
    );
    if (!rows[0]) throw new ApiError(404, "Capability-tag assignment was not found.");
    response.status(204).send();
  })
);
