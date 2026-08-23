import { prisma } from "../../db/prisma.js";
import { validateBatch, type BatchDatabaseRow } from "../batch-reporting/batch-reporting.routes.js";
import { closeConversation, saveConversation, type WhatsAppConversation } from "./whatsapp-conversation.service.js";

type WizardStep =
  | "awaiting_intent" | "awaiting_site" | "awaiting_lines" | "awaiting_species" | "awaiting_product_specification"
  | "awaiting_raw_input" | "awaiting_sellable_output" | "awaiting_trimming" | "awaiting_quality_reject"
  | "awaiting_byproduct" | "awaiting_spoilage" | "awaiting_other_loss" | "awaiting_review";

type WizardDraft = {
  manufacturingSiteId?: string;
  productionLineIds?: string[];
  species?: string;
  productSpecification?: string;
  rawInputKg?: number;
  sellableOutputKg?: number;
  trimmingKg?: number;
  qualityRejectKg?: number;
  byproductKg?: number;
  spoilageKg?: number;
  otherLossKg?: number;
};

type WizardReply = { text: string; close?: boolean };
type Row = Record<string, unknown>;

const START_COMMANDS = new Set(["tambah batch", "tambah", "start batch", "start", "batch baru"]);
const CANCEL_COMMANDS = new Set(["batal", "cancel"]);
const STEPS: Array<[WizardStep, keyof WizardDraft, string]> = [
  ["awaiting_species", "species", "Jenis ikan apa? Contoh: tuna."],
  ["awaiting_product_specification", "productSpecification", "Spesifikasi produk apa? Contoh: fillet beku."],
  ["awaiting_raw_input", "rawInputKg", "Berapa bahan baku? Kirim angka dalam kg, contoh: 100."],
  ["awaiting_sellable_output", "sellableOutputKg", "Berapa hasil jual? Kirim angka dalam kg."],
  ["awaiting_trimming", "trimmingKg", "Berapa trimming? Kirim angka dalam kg; kirim 0 bila tidak ada."],
  ["awaiting_quality_reject", "qualityRejectKg", "Berapa reject kualitas? Kirim angka dalam kg; kirim 0 bila tidak ada."],
  ["awaiting_byproduct", "byproductKg", "Berapa produk samping? Kirim angka dalam kg; kirim 0 bila tidak ada."],
  ["awaiting_spoilage", "spoilageKg", "Berapa spoilage? Kirim angka dalam kg; kirim 0 bila tidak ada."],
  ["awaiting_other_loss", "otherLossKg", "Berapa kehilangan lain? Kirim angka dalam kg; kirim 0 bila tidak ada."]
];

function database() {
  if (!prisma) throw new Error("Database access is not configured.");
  return prisma;
}

function draftOf(conversation: WhatsAppConversation): WizardDraft {
  return conversation.draft as WizardDraft;
}

function cleanText(text: string) {
  return text.trim().replace(/\s+/g, " ");
}

function parseMass(text: string): number | undefined {
  const normalized = text.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,3})?$/.test(normalized)) return undefined;
  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 && value <= 10_000_000 ? value : undefined;
}

async function sitesFor(profileId: string) {
  return database().$queryRawUnsafe<Array<{ id: string; name: string }>>(
    `select id, name from public.manufacturing_sites where owner_id = $1::uuid order by name`, profileId
  );
}

async function linesFor(profileId: string, siteId: string) {
  return database().$queryRawUnsafe<Array<{ id: string; name: string }>>(
    `select line.id, line.name
     from public.production_lines line join public.manufacturing_sites site on site.id = line.manufacturing_site_id
     where line.manufacturing_site_id = $1::uuid and line.is_active = true and site.owner_id = $2::uuid order by line.name`,
    siteId, profileId
  );
}

async function sitePrompt(profileId: string): Promise<WizardReply> {
  const sites = await sitesFor(profileId);
  if (sites.length === 0) return { text: "Tidak ada lokasi produksi aktif di akun LAUT Anda. Buat lokasi di web terlebih dahulu." };
  return { text: `Pilih lokasi produksi:\n${sites.map((site, index) => `${index + 1}. ${site.name}`).join("\n")}` };
}

async function linePrompt(profileId: string, siteId: string): Promise<WizardReply> {
  const lines = await linesFor(profileId, siteId);
  if (lines.length === 0) return { text: "Lokasi ini belum memiliki lini produksi aktif. Buat lini di web terlebih dahulu." };
  return { text: `Pilih satu atau beberapa lini (contoh: 1,2):\n${lines.map((line, index) => `${index + 1}. ${line.name}`).join("\n")}` };
}

