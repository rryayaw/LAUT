"use client";

// Corrects the reported weights on a draft.
//
// The backend accepts changes only while a batch is a draft, and refuses to
// confirm one until every mass field is reported and the accounted mass fits
// inside the raw input. Both rules are shown live here so a correction can be
// checked before it is saved rather than after it is rejected.

import { useMemo, useState, type FormEvent } from "react";
import { LoaderCircle, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import type { BatchListItem, BatchQuantities } from "@/types/domain";

type EditQuantitiesDialogProps = {
  batch: BatchListItem;
  onSave: (batchId: string, quantities: Partial<BatchQuantities>) => Promise<void>;
  isSaving: boolean;
};

const inputClass =
  "h-10 rounded-none border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)] placeholder:text-[var(--muted)] focus-visible:ring-[var(--focus)]";

/** The six fields the backend requires before a draft can be confirmed. */
const LOSS_FIELDS = [
  { key: "sellableOutputKg", label: "Sellable fillet" },
  { key: "normalByproductKg", label: "Normal by-product" },
  { key: "trimmingKg", label: "Trimming" },
  { key: "qualityRejectKg", label: "Quality reject" },
  { key: "spoilageKg", label: "Spoilage / damage" },
  { key: "otherLossKg", label: "Other loss" }
] as const satisfies ReadonlyArray<{ key: keyof BatchQuantities; label: string }>;

type Draft = Record<string, string>;

function toDraft(quantities: BatchQuantities): Draft {
  const draft: Draft = { rawInputKg: String(quantities.rawInputKg ?? "") };
  for (const field of LOSS_FIELDS) {
    const value = quantities[field.key];
    draft[field.key] = value === undefined ? "" : String(value);
  }
  return draft;
}

function parse(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function EditQuantitiesDialog({ batch, isSaving, onSave }: Readonly<EditQuantitiesDialogProps>) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => toDraft(batch.quantities));

  const balance = useMemo(() => {
    const rawInputKg = parse(draft.rawInputKg) ?? 0;
    const values = LOSS_FIELDS.map((field) => parse(draft[field.key]));
    const missing = LOSS_FIELDS.filter((field, index) => values[index] === undefined).map((field) => field.label);
    const accounted = Math.round(values.reduce<number>((total, value) => total + (value ?? 0), 0) * 10) / 10;
    const difference = Math.round((rawInputKg - accounted) * 10) / 10;

    return {
      rawInputKg,
      accounted,
      difference,
      missing,
      exceedsInput: difference < 0,
      canConfirm: missing.length === 0 && rawInputKg > 0 && difference >= 0
    };
  }, [draft]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Only fields the operator actually filled are sent; an empty box stays
    // unreported rather than being silently recorded as zero.
    const quantities: Partial<BatchQuantities> = { rawInputKg: parse(draft.rawInputKg) };
    for (const field of LOSS_FIELDS) quantities[field.key] = parse(draft[field.key]);

    await onSave(batch.id, quantities);
    setOpen(false);
  }

  function openChange(next: boolean) {
    // Reopening should show what is saved, not an abandoned edit.
    if (next) setDraft(toDraft(batch.quantities));
    setOpen(next);
  }

  return (
    <Dialog onOpenChange={openChange} open={open}>
      <DialogTrigger asChild>
        <Button
          className="h-auto w-full rounded-none border-[var(--line-strong)] bg-[var(--surface)] px-3 py-2 text-[var(--brand)] shadow-none hover:bg-[var(--brand-soft)]"
          type="button"
          variant="outline"
        >
          <PencilLine aria-hidden="true" size={15} strokeWidth={1.75} />
          Edit reported weights
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[38rem] gap-0 rounded-none border-[var(--line-strong)] bg-[var(--canvas)] p-0">
        <DialogHeader className="border-b border-[var(--line)] px-6 py-5 text-left">
          <p className="text-xs font-medium text-[var(--brand)]">Draft correction</p>
          <DialogTitle className="mt-1 text-xl font-semibold tracking-tight text-[var(--ink)]">
            Edit weights for {batch.code}
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Weights can only be changed while a batch is a draft. Once it is confirmed it becomes trusted history and
            is read-only.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5">
            <div className="grid grid-cols-3 gap-x-5 gap-y-4">
              <NumberField
                id="edit-raw-input"
                label="Raw-material input"
                onChange={(value) => setDraft((current) => ({ ...current, rawInputKg: value }))}
                value={draft.rawInputKg}
              />
              {LOSS_FIELDS.map((field) => (
                <NumberField
                  hint={draft[field.key].trim() === "" ? "Unreported" : undefined}
                  id={`edit-${field.key}`}
                  key={field.key}
                  label={field.label}
                  onChange={(value) => setDraft((current) => ({ ...current, [field.key]: value }))}
                  value={draft[field.key]}
                />
              ))}
            </div>

            <div className="mt-5 border-t border-[var(--line)] pt-4">
              <div className="grid grid-cols-3 gap-4 text-xs">
                <Figure label="Raw input" value={`${balance.rawInputKg} kg`} />
                <Figure label="Accounted" value={`${balance.accounted} kg`} />
                <Figure
                  label={balance.exceedsInput ? "Over input by" : "Unexplained"}
                  tone={balance.exceedsInput ? "risk" : undefined}
                  value={`${Math.abs(balance.difference)} kg`}
                />
              </div>

              <p className="mt-3 text-[11px] leading-4 text-[var(--muted)]">
                {balance.exceedsInput
                  ? `More mass is accounted for than went in. Reduce a loss figure or raise the raw input by ${Math.abs(balance.difference)} kg before this can be confirmed.`
                  : balance.missing.length > 0
                    ? `Still unreported: ${balance.missing.join(", ")}. Enter 0 where a category genuinely had none — a blank box is treated as "not measured", not as zero.`
                    : "Every category is reported and the mass balances. This draft is ready to confirm."}
              </p>
            </div>
          </div>

          <DialogFooter className="flex-row items-center justify-between gap-3 border-t border-[var(--line)] px-6 py-4">
            <span className="text-[11px] text-[var(--muted)]">
              {balance.canConfirm ? "Ready to confirm after saving" : "Saving is allowed; confirming is not yet"}
            </span>
            <Button
              className="h-auto rounded-none bg-[var(--brand)] px-4 py-2 text-white shadow-none hover:bg-[var(--brand-strong)]"
              disabled={isSaving}
              type="submit"
            >
              {isSaving ? <><LoaderCircle aria-hidden="true" className="animate-spin" size={15} /> Saving…</> : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type NumberFieldProps = {
  id: string;
  label: string;
  value: string;
  hint?: string;
  onChange: (value: string) => void;
};

function NumberField({ hint, id, label, onChange, value }: Readonly<NumberFieldProps>) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <Label className="text-xs font-medium text-[var(--ink)]" htmlFor={id}>
          {label}
        </Label>
        {hint ? <span className="text-[10px] text-[var(--muted)]">{hint}</span> : null}
      </div>
      <Input
        className={`${inputClass} mt-1.5`}
        id={id}
        min="0"
        onChange={(event) => onChange(event.target.value)}
        placeholder="kg"
        step="0.1"
        type="number"
        value={value}
      />
    </div>
  );
}

function Figure({ label, tone, value }: Readonly<{ label: string; value: string; tone?: "risk" }>) {
  return (
    <div>
      <p className="text-[var(--muted)]">{label}</p>
      <p className={`mt-0.5 font-mono text-sm font-semibold ${tone === "risk" ? "text-[var(--risk)]" : "text-[var(--ink)]"}`}>
        {value}
      </p>
    </div>
  );
}

