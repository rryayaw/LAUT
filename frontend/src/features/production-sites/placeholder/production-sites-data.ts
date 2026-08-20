export type ProductionLineStatus = "active" | "maintenance" | "paused";

export type ProductionLine = {
  id: string;
  name: string;
  status: ProductionLineStatus;
  tags: string[];
};

export type ProductionSite = {
  id: string;
  lines: ProductionLine[];
  location: string;
  name: string;
};

export const productionSitesSnapshot = {
  sites: [
    { id: "muara-baru", name: "Muara Baru Plant", location: "Muara Baru, Jakarta", lines: [
      { id: "line-2a", name: "Line 2A", tags: ["Cutting", "Trimming"], status: "active" },
      { id: "qc-bench-1", name: "QC Bench 1", tags: ["Quality control", "Rework"], status: "active" },
      { id: "line-1f", name: "Line 1F", tags: ["Cutting", "Freezing"], status: "maintenance" }
    ] },
    { id: "ancol-support", name: "Ancol Support Site", location: "Ancol, Jakarta", lines: [
      { id: "line-3c", name: "Line 3C", tags: ["Cutting", "Packaging"], status: "active" },
      { id: "pack-lane-2", name: "Pack Lane 2", tags: ["Packaging", "Quality control"], status: "paused" }
    ] }
  ] satisfies ProductionSite[]
};