function nextStep(step: WizardStep): [WizardStep, keyof WizardDraft, string] | undefined {
  const index = STEPS.findIndex(([candidate]) => candidate === step);
  return index === -1 ? undefined : STEPS[index + 1];
}

function review(draft: WizardDraft): WizardReply {
  const row: BatchDatabaseRow = {
    species: draft.species, product_specification: draft.productSpecification, raw_input_kg: draft.rawInputKg,
    sellable_output_kg: draft.sellableOutputKg, trimming_kg: draft.trimmingKg, quality_reject_kg: draft.qualityRejectKg,
    byproduct_kg: draft.byproductKg, spoilage_kg: draft.spoilageKg, other_loss_kg: draft.otherLossKg
  };
  const validation = validateBatch(row, draft.productionLineIds?.length ?? 0);
  const metrics = validation.metrics;
  const summary = [
    "Tinjau batch:", `Ikan: ${draft.species}`, `Produk: ${draft.productSpecification}`,
    `Bahan baku: ${draft.rawInputKg} kg`, `Hasil jual: ${draft.sellableOutputKg} kg`,
    `Trimming/reject/samping/spoilage/lain: ${draft.trimmingKg}/${draft.qualityRejectKg}/${draft.byproductKg}/${draft.spoilageKg}/${draft.otherLossKg} kg`,
    `Yield: ${metrics.sellableYieldPercent?.toFixed(2) ?? "-"}%`, `Selisih massa: ${metrics.massBalanceDifferenceKg?.toFixed(3) ?? "-"} kg`
  ];
  if (!validation.isReadyToConfirm) summary.push(`Belum siap: ${[...validation.errors, ...validation.warnings].join(" ")}`);
  summary.push(validation.isReadyToConfirm ? 'Balas "confirm" untuk menyimpan, "ubah <field>" untuk koreksi, atau "batal".' : 'Balas "ubah <field>" untuk koreksi atau "batal".');
  return { text: summary.join("\n") };
}

function stepForEdit(field: string): WizardStep | undefined {
  const aliases: Record<string, WizardStep> = {
    ikan: "awaiting_species", species: "awaiting_species", produk: "awaiting_product_specification", specification: "awaiting_product_specification",
    bahan: "awaiting_raw_input", raw: "awaiting_raw_input", hasil: "awaiting_sellable_output", output: "awaiting_sellable_output",
    trimming: "awaiting_trimming", reject: "awaiting_quality_reject", samping: "awaiting_byproduct", byproduct: "awaiting_byproduct",
    spoilage: "awaiting_spoilage", lain: "awaiting_other_loss", other: "awaiting_other_loss"
  };
  return aliases[field.toLowerCase()];
}

async function confirmBatch(profileId: string, draft: WizardDraft) {
  if (!draft.manufacturingSiteId || !draft.productionLineIds?.length) throw new Error("Batch location is incomplete.");
  const manufacturingSiteId = draft.manufacturingSiteId;
  const productionLineIds = draft.productionLineIds;
  const validation = validateBatch({
    species: draft.species, product_specification: draft.productSpecification, raw_input_kg: draft.rawInputKg,
    sellable_output_kg: draft.sellableOutputKg, trimming_kg: draft.trimmingKg, quality_reject_kg: draft.qualityRejectKg,
    byproduct_kg: draft.byproductKg, spoilage_kg: draft.spoilageKg, other_loss_kg: draft.otherLossKg
  }, draft.productionLineIds.length);
  if (!validation.isReadyToConfirm) return { validation };
  const db = database();
  const batchId = await db.$transaction(async (tx) => {
    const owned = await tx.$queryRawUnsafe<Row[]>(
      `select id from public.manufacturing_sites where id = $1::uuid and owner_id = $2::uuid`, manufacturingSiteId, profileId
    );
    if (!owned[0]) throw new Error("Manufacturing site was not found for the linked user.");
    const lineCount = await tx.$queryRawUnsafe<Array<{ count: number }>>(
      `select count(*)::int as count from public.production_lines where manufacturing_site_id = $1::uuid and is_active = true and id = any($2::uuid[])`,
      manufacturingSiteId, productionLineIds
    );
    if (lineCount[0]?.count !== productionLineIds.length) throw new Error("One or more selected production lines are unavailable.");
    const created = await tx.$queryRawUnsafe<Array<{ id: string }>>(
      `insert into public.production_batch (manufacturing_site_id, source_channel, species, product_specification, raw_input_kg, sellable_output_kg, trimming_kg, quality_reject_kg, byproduct_kg, spoilage_kg, other_loss_kg)
       values ($1::uuid, 'whatsapp', $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id`,
      manufacturingSiteId, draft.species!, draft.productSpecification!, draft.rawInputKg!, draft.sellableOutputKg!, draft.trimmingKg!, draft.qualityRejectKg!, draft.byproductKg!, draft.spoilageKg!, draft.otherLossKg!
    );
    const id = created[0]?.id;
    if (!id) throw new Error("Batch creation did not return an ID.");
    for (const lineId of productionLineIds) {
      await tx.$executeRawUnsafe(`insert into public.production_batch_lines (production_batch_id, production_line_id, manufacturing_site_id) values ($1::uuid, $2::uuid, $3::uuid)`, id, lineId, manufacturingSiteId);
    }
    await tx.$executeRawUnsafe(`update public.production_batch set status = 'confirmed', confirmed_at = now() where id = $1::uuid and status = 'draft'`, id);
    await tx.$executeRawUnsafe(
      `insert into public.production_batch_audit_events (production_batch_id, actor_user_id, event_type, metadata) values ($1::uuid, $2::uuid, 'confirmed', $3::jsonb)`,
      id, profileId, JSON.stringify({ validation, source: "whatsapp" })
    );
    return id;
  });
  return { batchId, validation };
}

