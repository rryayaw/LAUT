"use client";

import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Plus } from "lucide-react";
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
import type { Machine, ProcessTag, ProcessTagCode, ProductionLineStatus } from "@/types/domain";
import type { CreateMachineInput, CreateProductionLineInput, CreateProductionSiteInput } from "../api/production-sites.api";

const triggerClass = "h-auto rounded-none bg-[var(--brand)] px-3 py-2 text-white shadow-none hover:bg-[var(--brand-strong)]";
const dialogClass = "gap-0 rounded-none border-[var(--line-strong)] bg-[var(--surface)] p-0 shadow-[0_24px_64px_-32px_rgb(19_56_82_/_55%)]";
const inputClass = "h-10 rounded-none border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)] placeholder:text-[var(--muted)] focus-visible:ring-[var(--focus)]";
const selectClass = "h-10 rounded-none border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)] focus:ring-[var(--focus)]";
const selectContentClass = "rounded-none border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)]";
const selectItemClass = "rounded-none focus:bg-[var(--brand-soft)] focus:text-[var(--ink)]";

export function AddProductionSiteDialog({ onAddSite }: Readonly<{ onAddSite: (values: CreateProductionSiteInput) => void }>) {
  const [open, setOpen] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onAddSite({
      name: String(data.get("site-name") ?? ""),
      location: String(data.get("location") ?? ""),
      productConfigs: String(data.get("species") ?? "").trim() && String(data.get("product-specification") ?? "").trim()
        ? [{ species: String(data.get("species")), productSpecification: String(data.get("product-specification")) }]
        : []
    });
    event.currentTarget.reset();
    setOpen(false);
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button className={triggerClass} type="button">
          <Plus aria-hidden="true" size={15} strokeWidth={1.75} />
          Add production site
        </Button>
      </DialogTrigger>
      <DialogContent className={`${dialogClass} max-w-[32rem]`}>
        <DialogHeader className="border-b border-[var(--line)] px-6 py-5 text-left">
          <p className="text-xs font-medium text-[var(--brand)]">Site setup</p>
          <DialogTitle className="mt-1 text-xl font-semibold tracking-tight text-[var(--ink)]">Add production site</DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-6 text-[var(--muted)]">
            A production site is one physical plant or facility. Add its production lines next.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 px-6 py-5">
            <FormField id="site-name" label="Production site name">
              <Input className={inputClass} id="site-name" name="site-name" placeholder="e.g. Muara Baru Plant" required />
            </FormField>
            <FormField id="location" label="Location">
              <Input className={inputClass} id="location" name="location" placeholder="e.g. Muara Baru, Jakarta Utara" required />
            </FormField>
            <div className="border-t border-[var(--line)] pt-4">
              <p className="text-xs font-medium text-[var(--ink)]">First fish product <span className="font-normal text-[var(--muted)]">(optional)</span></p>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Set the species and product specification this site will report. You can add more after creating the site.</p>
              <div className="mt-3 grid grid-cols-2 gap-4">
                <FormField id="species" label="Fish species"><Input className={inputClass} id="species" name="species" placeholder="e.g. Red snapper" /></FormField>
                <FormField id="product-specification" label="Product specification"><Input className={inputClass} id="product-specification" name="product-specification" placeholder="e.g. Frozen fillet" /></FormField>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-3 border-t border-[var(--line)] px-6 py-4 sm:justify-between sm:space-x-0">
            <DialogClose asChild>
              <Button className="rounded-none border-[var(--line-strong)] bg-[var(--surface)] text-[var(--muted)] shadow-none hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]" type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button className="rounded-none bg-[var(--brand)] text-white shadow-none hover:bg-[var(--brand-strong)]" type="submit">
              Create site
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddFishProductDialog({ onAdd }: Readonly<{ onAdd: (values: { species: string; productSpecification: string }) => void }>) {
  const [open, setOpen] = useState(false);
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onAdd({ species: String(data.get("fish-species") ?? ""), productSpecification: String(data.get("fish-product-specification") ?? "") });
    event.currentTarget.reset();
    setOpen(false);
  }
  return <Dialog onOpenChange={setOpen} open={open}>
    <DialogTrigger asChild><Button className="h-auto rounded-none border-[var(--line-strong)] bg-[var(--surface)] px-3 py-2 text-[var(--brand)] shadow-none hover:bg-[var(--brand-soft)]" type="button" variant="outline"><Plus aria-hidden="true" size={15} strokeWidth={1.75} /> Add fish product</Button></DialogTrigger>
    <DialogContent className={`${dialogClass} max-w-[32rem]`}>
      <DialogHeader className="border-b border-[var(--line)] px-6 py-5 text-left"><p className="text-xs font-medium text-[var(--brand)]">Site setup</p><DialogTitle className="mt-1 text-xl font-semibold tracking-tight text-[var(--ink)]">Add fish product</DialogTitle><DialogDescription className="mt-2 text-sm leading-6 text-[var(--muted)]">Batches for this site can select this species and specification.</DialogDescription></DialogHeader>
      <form onSubmit={handleSubmit}><div className="grid grid-cols-2 gap-4 px-6 py-5"><FormField id="fish-species" label="Fish species"><Input autoFocus className={inputClass} id="fish-species" name="fish-species" placeholder="e.g. Tuna" required /></FormField><FormField id="fish-product-specification" label="Product specification"><Input className={inputClass} id="fish-product-specification" name="fish-product-specification" placeholder="e.g. Frozen loin" required /></FormField></div><DialogFooter className="gap-3 border-t border-[var(--line)] px-6 py-4 sm:justify-between sm:space-x-0"><DialogClose asChild><Button className="rounded-none" type="button" variant="outline">Cancel</Button></DialogClose><Button className="rounded-none bg-[var(--brand)] text-white hover:bg-[var(--brand-strong)]" type="submit">Add product</Button></DialogFooter></form>
    </DialogContent>
  </Dialog>;
}

