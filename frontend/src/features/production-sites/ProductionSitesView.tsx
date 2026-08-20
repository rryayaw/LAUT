"use client";

import { useState } from "react";
import { Building2, GitBranch, MapPin } from "lucide-react";
import { OperationsShell } from "@/components/app/OperationsShell";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AddProductionLineDialog, AddProductionSiteDialog } from "./components/ProductionSiteDialogs";
import { ProductionLinesLedger } from "./components/ProductionLinesLedger";
import { productionSitesSnapshot } from "./placeholder/production-sites-data";
import type { ProductionLine, ProductionLineStatus, ProductionSite } from "./placeholder/production-sites-data";

export function ProductionSitesView() {
  const [sites, setSites] = useState<ProductionSite[]>(productionSitesSnapshot.sites);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const selectedSite = sites.find((site) => site.id === selectedSiteId);

  function addSite(values: { location: string; name: string }) {
    const site: ProductionSite = { id: values.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""), lines: [], location: values.location, name: values.name };
    setSites((current) => [...current, site]);
    setSelectedSiteId(site.id);
  }

  function addLine(values: { name: string; status: ProductionLineStatus; tags: string[] }) {
    if (!selectedSite) return;
    const line: ProductionLine = { id: `${selectedSite.id}-${values.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, name: values.name, status: values.status, tags: values.tags };
    setSites((current) => current.map((site) => site.id === selectedSite.id ? { ...site, lines: [...site.lines, line] } : site));
  }

  return (
    <OperationsShell activeArea="production-sites">
      <a className="skip-link" href="#production-sites-content">Skip to production sites</a>
      <main className="mx-auto max-w-[92rem] px-7 py-6" id="production-sites-content" tabIndex={-1}>
        <header className="flex items-end justify-between gap-8 border-b border-[var(--line)] pb-5"><div><p className="text-xs font-medium text-[var(--muted)]">Operations / production sites</p><h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight text-[var(--ink)]">Production sites</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">Select a site to inspect its operational lines, process tags, and current line status.</p></div><div className="flex shrink-0 items-end gap-3"><div className="w-72"><Label className="text-xs font-medium text-[var(--muted)]" htmlFor="production-site-select">Production site</Label><Select onValueChange={setSelectedSiteId} value={selectedSiteId}><SelectTrigger className="mt-2 h-10 rounded-none border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)] focus:ring-[var(--focus)]" id="production-site-select"><SelectValue placeholder="Choose production site" /></SelectTrigger><SelectContent className="rounded-none border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)]">{sites.map((site) => <SelectItem className="rounded-none focus:bg-[var(--brand-soft)] focus:text-[var(--ink)]" key={site.id} value={site.id}>{site.name}</SelectItem>)}</SelectContent></Select></div><AddProductionSiteDialog onAddSite={addSite} /></div></header>

        {selectedSite ? <SelectedSiteWorkspace onAddLine={addLine} site={selectedSite} /> : <ProductionSitesEmptyState />}
      </main>
    </OperationsShell>
  );
}

function ProductionSitesEmptyState() {
  return <section className="mt-6 flex min-h-[32rem] flex-col items-center justify-center border-y border-[var(--line)] bg-[var(--surface)] text-center"><Building2 aria-hidden="true" className="text-[var(--brand)]" size={28} strokeWidth={1.5} /><h2 className="mt-4 text-xl font-semibold tracking-tight text-[var(--ink)]">No production site selected</h2><p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">Choose a production site above to review the lines operating there, or add a new site to begin local setup.</p></section>;
}

function SelectedSiteWorkspace({ onAddLine, site }: Readonly<{ onAddLine: (values: { name: string; status: ProductionLineStatus; tags: string[] }) => void; site: ProductionSite }>) {
  const activeLines = site.lines.filter((line) => line.status === "active").length;
  const pausedLines = site.lines.filter((line) => line.status === "paused").length;
  const maintenanceLines = site.lines.filter((line) => line.status === "maintenance").length;

  return <section className="mt-6 grid grid-cols-12 gap-6"><div className="col-span-8"><div className="mb-4 flex items-center justify-between gap-5"><div><p className="text-xs font-medium text-[var(--muted)]">Selected site</p><h2 className="mt-1 text-xl font-semibold tracking-tight">{site.name}</h2></div><AddProductionLineDialog onAddLine={onAddLine} /></div><ProductionLinesLedger lines={site.lines} /></div><aside className="col-span-4 border-y border-[var(--line)] bg-[var(--surface)]"><div className="border-b border-[var(--line)] px-5 py-4"><p className="text-xs font-medium text-[var(--muted)]">Site profile</p><h2 className="mt-1 text-lg font-semibold tracking-tight">{site.name}</h2></div><div className="border-b border-[var(--line)] px-5 py-4"><div className="flex gap-3"><MapPin aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--brand)]" size={16} strokeWidth={1.75} /><div><p className="text-sm font-medium">{site.location}</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Physical production site</p></div></div></div><dl className="grid grid-cols-2 divide-x divide-y divide-[var(--line)]"><SiteMetric label="Production lines" value={site.lines.length} /><SiteMetric label="Active" value={activeLines} /><SiteMetric label="Paused" value={pausedLines} /><SiteMetric label="Maintenance" value={maintenanceLines} /></dl><div className="px-5 py-4"><div className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]"><GitBranch aria-hidden="true" size={14} strokeWidth={1.75} />Operational context</div><p className="mt-2 text-xs leading-5 text-[var(--muted)]">Line tags become structured context for comparable-batch filtering and investigation evidence after confirmation.</p></div></aside></section>;
}

function SiteMetric({ label, value }: Readonly<{ label: string; value: number }>) {
  return <div className="px-4 py-3.5"><dt className="text-xs text-[var(--muted)]">{label}</dt><dd className="mt-1 font-mono text-lg font-semibold text-[var(--ink)]">{value}</dd></div>;
}
