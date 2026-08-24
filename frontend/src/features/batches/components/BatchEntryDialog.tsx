"use client";

import { useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { AlertCircle, ArrowLeft, LoaderCircle, Plus, Radio, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ProductConfig, ProductionSite } from "@/types/domain";
import { addSiteProductConfig } from "@/features/processing-config/api/processing-config.api";
import { extractBatchText, type BatchTextExtraction, type CreateBatchInput } from "../api/batches.api";

const inputClass = "h-10 rounded-none border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)] placeholder:text-[var(--muted)] focus-visible:ring-[var(--focus)]";
const selectClass = "h-10 rounded-none border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)] focus:ring-[var(--focus)]";
const selectContentClass = "rounded-none border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)]";
const selectItemClass = "rounded-none focus:bg-[var(--brand-soft)] focus:text-[var(--ink)]";
const SHIFTS = ["Morning", "Afternoon", "Night"];
const SIZE_CATEGORIES = ["Small", "Medium", "Large"];
type Outputs = { sellable?: number; byproduct?: number; trimming?: number; reject?: number; spoilage?: number; other?: number };
type Props = { sites: ProductionSite[]; productConfigs: ProductConfig[]; onCreateBatch: (values: CreateBatchInput) => Promise<void>; isSaving: boolean };

const emptyOutputs = (): Outputs => ({});
const numberOrUndefined = (value: string) => value.trim() === "" ? undefined : (Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : undefined);
const numberValue = (value: number | undefined) => value === undefined ? "" : String(value);
const sameText = (left: string | undefined, right: string | undefined) => left?.trim().toLocaleLowerCase() === right?.trim().toLocaleLowerCase();

export function BatchEntryDialog({ isSaving, onCreateBatch, productConfigs, sites }: Readonly<Props>) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"describe" | "review">("describe");
  const [message, setMessage] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string>();
  const [ambiguities, setAmbiguities] = useState<string[]>([]);
  const [siteId, setSiteId] = useState("");
  const [lineIds, setLineIds] = useState<string[]>([]);
  const [configId, setConfigId] = useState("");
  const [shift, setShift] = useState("");
  const [sizeCategory, setSizeCategory] = useState("");
  const [supplier, setSupplier] = useState("");
  const [deliveryDelay, setDeliveryDelay] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [notes, setNotes] = useState("");
  const [inputKg, setInputKg] = useState<number>();
  const [outputs, setOutputs] = useState<Outputs>(emptyOutputs);
  const [addedConfigs, setAddedConfigs] = useState<ProductConfig[]>([]);
  const [newSpecies, setNewSpecies] = useState("");
  const [newProductSpec, setNewProductSpec] = useState("");
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [productError, setProductError] = useState<string>();

  const site = sites.find((candidate) => candidate.id === siteId);
  const availableConfigs = [...productConfigs, ...addedConfigs];
  const siteConfigs = availableConfigs.filter((config) => config.productionSiteId === site?.id);
  const selectedConfig = siteConfigs.find((config) => config.id === configId);
  const balance = useMemo(() => {
    const accounted = (outputs.sellable ?? 0) + (outputs.byproduct ?? 0) + (outputs.trimming ?? 0) + (outputs.reject ?? 0) + (outputs.spoilage ?? 0) + (outputs.other ?? 0);
    const unexplained = Math.round(((inputKg ?? 0) - accounted) * 10) / 10;
    return { accounted: Math.round(accounted * 10) / 10, unexplained, yieldPct: inputKg && outputs.sellable !== undefined ? Math.round((outputs.sellable / inputKg) * 1000) / 10 : undefined };
  }, [inputKg, outputs]);

  function reset() {
    setStep("describe"); setMessage(""); setExtractionError(undefined); setAmbiguities([]); setSiteId(""); setLineIds([]); setConfigId(""); setShift(""); setSizeCategory(""); setSupplier(""); setDeliveryDelay(""); setRejectReason(""); setNotes(""); setInputKg(undefined); setOutputs(emptyOutputs()); setAddedConfigs([]); setNewSpecies(""); setNewProductSpec(""); setProductError(undefined);
  }
  function close() { setOpen(false); reset(); }
  function toggleLine(lineId: string) { setLineIds((current) => current.includes(lineId) ? current.filter((value) => value !== lineId) : [...current, lineId]); }
  function applyExtraction(extraction: BatchTextExtraction) {
    const fields = extraction.fields;
    const matchedSite = sites.find((candidate) => sameText(candidate.name, fields.manufacturingSiteName));
    const matchingConfig = availableConfigs.find((candidate) => candidate.productionSiteId === matchedSite?.id && sameText(candidate.species, fields.species) && sameText(candidate.productSpec, fields.productSpecification));
    setSiteId(matchedSite?.id ?? "");
    setLineIds((matchedSite?.lines ?? []).filter((line) => fields.productionLineNames?.some((name) => sameText(name, line.name))).map((line) => line.id));
    setConfigId(matchingConfig?.id ?? "");
    setShift(fields.shift ?? "");
    setSupplier(fields.supplier ?? "");
    setSizeCategory(fields.fishSizeCategory ?? "");
    setDeliveryDelay(fields.deliveryDelayMinutes === undefined ? "" : String(fields.deliveryDelayMinutes));
    setRejectReason(fields.receivingCondition ?? "");
    setNotes(fields.operatorNotes ?? "");
    setInputKg(fields.rawInputKg);
    setOutputs({ sellable: fields.sellableOutputKg, byproduct: fields.byproductKg, trimming: fields.trimmingKg, reject: fields.qualityRejectKg, spoilage: fields.spoilageKg, other: fields.otherLossKg });
    setAmbiguities(extraction.ambiguities);
  }
  async function addProductForSite() {
    if (!site || !newSpecies.trim() || !newProductSpec.trim()) return;
    setIsAddingProduct(true); setProductError(undefined);
    try {
      await addSiteProductConfig(site.id, { species: newSpecies.trim(), productSpecification: newProductSpec.trim() });
      const config: ProductConfig = { id: `local-${site.id}-${newSpecies}-${newProductSpec}`, productionSiteId: site.id, species: newSpecies.trim(), productSpec: newProductSpec.trim(), chilledOrFrozen: /frozen/i.test(newProductSpec) ? "frozen" : "chilled", observedMedianYieldPct: 0, sampleSize: 0, massBalanceTolerancePct: 2 };
      setAddedConfigs((current) => [...current, config]); setConfigId(config.id); setNewSpecies(""); setNewProductSpec("");
    } catch (cause) { setProductError(cause instanceof Error ? cause.message : "Could not add the fish product."); }
    finally { setIsAddingProduct(false); }
  }
  async function summarise() {
    if (!message.trim()) return;
    setIsExtracting(true); setExtractionError(undefined);
    try { applyExtraction(await extractBatchText(message)); setStep("review"); }
    catch (cause) { setExtractionError(cause instanceof Error ? cause.message : "Could not summarise this batch."); }
    finally { setIsExtracting(false); }
  }
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!site || !selectedConfig || lineIds.length === 0 || !shift || inputKg === undefined) return;
    await onCreateBatch({ productionSiteId: site.id, productionLineIds: lineIds, species: selectedConfig.species, productSpec: selectedConfig.productSpec, shift, supplier: supplier.trim() || undefined, fishSizeCategory: sizeCategory || undefined, deliveryDelayMinutes: numberOrUndefined(deliveryDelay), rejectReason: rejectReason.trim() || undefined, notes: notes.trim() || undefined, rawInputKg: inputKg, sellableOutputKg: outputs.sellable, normalByproductKg: outputs.byproduct, trimmingKg: outputs.trimming, qualityRejectKg: outputs.reject, spoilageKg: outputs.spoilage, otherLossKg: outputs.other });
    close();
  }

  return <Dialog onOpenChange={(nextOpen) => { if (!nextOpen) reset(); setOpen(nextOpen); }} open={open}>
    <DialogTrigger asChild><Button className="h-auto rounded-none bg-[var(--brand)] px-3 py-2 text-white shadow-none hover:bg-[var(--brand-strong)]" type="button"><Plus aria-hidden="true" size={15} strokeWidth={1.75} /> Add batch</Button></DialogTrigger>
    <DialogContent className="max-h-[calc(100dvh-4rem)] max-w-[56rem] gap-0 overflow-y-auto rounded-none border-[var(--line-strong)] bg-[var(--surface)] p-0 shadow-[0_24px_64px_-32px_rgb(19_56_82_/_55%)]">
      <DialogHeader className="border-b border-[var(--line)] px-6 py-5 text-left"><p className="text-xs font-medium text-[var(--brand)]">New batch report · Step {step === "describe" ? "1" : "2"} of 2</p><DialogTitle className="mt-1 text-xl font-semibold tracking-tight text-[var(--ink)]">{step === "describe" ? "Describe the batch" : "Review batch details"}</DialogTitle><DialogDescription className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">{step === "describe" ? "Write naturally in Indonesian or English. LAUT fills only information it can identify, then you review every field." : "Review the extracted details, complete blanks, and save the result as a draft. Nothing is confirmed automatically."}</DialogDescription></DialogHeader>
      {step === "describe" ? <div className="space-y-5 px-6 py-6">
        <div className="border border-[var(--line)] bg-[var(--surface-subtle)] px-4 py-3 text-sm leading-6 text-[var(--muted)]"><Sparkles aria-hidden="true" className="mr-2 inline text-[var(--brand)]" size={16} />Example: <span className="text-[var(--ink)]">Tadi pagi saya proses tuna fillet beku. Bahan bakunya 100 kg, hasil jual 70 kg. Ada trimming 10 kg, reject 5 kg, produk samping 10 kg, spoilage 3 kg, dan kehilangan lainnya 2 kg.</span></div>
        <div className="space-y-2"><Label className="text-xs font-medium text-[var(--ink)]" htmlFor="batch-description">Informal batch description</Label><Textarea autoFocus className="min-h-40 resize-y rounded-none border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)] placeholder:text-[var(--muted)] focus-visible:ring-[var(--focus)]" id="batch-description" onChange={(event) => setMessage(event.target.value)} placeholder="Ceritakan batch ini seperti Anda mengirim pesan ke rekan kerja…" value={message} /><p className="text-xs leading-5 text-[var(--muted)]">The AI does not calculate, complete, or invent values. You can edit everything on the next step.</p></div>
        {extractionError ? <p className="flex items-start gap-2 border border-[var(--risk-line)] bg-[var(--risk-soft)] px-3 py-2 text-xs leading-5 text-[var(--risk)]" role="alert"><AlertCircle aria-hidden="true" size={15} />{extractionError}</p> : null}
        <div className="flex flex-wrap justify-between gap-3 border-t border-[var(--line)] pt-5"><Button className="rounded-none" onClick={close} type="button" variant="outline">Cancel</Button><div className="flex gap-3"><Button className="rounded-none" onClick={() => setStep("review")} type="button" variant="outline">Enter manually</Button><Button className="rounded-none bg-[var(--brand)] text-white hover:bg-[var(--brand-strong)]" disabled={!message.trim() || isExtracting} onClick={summarise} type="button">{isExtracting ? <><LoaderCircle aria-hidden="true" className="animate-spin" size={15} /> Summarising…</> : <><Sparkles aria-hidden="true" size={15} /> Summarise & review</>}</Button></div></div>
      </div> : <form onSubmit={handleSubmit}>
        {ambiguities.length > 0 ? <div className="border-b border-[var(--line)] bg-[var(--surface-subtle)] px-6 py-3 text-xs leading-5 text-[var(--muted)]"><span className="font-medium text-[var(--ink)]">Check before saving:</span> {ambiguities.join("; ")}</div> : null}
        <fieldset className="border-b border-[var(--line)] px-6 py-5"><legend className="text-xs font-medium text-[var(--muted)]">Where it ran</legend><div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-4"><div className="space-y-2"><Label className="text-xs font-medium text-[var(--ink)]" htmlFor="batch-site">Production site</Label><Select onValueChange={(value) => { setSiteId(value); setLineIds([]); setConfigId(""); }} value={siteId}><SelectTrigger className={selectClass} id="batch-site"><SelectValue placeholder="Choose site" /></SelectTrigger><SelectContent className={selectContentClass}>{sites.map((option) => <SelectItem className={selectItemClass} key={option.id} value={option.id}>{option.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label className="text-xs font-medium text-[var(--ink)]" htmlFor="batch-config">Species and specification</Label><Select onValueChange={setConfigId} value={configId}><SelectTrigger className={selectClass} id="batch-config"><SelectValue placeholder="Choose product" /></SelectTrigger><SelectContent className={selectContentClass}>{siteConfigs.map((config) => <SelectItem className={selectItemClass} key={config.id} value={config.id}>{config.species} · {config.productSpec}</SelectItem>)}</SelectContent></Select></div><div className="col-span-2 border border-[var(--line)] bg-[var(--surface-subtle)] p-3"><p className="text-xs font-medium text-[var(--ink)]">New fish product for this site</p><div className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-2"><Input className={inputClass} onChange={(event) => setNewSpecies(event.target.value)} placeholder="Species, e.g. Tuna" value={newSpecies} /><Input className={inputClass} onChange={(event) => setNewProductSpec(event.target.value)} placeholder="Specification, e.g. Frozen loin" value={newProductSpec} /><Button className="h-10 rounded-none" disabled={!site || !newSpecies.trim() || !newProductSpec.trim() || isAddingProduct} onClick={addProductForSite} type="button" variant="outline">{isAddingProduct ? "Adding…" : "Add"}</Button></div>{productError ? <p className="mt-2 text-xs text-[var(--risk)]" role="alert">{productError}</p> : null}</div><div className="col-span-2 space-y-2"><div className="flex items-center justify-between gap-3"><Label className="text-xs font-medium text-[var(--ink)]">Production lines used</Label><span className="text-xs text-[var(--muted)]">{lineIds.length === 0 ? "Select at least one" : `${lineIds.length} selected`}</span></div><div className="flex flex-wrap gap-2 border border-[var(--line)] bg-[var(--surface-subtle)] p-3">{(site?.lines ?? []).map((line) => { const isSelected = lineIds.includes(line.id); return <button aria-pressed={isSelected} className={`border px-2.5 py-1.5 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] ${isSelected ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line-strong)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--ink)]"}`} key={line.id} onClick={() => toggleLine(line.id)} title={line.description} type="button">{line.name}</button>; })}</div></div></div></fieldset>
        <fieldset className="border-b border-[var(--line)] px-6 py-5"><legend className="text-xs font-medium text-[var(--muted)]">Context</legend><div className="mt-3 grid grid-cols-4 gap-x-5 gap-y-4"><div className="space-y-2"><Label className="text-xs font-medium text-[var(--ink)]" htmlFor="batch-shift">Shift</Label><Select onValueChange={setShift} value={shift}><SelectTrigger className={selectClass} id="batch-shift"><SelectValue placeholder="Choose shift" /></SelectTrigger><SelectContent className={selectContentClass}>{SHIFTS.map((option) => <SelectItem className={selectItemClass} key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select></div><Field hint="Optional" id="supplier" label="Supplier"><Input className={inputClass} id="supplier" onChange={(event) => setSupplier(event.target.value)} placeholder="e.g. Mina Segara" value={supplier} /></Field><div className="space-y-2"><Label className="text-xs font-medium text-[var(--ink)]" htmlFor="batch-size">Fish size</Label><Select onValueChange={setSizeCategory} value={sizeCategory}><SelectTrigger className={selectClass} id="batch-size"><SelectValue placeholder="Optional" /></SelectTrigger><SelectContent className={selectContentClass}>{SIZE_CATEGORIES.map((option) => <SelectItem className={selectItemClass} key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select></div><Field hint="Minutes" id="delivery-delay" label="Delivery delay"><Input className={inputClass} id="delivery-delay" min="0" onChange={(event) => setDeliveryDelay(event.target.value)} placeholder="Optional" step="1" type="number" value={deliveryDelay} /></Field></div></fieldset>
        <fieldset className="px-6 py-5"><div className="flex items-center justify-between gap-4"><legend className="text-xs font-medium text-[var(--muted)]">Measured weights</legend><span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--muted)]"><Radio aria-hidden="true" size={12} strokeWidth={1.75} /> IoT scale capture planned</span></div><div className="mt-3 grid grid-cols-3 gap-x-5 gap-y-4"><Field id="raw-input" label="Raw-material input"><Input className={inputClass} id="raw-input" min="0" onChange={(event) => setInputKg(numberOrUndefined(event.target.value))} placeholder="kg" required step="0.1" type="number" value={numberValue(inputKg)} /></Field><WeightField id="sellable-output" label="Sellable fillet" onChange={(value) => setOutputs((current) => ({ ...current, sellable: value }))} value={outputs.sellable} /><WeightField id="byproduct" label="Normal by-product" onChange={(value) => setOutputs((current) => ({ ...current, byproduct: value }))} value={outputs.byproduct} /><WeightField id="trimming" label="Trimming" onChange={(value) => setOutputs((current) => ({ ...current, trimming: value }))} value={outputs.trimming} /><WeightField id="quality-reject" label="Quality reject" onChange={(value) => setOutputs((current) => ({ ...current, reject: value }))} value={outputs.reject} /><WeightField hint="0 if none" id="spoilage" label="Spoilage / damage" onChange={(value) => setOutputs((current) => ({ ...current, spoilage: value }))} value={outputs.spoilage} /><WeightField hint="0 if none" id="other-loss" label="Other loss" onChange={(value) => setOutputs((current) => ({ ...current, other: value }))} value={outputs.other} /><Field hint="Optional" id="reject-reason" label="Reject reason"><Input className={inputClass} id="reject-reason" onChange={(event) => setRejectReason(event.target.value)} placeholder="e.g. Soft flesh" value={rejectReason} /></Field><div className="col-span-2"><Field hint="Optional" id="notes" label="Operator notes"><Textarea className="min-h-[2.5rem] resize-none rounded-none border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)] placeholder:text-[var(--muted)] focus-visible:ring-[var(--focus)]" id="notes" onChange={(event) => setNotes(event.target.value)} placeholder="Anything unusual about this batch" value={notes} /></Field></div></div></fieldset>
        <div className="grid grid-cols-3 divide-x divide-[var(--line)] border-y border-[var(--line)] bg-[var(--surface-subtle)]"><Summary label="Estimated sellable yield" value={balance.yieldPct === undefined ? "Awaiting output" : `${balance.yieldPct}%`} /><Summary label="Accounted for" value={`${balance.accounted} kg`} /><Summary label="Unexplained" tone={balance.unexplained > 0 ? "risk" : "default"} value={inputKg !== undefined ? `${balance.unexplained} kg` : "—"} /></div>
        <DialogFooter className="gap-3 px-6 py-4 sm:justify-between sm:space-x-0"><p className="max-w-md text-xs leading-5 text-[var(--muted)]">Values are saved as a draft and remain outside comparable history until confirmation.</p><div className="flex gap-3"><Button className="rounded-none" disabled={isSaving} onClick={() => setStep("describe")} type="button" variant="outline"><ArrowLeft aria-hidden="true" size={15} /> Edit description</Button><Button className="rounded-none bg-[var(--brand)] text-white hover:bg-[var(--brand-strong)] disabled:opacity-45" disabled={isSaving || !site || !selectedConfig || lineIds.length === 0 || !shift || inputKg === undefined} type="submit">{isSaving ? <><LoaderCircle aria-hidden="true" className="animate-spin" size={15} /> Saving…</> : "Save as draft"}</Button></div></DialogFooter>
      </form>}
    </DialogContent>
  </Dialog>;
}

function WeightField({ hint, id, label, onChange, value }: Readonly<{ hint?: string; id: string; label: string; onChange: (value: number | undefined) => void; value: number | undefined }>) { return <Field hint={hint} id={id} label={label}><Input className={inputClass} id={id} min="0" onChange={(event) => onChange(numberOrUndefined(event.target.value))} placeholder="kg" step="0.1" type="number" value={numberValue(value)} /></Field>; }
function Field({ children, hint, id, label }: Readonly<{ children: ReactNode; hint?: string; id: string; label: string }>) { return <div className="space-y-2"><div className="flex items-center justify-between gap-3"><Label className="text-xs font-medium text-[var(--ink)]" htmlFor={id}>{label}</Label>{hint ? <span className="text-xs text-[var(--muted)]">{hint}</span> : null}</div>{children}</div>; }
function Summary({ label, tone = "default", value }: Readonly<{ label: string; tone?: "default" | "risk"; value: string }>) { return <div className="px-6 py-4"><p className="text-xs text-[var(--muted)]">{label}</p><p className={`mt-1 font-mono text-sm font-semibold ${tone === "risk" ? "text-[var(--risk)]" : "text-[var(--ink)]"}`}>{value}</p></div>; }
