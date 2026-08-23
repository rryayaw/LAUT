"use client";

import { useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Plus, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ProductConfig, ProductionSite } from "@/types/domain";
import type { CreateBatchInput } from "../api/batches.api";

const inputClass = "h-10 rounded-none border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)] placeholder:text-[var(--muted)] focus-visible:ring-[var(--focus)]";
const selectClass = "h-10 rounded-none border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)] focus:ring-[var(--focus)]";
const selectContentClass = "rounded-none border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)]";
const selectItemClass = "rounded-none focus:bg-[var(--brand-soft)] focus:text-[var(--ink)]";

const SHIFTS = ["Morning", "Afternoon", "Night"];
const SIZE_CATEGORIES = ["Small", "Medium", "Large"];

type BatchEntryDialogProps = {
  sites: ProductionSite[];
  productConfigs: ProductConfig[];
  onCreateBatch: (values: CreateBatchInput) => void;
};

function numberOrUndefined(value: FormDataEntryValue | null): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function BatchEntryDialog({ onCreateBatch, productConfigs, sites }: Readonly<BatchEntryDialogProps>) {
  const [open, setOpen] = useState(false);
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [lineIds, setLineIds] = useState<string[]>([]);
  const [configId, setConfigId] = useState("");
  const [shift, setShift] = useState(SHIFTS[0]);
  const [sizeCategory, setSizeCategory] = useState(SIZE_CATEGORIES[1]);

  const [inputKg, setInputKg] = useState(0);
  const [outputs, setOutputs] = useState({ sellable: 0, byproduct: 0, trimming: 0, reject: 0, spoilage: 0, other: 0 });

  const site = sites.find((candidate) => candidate.id === siteId) ?? sites[0];
  const siteConfigs = productConfigs.filter((config) => config.productionSiteId === site?.id);
  const selectedConfig = siteConfigs.find((config) => config.id === configId) ?? siteConfigs[0];

  const balance = useMemo(() => {
    const accounted =
      outputs.sellable + outputs.byproduct + outputs.trimming + outputs.reject + outputs.spoilage + outputs.other;
    const unexplained = Math.round((inputKg - accounted) * 10) / 10;
    const yieldPct = inputKg > 0 && outputs.sellable > 0 ? Math.round((outputs.sellable / inputKg) * 1000) / 10 : undefined;
    return { accounted: Math.round(accounted * 10) / 10, unexplained, yieldPct };
  }, [inputKg, outputs]);

  function toggleLine(lineId: string) {
    setLineIds((current) =>
      current.includes(lineId) ? current.filter((value) => value !== lineId) : [...current, lineId]
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!site || !selectedConfig || lineIds.length === 0) return;

    const data = new FormData(event.currentTarget);
    const supplier = String(data.get("supplier") ?? "").trim();
    const rejectReason = String(data.get("reject-reason") ?? "").trim();
    const notes = String(data.get("notes") ?? "").trim();

    onCreateBatch({
      productionSiteId: site.id,
      productionLineIds: lineIds,
      species: selectedConfig.species,
      productSpec: selectedConfig.productSpec,
      shift,
      supplier: supplier.length > 0 ? supplier : undefined,
      fishSizeCategory: sizeCategory,
      deliveryDelayMinutes: numberOrUndefined(data.get("delivery-delay")),
      rejectReason: rejectReason.length > 0 ? rejectReason : undefined,
      notes: notes.length > 0 ? notes : undefined,
      rawInputKg: Number(data.get("raw-input")),
      sellableOutputKg: numberOrUndefined(data.get("sellable-output")),
      normalByproductKg: numberOrUndefined(data.get("byproduct")),
      trimmingKg: numberOrUndefined(data.get("trimming")),
      qualityRejectKg: numberOrUndefined(data.get("quality-reject")),
      spoilageKg: numberOrUndefined(data.get("spoilage")),
      otherLossKg: numberOrUndefined(data.get("other-loss"))
    });

    event.currentTarget.reset();
    setLineIds([]);
    setInputKg(0);
    setOutputs({ sellable: 0, byproduct: 0, trimming: 0, reject: 0, spoilage: 0, other: 0 });
    setOpen(false);
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button className="h-auto rounded-none bg-[var(--brand)] px-3 py-2 text-white shadow-none hover:bg-[var(--brand-strong)]" type="button">
          <Plus aria-hidden="true" size={15} strokeWidth={1.75} />
          Add batch
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-h-[calc(100dvh-4rem)] max-w-[56rem] gap-0 overflow-y-auto rounded-none border-[var(--line-strong)] bg-[var(--surface)] p-0 shadow-[0_24px_64px_-32px_rgb(19_56_82_/_55%)]"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader className="border-b border-[var(--line)] px-6 py-5 text-left">
          <p className="text-xs font-medium text-[var(--brand)]">New batch report</p>
          <DialogTitle className="mt-1 text-xl font-semibold tracking-tight text-[var(--ink)]">Record production batch</DialogTitle>
          <DialogDescription className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
            The batch is stored as a draft. It stays outside comparable history until someone confirms it.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <fieldset className="border-b border-[var(--line)] px-6 py-5">
            <legend className="text-xs font-medium text-[var(--muted)]">Where it ran</legend>
            <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-[var(--ink)]" htmlFor="batch-site">Production site</Label>
                <Select onValueChange={(value) => { setSiteId(value); setLineIds([]); }} value={site?.id ?? ""}>
                  <SelectTrigger className={selectClass} id="batch-site"><SelectValue placeholder="Choose site" /></SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    {sites.map((option) => (
                      <SelectItem className={selectItemClass} key={option.id} value={option.id}>{option.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-[var(--ink)]" htmlFor="batch-config">Species and specification</Label>
                <Select onValueChange={setConfigId} value={selectedConfig?.id ?? ""}>
                  <SelectTrigger className={selectClass} id="batch-config"><SelectValue placeholder="Choose product" /></SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    {siteConfigs.map((config) => (
                      <SelectItem className={selectItemClass} key={config.id} value={config.id}>
                        {config.species} · {config.productSpec}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-xs font-medium text-[var(--ink)]">Production lines used</Label>
                  <span className="text-xs text-[var(--muted)]">
                    {lineIds.length === 0 ? "Select at least one" : `${lineIds.length} selected`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 border border-[var(--line)] bg-[var(--surface-subtle)] p-3">
                  {(site?.lines ?? []).map((line) => {
                    const isSelected = lineIds.includes(line.id);
                    return (
                      <button
                        aria-pressed={isSelected}
                        className={`border px-2.5 py-1.5 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] ${
                          isSelected
                            ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                            : "border-[var(--line-strong)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--ink)]"
                        }`}
                        key={line.id}
                        onClick={() => toggleLine(line.id)}
                        title={line.description}
                        type="button"
                      >
                        {line.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </fieldset>

          <fieldset className="border-b border-[var(--line)] px-6 py-5">
            <legend className="text-xs font-medium text-[var(--muted)]">Context</legend>
            <div className="mt-3 grid grid-cols-4 gap-x-5 gap-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-[var(--ink)]" htmlFor="batch-shift">Shift</Label>
                <Select onValueChange={setShift} value={shift}>
                  <SelectTrigger className={selectClass} id="batch-shift"><SelectValue /></SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    {SHIFTS.map((option) => <SelectItem className={selectItemClass} key={option} value={option}>{option}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Field hint="Optional" id="supplier" label="Supplier">
                <Input className={inputClass} id="supplier" name="supplier" placeholder="e.g. Mina Segara" />
              </Field>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-[var(--ink)]" htmlFor="batch-size">Fish size</Label>
                <Select onValueChange={setSizeCategory} value={sizeCategory}>
                  <SelectTrigger className={selectClass} id="batch-size"><SelectValue /></SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    {SIZE_CATEGORIES.map((option) => <SelectItem className={selectItemClass} key={option} value={option}>{option}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Field hint="Minutes" id="delivery-delay" label="Delivery delay">
                <Input className={inputClass} id="delivery-delay" min="0" name="delivery-delay" placeholder="0" step="1" type="number" />
              </Field>
            </div>
          </fieldset>

          <fieldset className="px-6 py-5">
            <div className="flex items-center justify-between gap-4">
              <legend className="text-xs font-medium text-[var(--muted)]">Measured weights</legend>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
                <Radio aria-hidden="true" size={12} strokeWidth={1.75} />
                IoT scale capture planned
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-x-5 gap-y-4">
              <Field id="raw-input" label="Raw-material input">
                <Input className={inputClass} id="raw-input" min="0" name="raw-input" onChange={(event) => setInputKg(Number(event.target.value))} placeholder="kg" required step="0.1" type="number" />
              </Field>
              <Field id="sellable-output" label="Sellable fillet">
                <Input className={inputClass} id="sellable-output" min="0" name="sellable-output" onChange={(event) => setOutputs((c) => ({ ...c, sellable: Number(event.target.value) }))} placeholder="kg" step="0.1" type="number" />
              </Field>
              <Field id="byproduct" label="Normal by-product">
                <Input className={inputClass} id="byproduct" min="0" name="byproduct" onChange={(event) => setOutputs((c) => ({ ...c, byproduct: Number(event.target.value) }))} placeholder="kg" step="0.1" type="number" />
              </Field>
              <Field id="trimming" label="Trimming">
                <Input className={inputClass} id="trimming" min="0" name="trimming" onChange={(event) => setOutputs((c) => ({ ...c, trimming: Number(event.target.value) }))} placeholder="kg" step="0.1" type="number" />
              </Field>
              <Field id="quality-reject" label="Quality reject">
                <Input className={inputClass} id="quality-reject" min="0" name="quality-reject" onChange={(event) => setOutputs((c) => ({ ...c, reject: Number(event.target.value) }))} placeholder="kg" step="0.1" type="number" />
              </Field>
              <Field hint="0 if none" id="spoilage" label="Spoilage / damage">
                <Input className={inputClass} id="spoilage" min="0" name="spoilage" onChange={(event) => setOutputs((c) => ({ ...c, spoilage: Number(event.target.value) }))} placeholder="kg" step="0.1" type="number" />
              </Field>
              <Field hint="0 if none" id="other-loss" label="Other loss">
                <Input className={inputClass} id="other-loss" min="0" name="other-loss" onChange={(event) => setOutputs((c) => ({ ...c, other: Number(event.target.value) }))} placeholder="kg" step="0.1" type="number" />
              </Field>
              <Field hint="Optional" id="reject-reason" label="Reject reason">
                <Input className={inputClass} id="reject-reason" name="reject-reason" placeholder="e.g. Soft flesh" />
              </Field>
              <div className="col-span-2">
                <Field hint="Optional" id="notes" label="Operator notes">
                  <Textarea className="min-h-[2.5rem] resize-none rounded-none border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)] placeholder:text-[var(--muted)] focus-visible:ring-[var(--focus)]" id="notes" name="notes" placeholder="Anything unusual about this batch" />
                </Field>
              </div>
            </div>
          </fieldset>

          <div className="grid grid-cols-3 divide-x divide-[var(--line)] border-y border-[var(--line)] bg-[var(--surface-subtle)]">
            <Summary label="Estimated sellable yield" value={balance.yieldPct === undefined ? "Awaiting output" : `${balance.yieldPct}%`} />
            <Summary label="Accounted for" value={`${balance.accounted} kg`} />
            <Summary
              label="Unexplained"
              tone={balance.unexplained > 0 ? "risk" : "default"}
              value={inputKg > 0 ? `${balance.unexplained} kg` : "—"}
            />
          </div>

          <DialogFooter className="gap-3 px-6 py-4 sm:justify-between sm:space-x-0">
            <p className="max-w-md text-xs leading-5 text-[var(--muted)]">
              Yield is calculated from the reported weights. It does not enter comparable history before confirmation.
            </p>
            <div className="flex gap-3">
              <DialogClose asChild>
                <Button className="rounded-none border-[var(--line-strong)] bg-[var(--surface)] text-[var(--muted)] shadow-none hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]" type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button className="rounded-none bg-[var(--brand)] text-white shadow-none hover:bg-[var(--brand-strong)] disabled:opacity-45" disabled={lineIds.length === 0} type="submit">
                Save as draft
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ children, hint, id, label }: Readonly<{ children: ReactNode; hint?: string; id: string; label: string }>) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-xs font-medium text-[var(--ink)]" htmlFor={id}>{label}</Label>
        {hint ? <span className="text-xs text-[var(--muted)]">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

function Summary({ label, tone = "default", value }: Readonly<{ label: string; tone?: "default" | "risk"; value: string }>) {
  return (
    <div className="px-6 py-4">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className={`mt-1 font-mono text-sm font-semibold ${tone === "risk" ? "text-[var(--risk)]" : "text-[var(--ink)]"}`}>{value}</p>
    </div>
  );
}
