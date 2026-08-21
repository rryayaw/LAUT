// Name resolution across the mock dataset.
//
// Stands in for the joins a real endpoint performs before responding, so feature
// api modules can hand components display-ready records.

import type { Batch, ProcessTagCode, ProductionLine } from "@/types/domain";
import { getProcessTag } from "./process-tags";
import { productionSites } from "./mock-db";

export function allLines(): ProductionLine[] {
  return productionSites.flatMap((site) => site.lines);
}

export function siteName(siteId: string): string {
  return productionSites.find((site) => site.id === siteId)?.name ?? "Unknown site";
}

export function lineById(lineId: string): ProductionLine | undefined {
  return allLines().find((line) => line.id === lineId);
}

export function lineNames(lineIds: string[]): string[] {
  return lineIds.map((lineId) => lineById(lineId)?.name ?? "Unknown line");
}

/** Every distinct process tag across the lines a batch touched. */
export function tagCodesForLines(lineIds: string[]): ProcessTagCode[] {
  const codes = new Set<ProcessTagCode>();
  for (const lineId of lineIds) {
    for (const code of lineById(lineId)?.tagCodes ?? []) codes.add(code);
  }
  return [...codes];
}

export function tagLabelsForLines(lineIds: string[]): string[] {
  return tagCodesForLines(lineIds).map((code) => getProcessTag(code).label);
}

export function batchContext(batch: Batch) {
  return {
    siteName: siteName(batch.productionSiteId),
    lineNames: lineNames(batch.productionLineIds),
    tagLabels: tagLabelsForLines(batch.productionLineIds)
  };
}
