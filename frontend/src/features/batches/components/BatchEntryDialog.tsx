"use client";

import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type BatchEntryValues = {
  deliveryDelay: string;
  estimatedFilletKg?: number;
  fishSpecies: string;
  inputKg: number;
  productionLineContext: string;
  qualityRejectKg: number;
  rejectReason: string;
  productionSite: string;
  trimmingKg: number;
};

export function BatchEntryDialog({ onCreateBatch }: Readonly<{ onCreateBatch: (values: BatchEntryValues) => void }>) {
  const [open, setOpen] = useState(false);
  const [inputKg, setInputKg] = useState(0);
  const [estimatedFilletKg, setEstimatedFilletKg] = useState(0);
  const hasEstimatedFillet = estimatedFilletKg > 0 && inputKg > 0;
  const estimatedYield = hasEstimatedFillet ? (estimatedFilletKg / inputKg) * 100 : null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const optionalFillet = Number(formData.get("estimated-fillets"));

    onCreateBatch({
      deliveryDelay: String(formData.get("delivery-delay") ?? ""),
      estimatedFilletKg: optionalFillet > 0 ? optionalFillet : undefined,
      fishSpecies: String(formData.get("fish-species") ?? ""),
      inputKg: Number(formData.get("raw-material-input")),
      productionLineContext: String(formData.get("production-line-context") ?? ""),
      qualityRejectKg: Number(formData.get("quality-reject")),
      rejectReason: String(formData.get("reject-reason") ?? ""),
      productionSite: String(formData.get("production-site") ?? ""),
      trimmingKg: Number(formData.get("trimming"))
    });

    event.currentTarget.reset();
    setInputKg(0);
    setEstimatedFilletKg(0);
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
      <DialogContent className="max-h-[calc(100dvh-4rem)] max-w-[52rem] gap-0 overflow-y-auto rounded-none border-[var(--line-strong)] bg-[var(--surface)] p-0 shadow-[0_24px_64px_-32px_rgb(19_56_82_/_55%)]" onOpenAutoFocus={(event) => event.preventDefault()}>
        <DialogHeader className="border-b border-[var(--line)] px-6 py-5 text-left">
          <p className="text-xs font-medium text-[var(--brand)]">New batch report</p>
          <DialogTitle className="mt-1 text-xl font-semibold tracking-tight text-[var(--ink)]">Add production batch</DialogTitle>
          <DialogDescription className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">Record the values reported from the current processing site. The batch remains outside trusted history until it is validated and confirmed.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-x-5 gap-y-4 px-6 py-5">
            <FormField id="fish-species" label="Fish species"><Input className="h-10 rounded-none border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)] placeholder:text-[var(--muted)] focus-visible:ring-[var(--focus)]" id="fish-species" name="fish-species" placeholder="e.g. Red snapper" required /></FormField>
            <FormField id="production-site" label="Production site"><Input className="h-10 rounded-none border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)] placeholder:text-[var(--muted)] focus-visible:ring-[var(--focus)]" id="production-site" name="production-site" placeholder="e.g. Muara Baru Plant" required /></FormField>
            <FormField id="raw-material-input" label="Raw-material input"><Input className="h-10 rounded-none border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)] focus-visible:ring-[var(--focus)]" id="raw-material-input" min="0" name="raw-material-input" onChange={(event) => setInputKg(Number(event.target.value))} placeholder="kg" required step="0.1" type="number" /></FormField>
            <FormField hint="Optional" id="estimated-fillets" label="Estimated sellable fillet"><Input className="h-10 rounded-none border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)] focus-visible:ring-[var(--focus)]" id="estimated-fillets" min="0" name="estimated-fillets" onChange={(event) => setEstimatedFilletKg(Number(event.target.value))} placeholder="kg" step="0.1" type="number" /></FormField>
            <FormField id="trimming" label="Trimming"><Input className="h-10 rounded-none border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)] focus-visible:ring-[var(--focus)]" id="trimming" min="0" name="trimming" placeholder="kg" required step="0.1" type="number" /></FormField>
            <FormField id="quality-reject" label="Quality reject"><Input className="h-10 rounded-none border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)] focus-visible:ring-[var(--focus)]" id="quality-reject" min="0" name="quality-reject" placeholder="kg" required step="0.1" type="number" /></FormField>
            <FormField id="reject-reason" label="Reject reason"><Input className="h-10 rounded-none border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)] placeholder:text-[var(--muted)] focus-visible:ring-[var(--focus)]" id="reject-reason" name="reject-reason" placeholder="e.g. Soft flesh" required /></FormField>
            <FormField id="delivery-delay" label="Delivery delay"><Input className="h-10 rounded-none border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)] placeholder:text-[var(--muted)] focus-visible:ring-[var(--focus)]" id="delivery-delay" name="delivery-delay" placeholder="e.g. Approximately 2 hours" required /></FormField>
            <div className="col-span-2">
              <FormField hint="Separate lines with commas" id="production-line-context" label="Production line context"><Textarea className="min-h-[4.5rem] resize-none rounded-none border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)] placeholder:text-[var(--muted)] focus-visible:ring-[var(--focus)]" id="production-line-context" name="production-line-context" placeholder="e.g. Line 1 cutting, Line A packaging" required /></FormField>
            </div>
          </div>

          <div className="flex items-center justify-between gap-5 border-y border-[var(--line)] bg-[var(--surface-subtle)] px-6 py-4">
            <div>
              <p className="text-xs text-[var(--muted)]">Estimated fillet yield</p>
              <p className="mt-1 font-mono text-sm font-semibold text-[var(--ink)]">{estimatedYield === null ? "Awaiting optional output" : `${estimatedYield.toFixed(1)}%`}</p>
            </div>
            <p className="max-w-sm text-right text-xs leading-5 text-[var(--muted)]">Yield is calculated from reported input and estimated sellable fillet. It is not added to comparable history before confirmation.</p>
          </div>

          <DialogFooter className="gap-3 px-6 py-4 sm:justify-between sm:space-x-0">
            <DialogClose asChild><Button className="rounded-none border-[var(--line-strong)] bg-[var(--surface)] text-[var(--muted)] shadow-none hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]" type="button" variant="outline">Cancel</Button></DialogClose>
            <Button className="rounded-none bg-[var(--brand)] text-white shadow-none hover:bg-[var(--brand-strong)]" type="submit">Add as unconfirmed batch</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FormField({ children, hint, id, label }: Readonly<{ children: ReactNode; hint?: string; id: string; label: string }>) {
  return <div className="space-y-2"><div className="flex items-center justify-between gap-3"><Label className="text-xs font-medium text-[var(--ink)]" htmlFor={id}>{label}</Label>{hint ? <span className="text-xs text-[var(--muted)]">{hint}</span> : null}</div>{children}</div>;
}
