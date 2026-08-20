"use client";

import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProductionLineStatus } from "../placeholder/production-sites-data";

export function AddProductionSiteDialog({ onAddSite }: Readonly<{ onAddSite: (values: { location: string; name: string }) => void }>) {
  const [open, setOpen] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onAddSite({ location: String(data.get("location") ?? ""), name: String(data.get("site-name") ?? "") });
    event.currentTarget.reset();
    setOpen(false);
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild><Button className="h-auto rounded-none bg-[var(--brand)] px-3 py-2 text-white shadow-none hover:bg-[var(--brand-strong)]" type="button"><Plus aria-hidden="true" size={15} strokeWidth={1.75} />Add production site</Button></DialogTrigger>
      <DialogContent className="max-w-[32rem] gap-0 rounded-none border-[var(--line-strong)] bg-[var(--surface)] p-0 shadow-[0_24px_64px_-32px_rgb(19_56_82_/_55%)]">
        <DialogHeader className="border-b border-[var(--line)] px-6 py-5 text-left"><p className="text-xs font-medium text-[var(--brand)]">Site setup</p><DialogTitle className="mt-1 text-xl font-semibold tracking-tight text-[var(--ink)]">Add production site</DialogTitle><DialogDescription className="mt-2 text-sm leading-6 text-[var(--muted)]">Create a local site profile, then add the production lines that operate there.</DialogDescription></DialogHeader>
        <form onSubmit={handleSubmit}><div className="space-y-4 px-6 py-5"><FormField id="site-name" label="Production site name"><Input className="h-10 rounded-none border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)] focus-visible:ring-[var(--focus)]" id="site-name" name="site-name" placeholder="e.g. Muara Baru Plant" required /></FormField><FormField id="location" label="Location"><Input className="h-10 rounded-none border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)] focus-visible:ring-[var(--focus)]" id="location" name="location" placeholder="e.g. Muara Baru, Jakarta" required /></FormField></div><DialogFooter className="gap-3 border-t border-[var(--line)] px-6 py-4 sm:justify-between sm:space-x-0"><DialogClose asChild><Button className="rounded-none border-[var(--line-strong)] bg-[var(--surface)] text-[var(--muted)] shadow-none hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]" type="button" variant="outline">Cancel</Button></DialogClose><Button className="rounded-none bg-[var(--brand)] text-white shadow-none hover:bg-[var(--brand-strong)]" type="submit">Create site</Button></DialogFooter></form>
      </DialogContent>
    </Dialog>
  );
}

export function AddProductionLineDialog({ onAddLine }: Readonly<{ onAddLine: (values: { name: string; status: ProductionLineStatus; tags: string[] }) => void }>) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ProductionLineStatus>("active");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const tags = String(data.get("line-tags") ?? "").split(",").map((tag) => tag.trim()).filter(Boolean);
    onAddLine({ name: String(data.get("line-name") ?? ""), status, tags });
    event.currentTarget.reset();
    setStatus("active");
    setOpen(false);
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild><Button className="h-auto rounded-none bg-[var(--brand)] px-3 py-2 text-white shadow-none hover:bg-[var(--brand-strong)]" type="button"><Plus aria-hidden="true" size={15} strokeWidth={1.75} />Add production line</Button></DialogTrigger>
      <DialogContent className="max-w-[34rem] gap-0 rounded-none border-[var(--line-strong)] bg-[var(--surface)] p-0 shadow-[0_24px_64px_-32px_rgb(19_56_82_/_55%)]">
        <DialogHeader className="border-b border-[var(--line)] px-6 py-5 text-left"><p className="text-xs font-medium text-[var(--brand)]">Line setup</p><DialogTitle className="mt-1 text-xl font-semibold tracking-tight text-[var(--ink)]">Add production line</DialogTitle><DialogDescription className="mt-2 text-sm leading-6 text-[var(--muted)]">Describe the work performed on the line so future batch comparisons have clear operational context.</DialogDescription></DialogHeader>
        <form onSubmit={handleSubmit}><div className="grid grid-cols-2 gap-4 px-6 py-5"><FormField id="line-name" label="Production line name"><Input className="h-10 rounded-none border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)] focus-visible:ring-[var(--focus)]" id="line-name" name="line-name" placeholder="e.g. Line 4B" required /></FormField><div className="space-y-2"><Label className="text-xs font-medium text-[var(--ink)]" htmlFor="line-status">Line status</Label><Select onValueChange={(value: ProductionLineStatus) => setStatus(value)} value={status}><SelectTrigger className="h-10 rounded-none border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)] focus:ring-[var(--focus)]" id="line-status"><SelectValue /></SelectTrigger><SelectContent className="rounded-none border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)]"><SelectItem className="rounded-none focus:bg-[var(--brand-soft)] focus:text-[var(--ink)]" value="active">Active</SelectItem><SelectItem className="rounded-none focus:bg-[var(--brand-soft)] focus:text-[var(--ink)]" value="paused">Paused</SelectItem><SelectItem className="rounded-none focus:bg-[var(--brand-soft)] focus:text-[var(--ink)]" value="maintenance">Maintenance</SelectItem></SelectContent></Select></div><div className="col-span-2"><FormField hint="Separate tags with commas" id="line-tags" label="Line process tags"><Input className="h-10 rounded-none border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)] focus-visible:ring-[var(--focus)]" id="line-tags" name="line-tags" placeholder="e.g. Cutting, Packaging" required /></FormField></div></div><DialogFooter className="gap-3 border-t border-[var(--line)] px-6 py-4 sm:justify-between sm:space-x-0"><DialogClose asChild><Button className="rounded-none border-[var(--line-strong)] bg-[var(--surface)] text-[var(--muted)] shadow-none hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]" type="button" variant="outline">Cancel</Button></DialogClose><Button className="rounded-none bg-[var(--brand)] text-white shadow-none hover:bg-[var(--brand-strong)]" type="submit">Create line</Button></DialogFooter></form>
      </DialogContent>
    </Dialog>
  );
}

function FormField({ children, hint, id, label }: Readonly<{ children: ReactNode; hint?: string; id: string; label: string }>) {
  return <div className="space-y-2"><div className="flex items-center justify-between gap-3"><Label className="text-xs font-medium text-[var(--ink)]" htmlFor={id}>{label}</Label>{hint ? <span className="text-xs text-[var(--muted)]">{hint}</span> : null}</div>{children}</div>;
}