export async function advanceBatchWizard(conversation: WhatsAppConversation, inboundText: string): Promise<WizardReply> {
  const input = cleanText(inboundText);
  const lower = input.toLowerCase();
  const draft = draftOf(conversation);
  let step = conversation.currentStep as WizardStep;

  if (CANCEL_COMMANDS.has(lower)) {
    await closeConversation(conversation.id);
    return { text: "Batch dibatalkan. Balas \"tambah batch\" untuk memulai lagi.", close: true };
  }
  if (START_COMMANDS.has(lower)) {
    conversation.currentStep = "awaiting_site";
    conversation.draft = {};
    await saveConversation(conversation);
    return sitePrompt(conversation.profileId);
  }
  if (step === "awaiting_intent") return { text: "Balas \"tambah batch\" untuk mencatat batch baru." };

  if (step === "awaiting_site") {
    const sites = await sitesFor(conversation.profileId);
    const selected = sites[Number(input) - 1];
    if (!selected) return { text: "Nomor lokasi tidak valid. " + (await sitePrompt(conversation.profileId)).text };
    draft.manufacturingSiteId = selected.id;
    conversation.currentStep = "awaiting_lines";
    await saveConversation(conversation);
    return linePrompt(conversation.profileId, selected.id);
  }
  if (step === "awaiting_lines") {
    if (!draft.manufacturingSiteId) throw new Error("Wizard site is missing.");
    const lines = await linesFor(conversation.profileId, draft.manufacturingSiteId);
    const indexes = input.split(",").map((part) => Number(part.trim()) - 1);
    const selected = indexes.map((index) => lines[index]).filter((line): line is { id: string; name: string } => Boolean(line));
    if (!selected.length || selected.length !== indexes.length || new Set(selected.map((line) => line.id)).size !== selected.length) {
      return { text: "Pilih nomor lini yang valid, misalnya 1 atau 1,2." };
    }
    draft.productionLineIds = selected.map((line) => line.id);
    conversation.currentStep = "awaiting_species";
    await saveConversation(conversation);
    return { text: STEPS[0][2] };
  }
  if (step === "awaiting_review") {
    if (lower === "confirm") {
      const result = await confirmBatch(conversation.profileId, draft);
      if ("batchId" in result) {
        await closeConversation(conversation.id);
        return { text: `Batch berhasil dikonfirmasi (${result.batchId}). Data terkunci dan tercatat dalam riwayat LAUT.`, close: true };
      }
      return review(draft);
    }
    const edit = /^ubah\s+(.+)$/i.exec(input);
    const editStep = edit ? stepForEdit(edit[1]) : undefined;
    if (!editStep) return { text: 'Balas "confirm", "ubah <field>", atau "batal".' };
    conversation.currentStep = editStep;
    await saveConversation(conversation);
    return { text: STEPS.find(([candidate]) => candidate === editStep)![2] };
  }

  const definition = STEPS.find(([candidate]) => candidate === step);
  if (!definition) throw new Error("Unknown WhatsApp wizard step.");
  const [, field, prompt] = definition;
  if (field === "species" || field === "productSpecification") {
    if (!input || input.length > 2_000) return { text: "Masukkan teks yang valid. " + prompt };
    draft[field] = input;
  } else {
    const value = parseMass(input);
    if (value === undefined) return { text: "Masukkan angka kg yang valid, misalnya 12.5." };
    (draft as Record<string, unknown>)[field] = value;
  }
  const next = nextStep(step);
  if (!next) {
    conversation.currentStep = "awaiting_review";
    await saveConversation(conversation);
    return review(draft);
  }
  conversation.currentStep = next[0];
  await saveConversation(conversation);
  return { text: next[2] };
}