type AddProductionLineDialogProps = {
  processTags: ProcessTag[];
  onAddLine: (values: CreateProductionLineInput) => void;
};

export function AddProductionLineDialog({ onAddLine, processTags }: Readonly<AddProductionLineDialogProps>) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ProductionLineStatus>("active");
  const [selectedTags, setSelectedTags] = useState<ProcessTagCode[]>([]);

  function toggleTag(code: ProcessTagCode) {
    setSelectedTags((current) =>
      current.includes(code) ? current.filter((value) => value !== code) : [...current, code]
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onAddLine({
      name: String(data.get("line-name") ?? ""),
      description: String(data.get("line-description") ?? ""),
      status,
      tagCodes: selectedTags
    });
    event.currentTarget.reset();
    setStatus("active");
    setSelectedTags([]);
    setOpen(false);
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button className={triggerClass} type="button">
          <Plus aria-hidden="true" size={15} strokeWidth={1.75} />
          Add production line
        </Button>
      </DialogTrigger>
      <DialogContent className={`${dialogClass} max-h-[calc(100dvh-4rem)] max-w-[44rem] overflow-y-auto`} onOpenAutoFocus={(event) => event.preventDefault()}>
        <DialogHeader className="border-b border-[var(--line)] px-6 py-5 text-left">
          <p className="text-xs font-medium text-[var(--brand)]">Line setup</p>
          <DialogTitle className="mt-1 text-xl font-semibold tracking-tight text-[var(--ink)]">Add production line</DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Describe what happens on this line. LAUT saves the description as retrievable context for
            comparable-batch filtering and investigation evidence — it never becomes a measurement.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-x-5 gap-y-4 px-6 py-5">
            <FormField id="line-name" label="Production line name">
              <Input className={inputClass} id="line-name" name="line-name" placeholder="e.g. Line 4B" required />
            </FormField>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-[var(--ink)]" htmlFor="line-status">Line status</Label>
              <Select onValueChange={(value: ProductionLineStatus) => setStatus(value)} value={status}>
                <SelectTrigger className={selectClass} id="line-status"><SelectValue /></SelectTrigger>
                <SelectContent className={selectContentClass}>
                  <SelectItem className={selectItemClass} value="active">Active</SelectItem>
                  <SelectItem className={selectItemClass} value="paused">Paused</SelectItem>
                  <SelectItem className={selectItemClass} value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <FormField hint="Saved as AI context" id="line-description" label="What does this line do?">
                <Textarea
                  className="min-h-[7rem] resize-none rounded-none border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)] placeholder:text-[var(--muted)] focus-visible:ring-[var(--focus)]"
                  id="line-description"
                  name="line-description"
                  placeholder="e.g. Main manual filleting line for red snapper. Two cutting benches feed one trimming table. Throughput drops when raw material arrives soft."
                  required
                />
              </FormField>
            </div>
            <div className="col-span-2 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label className="text-xs font-medium text-[var(--ink)]">Process tags</Label>
                <span className="text-xs text-[var(--muted)]">{selectedTags.length} selected</span>
              </div>
              <div className="flex flex-wrap gap-2 border border-[var(--line)] bg-[var(--surface-subtle)] p-3">
                {processTags.map((tag) => {
                  const isSelected = selectedTags.includes(tag.code);
                  return (
                    <button
                      aria-pressed={isSelected}
                      className={`border px-2 py-1 text-[11px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] ${
                        isSelected
                          ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                          : "border-[var(--line-strong)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--ink)]"
                      }`}
                      key={tag.code}
                      onClick={() => toggleTag(tag.code)}
                      title={tag.description}
                      type="button"
                    >
                      {tag.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-3 border-t border-[var(--line)] px-6 py-4 sm:justify-between sm:space-x-0">
            <DialogClose asChild>
              <Button className="rounded-none border-[var(--line-strong)] bg-[var(--surface)] text-[var(--muted)] shadow-none hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]" type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button className="rounded-none bg-[var(--brand)] text-white shadow-none hover:bg-[var(--brand-strong)]" type="submit">
              Create line
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type AddMachineDialogProps = {
  lineName: string;
  onAddMachine: (values: CreateMachineInput) => void;
};

export function AddMachineDialog({ lineName, onAddMachine }: Readonly<AddMachineDialogProps>) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Machine["status"]>("operational");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const model = String(data.get("machine-model") ?? "").trim();
    const notes = String(data.get("machine-notes") ?? "").trim();

    onAddMachine({
      name: String(data.get("machine-name") ?? ""),
      model: model.length > 0 ? model : undefined,
      status,
      notes: notes.length > 0 ? notes : undefined
    });
    event.currentTarget.reset();
    setStatus("operational");
    setOpen(false);
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button
          className="h-auto rounded-none border-[var(--line-strong)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--brand)] shadow-none hover:bg-[var(--brand-soft)]"
          type="button"
          variant="outline"
        >
          <Plus aria-hidden="true" size={14} strokeWidth={1.75} />
          Add machine
        </Button>
      </DialogTrigger>
      <DialogContent className={`${dialogClass} max-w-[34rem]`}>
        <DialogHeader className="border-b border-[var(--line)] px-6 py-5 text-left">
          <p className="text-xs font-medium text-[var(--brand)]">Equipment</p>
          <DialogTitle className="mt-1 text-xl font-semibold tracking-tight text-[var(--ink)]">Add machine to {lineName}</DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Equipment on a line becomes part of its saved operational context.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-x-5 gap-y-4 px-6 py-5">
            <FormField id="machine-name" label="Machine name">
              <Input className={inputClass} id="machine-name" name="machine-name" placeholder="e.g. Blast freezer A" required />
            </FormField>
            <FormField hint="Optional" id="machine-model" label="Model">
              <Input className={inputClass} id="machine-model" name="machine-model" placeholder="e.g. Freddo BF-800" />
            </FormField>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-[var(--ink)]" htmlFor="machine-status">Status</Label>
              <Select onValueChange={(value: Machine["status"]) => setStatus(value)} value={status}>
                <SelectTrigger className={selectClass} id="machine-status"><SelectValue /></SelectTrigger>
                <SelectContent className={selectContentClass}>
                  <SelectItem className={selectItemClass} value="operational">Operational</SelectItem>
                  <SelectItem className={selectItemClass} value="maintenance">Maintenance</SelectItem>
                  <SelectItem className={selectItemClass} value="offline">Offline</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <FormField hint="Optional" id="machine-notes" label="Operational notes">
                <Input className={inputClass} id="machine-notes" name="machine-notes" placeholder="e.g. Calibrated monthly" />
              </FormField>
            </div>
          </div>
          <DialogFooter className="gap-3 border-t border-[var(--line)] px-6 py-4 sm:justify-between sm:space-x-0">
            <DialogClose asChild>
              <Button className="rounded-none border-[var(--line-strong)] bg-[var(--surface)] text-[var(--muted)] shadow-none hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]" type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button className="rounded-none bg-[var(--brand)] text-white shadow-none hover:bg-[var(--brand-strong)]" type="submit">
              Add machine
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FormField({ children, hint, id, label }: Readonly<{ children: ReactNode; hint?: string; id: string; label: string }>) {
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
