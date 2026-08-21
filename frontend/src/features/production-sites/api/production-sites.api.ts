// Production site, line, and machine access.
//
// Reads from `src/placeholder/mock-db`. Swap these bodies for `apiRequest(...)`
// calls when `/v1/production-sites` exists; no component changes are required.

import type { Machine, ProcessTag, ProductionLine, ProductionLineStatus, ProductionSite, ProcessTagCode } from "@/types/domain";
import { processTagCatalogue } from "@/placeholder/process-tags";
import { productionSites } from "@/placeholder/mock-db";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export async function listProductionSites(): Promise<ProductionSite[]> {
  return clone(productionSites);
}

export async function getProductionSite(siteId: string): Promise<ProductionSite | undefined> {
  const site = productionSites.find((candidate) => candidate.id === siteId);
  return site ? clone(site) : undefined;
}

export async function listProcessTags(): Promise<ProcessTag[]> {
  return clone(processTagCatalogue);
}

export type CreateProductionSiteInput = {
  name: string;
  location: string;
};

export async function createProductionSite(input: CreateProductionSiteInput): Promise<ProductionSite> {
  const site: ProductionSite = {
    id: `site-${slug(input.name)}-${productionSites.length + 1}`,
    name: input.name,
    location: input.location,
    timezone: "Asia/Jakarta",
    lines: []
  };

  productionSites.push(site);
  return clone(site);
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
  const site = productionSites.find((candidate) => candidate.id === siteId);
  if (!site) throw new Error(`Production site ${siteId} was not found.`);

  const line: ProductionLine = {
    id: `${siteId}-${slug(input.name)}`,
    productionSiteId: siteId,
    name: input.name,
    description: input.description,
    status: input.status,
    tagCodes: input.tagCodes,
    machines: []
  };

  site.lines.push(line);
  return clone(line);
}

export type CreateMachineInput = {
  name: string;
  model?: string;
  status: Machine["status"];
  notes?: string;
};

export async function createMachine(lineId: string, input: CreateMachineInput): Promise<Machine> {
  const line = productionSites.flatMap((site) => site.lines).find((candidate) => candidate.id === lineId);
  if (!line) throw new Error(`Production line ${lineId} was not found.`);

  const machine: Machine = {
    id: `${lineId}-mch-${line.machines.length + 1}`,
    productionLineId: lineId,
    name: input.name,
    model: input.model,
    status: input.status,
    notes: input.notes
  };

  line.machines.push(machine);
  return clone(machine);
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
