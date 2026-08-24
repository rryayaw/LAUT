"use client";

import { useState } from "react";
import { Building2, Cog, GitBranch, MapPin } from "lucide-react";
import { AsyncBoundary } from "@/components/app/AsyncBoundary";
import { OperationsShell } from "@/components/app/OperationsShell";
import { PageHeader } from "@/components/app/PageHeader";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAsyncData } from "@/hooks/useAsyncData";
import { useWriteAction } from "@/hooks/useWriteAction";
import { WriteErrorBanner } from "@/components/app/WriteErrorBanner";
import type { ProductionSite } from "@/types/domain";
import {
  createMachine,
  createProductionLine,
  createProductionSite,
  listProcessTags,
  listProductionSites,
  type CreateMachineInput,
  type CreateProductionLineInput,
  type CreateProductionSiteInput
} from "./api/production-sites.api";
import { AddFishProductDialog, AddProductionLineDialog, AddProductionSiteDialog } from "./components/ProductionSiteDialogs";
import { ProductionLinePanel } from "./components/ProductionLinePanel";
import { ProductionLinesLedger } from "./components/ProductionLinesLedger";
import { addSiteProductConfig } from "@/features/processing-config/api/processing-config.api";

export function ProductionSitesView() {
  const { data: sites, error, isLoading, reload } = useAsyncData(() => listProductionSites(), []);
  const { data: processTags } = useAsyncData(() => listProcessTags(), []);

  const [selectedSiteId, setSelectedSiteId] = useState<string>();
  const [selectedLineId, setSelectedLineId] = useState<string>();

  const selectedSite = sites?.find((site) => site.id === selectedSiteId) ?? sites?.[0];
  const selectedLine =
    selectedSite?.lines.find((line) => line.id === selectedLineId) ?? selectedSite?.lines[0];

  const addSite = useWriteAction(async (values: CreateProductionSiteInput) => {
    const site = await createProductionSite(values);
    setSelectedSiteId(site.id);
    setSelectedLineId(undefined);
  }, reload);

  const addLine = useWriteAction(async (values: CreateProductionLineInput) => {
    if (!selectedSite) return;
    const line = await createProductionLine(selectedSite.id, values);
    setSelectedLineId(line.id);
  }, reload);

  const addFishProduct = useWriteAction(async (values: { species: string; productSpecification: string }) => {
    if (!selectedSite) return;
    await addSiteProductConfig(selectedSite.id, values);
  });

  const addMachine = useWriteAction(async (values: CreateMachineInput) => {
    if (!selectedLine) return;
    await createMachine(selectedLine.id, values);
  }, reload);

  const writeError = addSite.error ?? addLine.error ?? addMachine.error ?? addFishProduct.error;

  function dismissWriteError() {
    addSite.dismissError();
    addLine.dismissError();
    addMachine.dismissError();
    addFishProduct.dismissError();
  }

  return (
    <OperationsShell>
      <a className="skip-link" href="#production-sites-content">Skip to production sites</a>
      <main className="mx-auto max-w-[92rem] px-7 py-6" id="production-sites-content" tabIndex={-1}>
        <PageHeader
          actions={<AddProductionSiteDialog onAddSite={addSite.run} />}
          breadcrumb="Operations / production sites"
          description="One site is a physical plant. Each site runs production lines, and each line has its own process tags, machines, and saved operating context."
          meta={
            sites && sites.length > 0 ? (
              <div className="w-64">
                <Label className="text-xs font-medium text-[var(--muted)]" htmlFor="production-site-select">
                  Production site
                </Label>
                <Select
                  onValueChange={(value) => {
                    setSelectedSiteId(value);
                    setSelectedLineId(undefined);
                  }}
                  value={selectedSite?.id ?? ""}
                >
                  <SelectTrigger
                    className="mt-2 h-10 rounded-none border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)] focus:ring-[var(--focus)]"
                    id="production-site-select"
                  >
                    <SelectValue placeholder="Choose production site" />
                  </SelectTrigger>
                  <SelectContent className="rounded-none border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)]">
                    {sites.map((site) => (
                      <SelectItem className="rounded-none focus:bg-[var(--brand-soft)] focus:text-[var(--ink)]" key={site.id} value={site.id}>
                        {site.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : undefined
          }
          title="Production sites"
        />

        <WriteErrorBanner error={writeError} onDismiss={dismissWriteError} />

        <div className="mt-6">
          <AsyncBoundary
            emptyMessage="Add a production site to begin configuring lines, tags, and machines."
            emptyTitle="No production sites yet"
            error={error}
            isEmpty={!selectedSite}
            isLoading={isLoading}
          >
            {selectedSite ? (
              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-8">
                  <div className="mb-4 flex items-end justify-between gap-5">
                    <SiteSummary site={selectedSite} />
                    <div className="flex flex-wrap gap-3"><AddFishProductDialog onAdd={addFishProduct.run} /><AddProductionLineDialog onAddLine={addLine.run} processTags={processTags ?? []} /></div>
                  </div>
                  <ProductionLinesLedger
                    lines={selectedSite.lines}
                    onSelectLine={setSelectedLineId}
                    processTags={processTags ?? []}
                    selectedLineId={selectedLine?.id}
                  />
                </div>
                <div className="col-span-4">
                  {selectedLine ? (
                    <ProductionLinePanel line={selectedLine} onAddMachine={addMachine.run} processTags={processTags ?? []} />
                  ) : (
                    <aside className="flex min-h-[20rem] flex-col items-center justify-center gap-3 border-y border-[var(--line)] bg-[var(--surface)] px-6 text-center">
                      <GitBranch aria-hidden="true" className="text-[var(--brand)]" size={22} strokeWidth={1.5} />
                      <p className="text-sm font-semibold text-[var(--ink)]">No production line selected</p>
                      <p className="max-w-xs text-xs leading-5 text-[var(--muted)]">
                        Add a line to this site, then select it to record what it does and which machines run on it.
                      </p>
                    </aside>
                  )}
                </div>
              </div>
            ) : null}
          </AsyncBoundary>
        </div>
      </main>
    </OperationsShell>
  );
}

function SiteSummary({ site }: Readonly<{ site: ProductionSite }>) {
  const activeLines = site.lines.filter((line) => line.status === "active").length;
  const machineCount = site.lines.reduce((total, line) => total + line.machines.length, 0);

  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-[var(--muted)]">Selected site</p>
      <h2 className="mt-1 text-xl font-semibold tracking-tight">{site.name}</h2>
      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-[var(--muted)]">
        <span className="inline-flex items-center gap-1.5">
          <MapPin aria-hidden="true" size={13} strokeWidth={1.75} />
          {site.location}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Building2 aria-hidden="true" size={13} strokeWidth={1.75} />
          {site.lines.length} lines · {activeLines} active
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Cog aria-hidden="true" size={13} strokeWidth={1.75} />
          {machineCount} machines
        </span>
      </div>
    </div>
  );
}
