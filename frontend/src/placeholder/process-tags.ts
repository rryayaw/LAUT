import type { ProcessTag, ProcessTagCode } from "@/types/domain";

/**
 * Mirrors the `process_tags` system catalogue seeded in
 * `supabase/migrations/20260820105127_replace_site_tags_with_system_catalog.sql`.
 */
export const processTagCatalogue: ProcessTag[] = [
  { code: "receiving", label: "Receiving", description: "Taking in raw material and recording arrival condition." },
  { code: "sorting", label: "Sorting", description: "Separating raw material by size, species, or condition." },
  { code: "washing", label: "Washing", description: "Rinsing product before or between processing stages." },
  { code: "cutting", label: "Cutting", description: "Primary cutting or sizing of fish or fillet portions." },
  { code: "filleting", label: "Filleting", description: "Separating fillets from whole fish." },
  { code: "deboning", label: "Deboning", description: "Removing bones from fish or fillets." },
  { code: "skinning", label: "Skinning", description: "Removing skin from fish or fillets." },
  { code: "trimming", label: "Trimming", description: "Removing non-sellable or specification-excess material." },
  { code: "grading", label: "Grading", description: "Sorting finished material by grade or specification." },
  { code: "quality_control", label: "Quality control", description: "Inspecting product against the configured quality standard." },
  { code: "weighing", label: "Weighing", description: "Measuring product or loss-category weights during processing." },
  { code: "packaging", label: "Packaging", description: "Packing sellable product for storage or shipment." },
  { code: "freezing", label: "Freezing", description: "Freezing product as part of the production process." },
  { code: "glazing", label: "Glazing", description: "Applying a protective ice glaze to frozen product." },
  { code: "cold_storage", label: "Cold storage", description: "Holding product under controlled cold storage." },
  { code: "rework", label: "Rework", description: "Reprocessing product that requires corrective handling." },
  { code: "waste_handling", label: "Waste handling", description: "Handling production waste or non-sellable material." },
  { code: "other", label: "Other", description: "A user-described process not represented by the preset catalogue." }
];

const byCode = new Map<ProcessTagCode, ProcessTag>(processTagCatalogue.map((tag) => [tag.code, tag]));

export function getProcessTag(code: ProcessTagCode): ProcessTag {
  return byCode.get(code) ?? { code: "other", label: "Other", description: "" };
}

export function tagLabels(codes: ProcessTagCode[]): string[] {
  return codes.map((code) => getProcessTag(code).label);
}
