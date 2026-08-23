// Production site, line, and process-tag access.
//
// Backed by `/v1/manufacturing-sites`, `/v1/production-lines`, and
// `/v1/capability-tags`. The backend names these "manufacturing sites" and
// "capability tags"; the translation to the UI's vocabulary happens here so no
// component carries two names for one thing.

import type { Machine, ProcessTag, ProductionLine, ProductionLineStatus, ProductionSite, ProcessTagCode } from "@/types/domain";
import { ApiError, apiRequest, toText } from "@/api/client";
import { cached, invalidateCache } from "@/api/cache";

type SiteRow = { id: string; name: string; timezone: string; location: string | null; notes: string | null };
type LineRow = { id: string; manufacturing_site_id: string; name: string; description: string | null; is_active: boolean };
type TagRow = { id: string; code: string; label: string; description: string | null };

function toProcessTag(row: TagRow): ProcessTag {
  return { id: row.id, code: row.code, label: row.label, description: row.description ?? "" };
}

export async function listProcessTags(): Promise<ProcessTag[]> {
  return cached("capability-tags", async () => {
    const { capabilityTags } = await apiRequest<{ capabilityTags: TagRow[] }>("/v1/capability-tags");
    return capabilityTags.map(toProcessTag);
  });
}

async function listLineTagCodes(lineId: string): Promise<ProcessTagCode[]> {
  const { capabilityTags } = await apiRequest<{ capabilityTags: TagRow[] }>(
    `/v1/production-lines/${lineId}/capability-tags`
  );
  return capabilityTags.map((tag) => tag.code);
}

async function toProductionLine(row: LineRow): Promise<ProductionLine> {
  return {
    id: row.id,
    productionSiteId: row.manufacturing_site_id,
    description: toText(row.description) ?? "",
    name: row.name,
    // The backend stores an active flag rather than a three-state status. A paused
    // line is the only inactive state it can currently express.
    status: row.is_active ? "active" : "paused",
    tagCodes: await listLineTagCodes(row.id),
    // No machine table exists yet; see `Machine` in `src/types/domain`.
    machines: []
  };
}

async function toProductionSite(row: SiteRow): Promise<ProductionSite> {
  const { productionLines } = await apiRequest<{ productionLines: LineRow[] }>(
    `/v1/manufacturing-sites/${row.id}/production-lines`
  );
  return {
    id: row.id,
    name: row.name,
    location: toText(row.location) ?? "",
    timezone: row.timezone,
    lines: await Promise.all(productionLines.map(toProductionLine))
  };
}

/**
 * Sites, their lines, and each line's tags. The backend exposes these as three
 * levels of endpoint, so this fans out; it is cached because the shell reads it on
 * every page.
 */
export async function listProductionSites(): Promise<ProductionSite[]> {
  return cached("production-sites", async () => {
    const { manufacturingSites } = await apiRequest<{ manufacturingSites: SiteRow[] }>("/v1/manufacturing-sites");
    return Promise.all(manufacturingSites.map(toProductionSite));
  });
}

export async function getProductionSite(siteId: string): Promise<ProductionSite | undefined> {
  const sites = await listProductionSites();
  return sites.find((site) => site.id === siteId);
}

export type CreateProductionSiteInput = {
  name: string;
  location: string;
};

export async function createProductionSite(input: CreateProductionSiteInput): Promise<ProductionSite> {
  const { manufacturingSite } = await apiRequest<{ manufacturingSite: SiteRow }>("/v1/manufacturing-sites", {
    method: "POST",
    body: { name: input.name, location: toText(input.location) ?? null, timezone: "Asia/Jakarta" }
  });
  invalidateCache("production-sites");
  return { id: manufacturingSite.id, name: manufacturingSite.name, location: toText(manufacturingSite.location) ?? "", timezone: manufacturingSite.timezone, lines: [] };
}

export type CreateProductionLineInput = {
  name: string;
  description: string;
  status: ProductionLineStatus;
  tagCodes: ProcessTagCode[];
};

export async function createProductionLine(
  siteId: string,
  input: CreateProductionLineInput
): Promise<ProductionLine> {
  const { productionLine } = await apiRequest<{ productionLine: LineRow }>(
    `/v1/manufacturing-sites/${siteId}/production-lines`,
    {
      method: "POST",
      body: { name: input.name, description: toText(input.description) ?? null, isActive: input.status === "active" }
    }
  );

  // Tags are assigned by catalogue ID, one request each; the dialog selects codes.
  const catalogue = await listProcessTags();
  const assignedCodes: ProcessTagCode[] = [];
  for (const code of input.tagCodes) {
    const tag = catalogue.find((candidate) => candidate.code === code);
    if (!tag) continue;
    await apiRequest(`/v1/production-lines/${productionLine.id}/capability-tags`, {
      method: "POST",
      body: { capabilityTagId: tag.id }
    });
    assignedCodes.push(code);
  }

  invalidateCache("production-sites");
  return {
    id: productionLine.id,
    productionSiteId: siteId,
    name: productionLine.name,
    description: toText(productionLine.description) ?? "",
    status: productionLine.is_active ? "active" : "paused",
    tagCodes: assignedCodes,
    machines: []
  };
}

export type CreateMachineInput = {
  name: string;
  model?: string;
  status: Machine["status"];
  notes?: string;
};

export async function createMachine(_lineId: string, _input: CreateMachineInput): Promise<Machine> {
  throw new ApiError(
    "Machines cannot be saved yet — the backend has no machine endpoint. Record the equipment in the production line description for now.",
    501
  );
}
