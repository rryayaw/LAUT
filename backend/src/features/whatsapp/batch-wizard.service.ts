import { prisma } from "../../db/prisma.js";
import { analyzeAndSaveBatch, formatWhatsAppAnalysisSummary } from "../batch-analysis/batch-analysis.service.js";
import { validateBatch, type BatchDatabaseRow } from "../batch-reporting/batch-reporting.routes.js";
import { extractBatchCandidates, type BatchExtraction } from "./batch-extraction.service.js";
import { closeConversation, saveConversation, type WhatsAppConversation } from "./whatsapp-conversation.service.js";

type WizardStep =
  | "awaiting_intent" | "awaiting_site" | "awaiting_lines" | "awaiting_batch_details" | "awaiting_species" | "awaiting_product_specification"
  | "awaiting_product_config_consent"
  | "awaiting_raw_input" | "awaiting_sellable_output" | "awaiting_trimming" | "awaiting_quality_reject"
  | "awaiting_byproduct" | "awaiting_spoilage" | "awaiting_other_loss" | "awaiting_review";

export type WizardDraft = {
  manufacturingSiteId?: string;
  productionLineIds?: string[];
  species?: string;
  productSpecification?: string;
  productConfigAdditionApproved?: boolean;
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
const CANCEL_HINT = "_Bisa batal kapan saja dengan balas *batal*._";

const START_COMMANDS = new Set(["tambah batch", "tambah", "start batch", "start", "batch baru"]);
const CANCEL_COMMANDS = new Set(["batal", "cancel"]);
const COMPLETE_BATCH_PROMPT = `Ceritakan batch ini dengan santai dalam satu pesan—tidak perlu mengikuti format khusus. Misalnya:

"Tadi pagi kami proses tuna fillet beku. Bahan baku 100 kg, hasil jual 70 kg, trimming 10 kg, reject 5 kg, produk samping 10 kg, spoilage 3 kg, dan kehilangan lain 2 kg."

Kalau ada informasi yang belum tertulis, saya akan menanyakannya satu per satu.

Kalau lebih nyaman, Anda juga bisa memasukkan:

• Jenis ikan
• Spesifikasi produk
• Bahan baku (kg)
• Hasil jual (kg)
• Trimming (kg)
• Reject kualitas (kg)
• Produk samping (kg)
• Spoilage (kg)
• Kehilangan lain (kg)

Saya akan menanyakan hanya data yang masih kurang.

${CANCEL_HINT}`;
const FIELD_LABELS: Record<keyof WizardDraft, string> = {
  manufacturingSiteId: "lokasi produksi", productionLineIds: "lini produksi", species: "jenis ikan", productSpecification: "spesifikasi produk",
  productConfigAdditionApproved: "konfigurasi produk",
  rawInputKg: "bahan baku", sellableOutputKg: "hasil jual", trimmingKg: "trimming", qualityRejectKg: "reject kualitas",
  byproductKg: "produk samping", spoilageKg: "spoilage", otherLossKg: "kehilangan lain"
};
const STEPS: Array<[WizardStep, keyof WizardDraft, string]> = [
  ["awaiting_species", "species", "*Jenis ikan* apa yang diproses?\nContoh: tuna."],
  ["awaiting_product_specification", "productSpecification", "*Spesifikasi produknya* apa?\nContoh: fillet beku."],
  ["awaiting_raw_input", "rawInputKg", "Berapa *bahan baku* yang masuk?\nKirim angka dalam kg, misalnya: 100."],
  ["awaiting_sellable_output", "sellableOutputKg", "Berapa *hasil jual* yang didapat?\nKirim angka dalam kg."],
  ["awaiting_trimming", "trimmingKg", "Berapa *trimming*?\nKirim angka dalam kg, atau 0 bila tidak ada."],
  ["awaiting_quality_reject", "qualityRejectKg", "Berapa *reject kualitas*?\nKirim angka dalam kg, atau 0 bila tidak ada."],
  ["awaiting_byproduct", "byproductKg", "Berapa *produk samping*?\nKirim angka dalam kg, atau 0 bila tidak ada."],
  ["awaiting_spoilage", "spoilageKg", "Berapa *spoilage*?\nKirim angka dalam kg, atau 0 bila tidak ada."],
  ["awaiting_other_loss", "otherLossKg", "Berapa *kehilangan lain*?\nKirim angka dalam kg, atau 0 bila tidak ada."]
];

export function nextMissingBatchField(draft: WizardDraft) {
  return STEPS.find(([, field]) => draft[field] === undefined);
}

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

function withCancelHint(text: string) {
  return `${text}\n\n${CANCEL_HINT}`;
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

async function configuredProductsForSite(siteId: string) {
  return database().$queryRawUnsafe<Array<{ species: string; product_specification: string }>>(
    `select species, product_specification
       from public.site_product_configs
      where manufacturing_site_id = $1::uuid
      order by species, product_specification`,
    siteId
  );
}

function sameConfiguredText(left: string, right: string) {
  return left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase();
}

async function speciesPrompt(siteId: string): Promise<WizardReply> {
  const configurations = await configuredProductsForSite(siteId);
  const species = [...new Map(configurations.map((configuration) => [configuration.species.trim().toLocaleLowerCase(), configuration.species])).values()];
  const knownSpecies = species.length
    ? `\n\n*Jenis ikan yang sudah terdaftar di lokasi ini:*\n${species.map((name) => `• ${name}`).join("\n")}`
    : "\n\nBelum ada jenis ikan yang terdaftar di lokasi ini.";
  return { text: withCancelHint(`*Jenis ikan* apa yang diproses?${knownSpecies}\n\nKalau jenis ikannya belum ada, tulis saja—saya akan minta persetujuan untuk menambahkannya.`) };
}

async function productSpecificationPrompt(siteId: string, species: string): Promise<WizardReply> {
  const configurations = await configuredProductsForSite(siteId);
  const specifications = configurations
    .filter((configuration) => sameConfiguredText(configuration.species, species))
    .map((configuration) => configuration.product_specification);
  const knownSpecifications = specifications.length
    ? `\n\n*Spesifikasi produk ${species} yang sudah terdaftar:*\n${specifications.map((specification) => `• ${specification}`).join("\n")}`
    : `\n\nBelum ada spesifikasi produk untuk *${species}* di lokasi ini.`;
  return { text: withCancelHint(`*Spesifikasi produk* untuk ${species} apa?${knownSpecifications}\n\nKalau spesifikasinya baru, tulis saja—saya akan minta persetujuan untuk menambahkannya.`) };
}

async function promptForStep(step: WizardStep, draft: WizardDraft): Promise<WizardReply> {
  const definition = STEPS.find(([candidate]) => candidate === step);
  if (!definition) throw new Error("Unknown WhatsApp wizard step.");
  if (step === "awaiting_species" && draft.manufacturingSiteId) return speciesPrompt(draft.manufacturingSiteId);
  if (step === "awaiting_product_specification" && draft.manufacturingSiteId && draft.species) {
    return productSpecificationPrompt(draft.manufacturingSiteId, draft.species);
  }
  return { text: withCancelHint(definition[2]) };
}

/** Keeps chat-created batches on the same site product catalogue as the web form. */
async function promptForProductConfiguration(conversation: WhatsAppConversation, draft: WizardDraft): Promise<WizardReply | undefined> {
  if (!draft.manufacturingSiteId || !draft.species) return undefined;
  const configurations = await configuredProductsForSite(draft.manufacturingSiteId);
  const sameSpecies = configurations.filter((config) => sameConfiguredText(config.species, draft.species!));
  if (!draft.productSpecification && sameSpecies.length > 0) return undefined;
  const hasExactProduct = draft.productSpecification !== undefined
    && sameSpecies.some((config) => sameConfiguredText(config.product_specification, draft.productSpecification!));
  if (hasExactProduct) {
    delete draft.productConfigAdditionApproved;
    return undefined;
  }

  if (!draft.productConfigAdditionApproved) {
    const productLabel = draft.productSpecification ? `*${draft.species} · ${draft.productSpecification}*` : `*${draft.species}*`;
    conversation.currentStep = "awaiting_product_config_consent";
    await saveConversation(conversation);
    return {
      text: withCancelHint(`${productLabel} belum terdaftar untuk lokasi ini.\n\nApakah Anda ingin menambahkannya lalu melanjutkan batch? Balas *ya* atau *tidak*.`)
    };
  }

  if (!draft.productSpecification) {
    conversation.currentStep = "awaiting_product_specification";
    await saveConversation(conversation);
    return productSpecificationPrompt(draft.manufacturingSiteId, draft.species);
  }

  await database().$executeRawUnsafe(
    `insert into public.site_product_configs (manufacturing_site_id, species, product_specification)
     values ($1::uuid, $2, $3)
     on conflict do nothing`,
    draft.manufacturingSiteId,
    draft.species,
    draft.productSpecification
  );
  delete draft.productConfigAdditionApproved;
  return undefined;
}

async function sitePrompt(profileId: string): Promise<WizardReply> {
  const sites = await sitesFor(profileId);
  if (sites.length === 0) return { text: "Belum ada *lokasi produksi aktif* di akun LAUT Anda.\n\nTambahkan lokasi melalui web terlebih dahulu." };
  return { text: withCancelHint(`*Pilih lokasi produksi*\n\n${sites.map((site, index) => `${index + 1}. ${site.name}`).join("\n")}\n\nBalas dengan nomornya.`) };
}

async function linePrompt(profileId: string, siteId: string): Promise<WizardReply> {
  const lines = await linesFor(profileId, siteId);
  if (lines.length === 0) return { text: "Lokasi ini belum memiliki *lini produksi aktif*.\n\nTambahkan lini melalui web terlebih dahulu." };
  return { text: withCancelHint(`*Pilih lini produksi*\n\n${lines.map((line, index) => `${index + 1}. ${line.name}`).join("\n")}\n\nBalas satu nomor, atau beberapa nomor seperti: 1,2.`) };
}

function exactNameMatch<T extends { name: string }>(items: T[], value: string): T | undefined {
  const normalized = value.trim().toLocaleLowerCase();
  return items.find((item) => item.name.trim().toLocaleLowerCase() === normalized);
}

async function applyExtraction(conversation: WhatsAppConversation, draft: WizardDraft, extraction: BatchExtraction): Promise<string[]> {
  const accepted: string[] = [];
  const fields = extraction.fields;
  const simpleFields = ["species", "productSpecification", "rawInputKg", "sellableOutputKg", "trimmingKg", "qualityRejectKg", "byproductKg", "spoilageKg", "otherLossKg"] as const;
  for (const field of simpleFields) {
    const value = fields[field];
    if (value !== undefined) {
      (draft as Record<string, unknown>)[field] = value;
      accepted.push(field);
    }
  }
  if (fields.manufacturingSiteName) {
    const site = exactNameMatch(await sitesFor(conversation.profileId), fields.manufacturingSiteName);
    if (site) {
      draft.manufacturingSiteId = site.id;
      accepted.push("manufacturingSite");
    }
  }
  if (fields.productionLineNames?.length && draft.manufacturingSiteId) {
    const availableLines = await linesFor(conversation.profileId, draft.manufacturingSiteId);
    const matched = fields.productionLineNames.map((name) => exactNameMatch(availableLines, name));
    if (matched.every((line): line is { id: string; name: string } => Boolean(line)) && new Set(matched.map((line) => line.id)).size === matched.length) {
      draft.productionLineIds = matched.map((line) => line.id);
      accepted.push("productionLineIds");
    }
  }
  if (extraction.language !== "unknown") conversation.language = extraction.language;
  return accepted;
}

async function promptForMissing(conversation: WhatsAppConversation, draft: WizardDraft): Promise<WizardReply> {
  if (!draft.manufacturingSiteId) {
    conversation.currentStep = "awaiting_site";
    await saveConversation(conversation);
    return sitePrompt(conversation.profileId);
  }
  if (!draft.productionLineIds?.length) {
    conversation.currentStep = "awaiting_lines";
    await saveConversation(conversation);
    return linePrompt(conversation.profileId, draft.manufacturingSiteId);
  }
  const productConfigurationReply = await promptForProductConfiguration(conversation, draft);
  if (productConfigurationReply) return productConfigurationReply;
  const missing = nextMissingBatchField(draft);
  if (missing) {
    conversation.currentStep = missing[0];
    await saveConversation(conversation);
    return promptForStep(missing[0], draft);
  }
  conversation.currentStep = "awaiting_review";
  await saveConversation(conversation);
  return review(draft);
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
    "*Ringkasan batch*", "", `• Ikan: ${draft.species}`, `• Produk: ${draft.productSpecification}`,
    `• Bahan baku: ${draft.rawInputKg} kg`, `• Hasil jual: ${draft.sellableOutputKg} kg`,
    `• Trimming: ${draft.trimmingKg} kg`, `• Reject kualitas: ${draft.qualityRejectKg} kg`,
    `• Produk samping: ${draft.byproductKg} kg`, `• Spoilage: ${draft.spoilageKg} kg`, `• Kehilangan lain: ${draft.otherLossKg} kg`, "",
    `*Yield:* ${metrics.sellableYieldPercent?.toFixed(2) ?? "-"}%`, `*Selisih massa:* ${metrics.massBalanceDifferenceKg?.toFixed(3) ?? "-"} kg`
  ];
  if (!validation.isReadyToConfirm) summary.push(`Belum siap: ${[...validation.errors, ...validation.warnings].join(" ")}`);
  summary.push(validation.isReadyToConfirm ? '\nJika sudah benar, balas *confirm*.\nUntuk koreksi, balas *ubah <field>*. Untuk berhenti, balas *batal*.' : '\nPerbaiki data dengan *ubah <field>*, atau balas *batal* untuk berhenti.');
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

async function confirmBatch(profileId: string, draft: WizardDraft, sourceChannel: "whatsapp" | "web") {
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
    const configuredProduct = await tx.$queryRawUnsafe<Array<{ id: string }>>(
      `select id from public.site_product_configs
        where manufacturing_site_id = $1::uuid
          and lower(species) = lower($2)
          and lower(product_specification) = lower($3)
        limit 1`,
      manufacturingSiteId,
      draft.species!,
      draft.productSpecification!
    );
    if (!configuredProduct[0]) throw new Error("This species and product specification are not configured for the selected site.");
    const created = await tx.$queryRawUnsafe<Array<{ id: string }>>(
      `insert into public.production_batch (manufacturing_site_id, source_channel, species, product_specification, raw_input_kg, sellable_output_kg, trimming_kg, quality_reject_kg, byproduct_kg, spoilage_kg, other_loss_kg)
       values ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning id`,
      manufacturingSiteId, sourceChannel, draft.species!, draft.productSpecification!, draft.rawInputKg!, draft.sellableOutputKg!, draft.trimmingKg!, draft.qualityRejectKg!, draft.byproductKg!, draft.spoilageKg!, draft.otherLossKg!
    );
    const id = created[0]?.id;
    if (!id) throw new Error("Batch creation did not return an ID.");
    for (const lineId of productionLineIds) {
      await tx.$executeRawUnsafe(`insert into public.production_batch_lines (production_batch_id, production_line_id, manufacturing_site_id) values ($1::uuid, $2::uuid, $3::uuid)`, id, lineId, manufacturingSiteId);
    }
    await tx.$executeRawUnsafe(`update public.production_batch set status = 'confirmed', confirmed_at = now() where id = $1::uuid and status = 'draft'`, id);
    await tx.$executeRawUnsafe(
      `insert into public.production_batch_audit_events (production_batch_id, actor_user_id, event_type, metadata) values ($1::uuid, $2::uuid, 'confirmed', $3::jsonb)`,
      id, profileId, JSON.stringify({ validation, source: sourceChannel })
    );
    return id;
  });
  return { batchId, validation };
}

export async function advanceBatchWizard(conversation: WhatsAppConversation, inboundText: string, sourceChannel: "whatsapp" | "web" = "whatsapp"): Promise<WizardReply> {
  const input = cleanText(inboundText);
  const lower = input.toLowerCase();
  let draft = draftOf(conversation);
  let step = conversation.currentStep as WizardStep;

  if (CANCEL_COMMANDS.has(lower)) {
    await closeConversation(conversation.id);
    return { text: "*Batch dibatalkan.*\n\nJika ingin mulai lagi, balas *tambah batch*.", close: true };
  }
  if (START_COMMANDS.has(lower)) {
    conversation.currentStep = "awaiting_batch_details";
    conversation.draft = {};
    await saveConversation(conversation);
    return { text: COMPLETE_BATCH_PROMPT };
  }
  const extraction = await extractBatchCandidates(conversation, input);
  let startedByAi = false;
  if (step === "awaiting_intent" && extraction?.intent === "start_batch") {
    conversation.draft = {};
    draft = draftOf(conversation);
    step = "awaiting_batch_details";
    startedByAi = true;
  }
  if (extraction) {
    const accepted = await applyExtraction(conversation, draft, extraction);
    if (accepted.length > 0) {
      const next = await promptForMissing(conversation, draft);
      const fieldNames: Record<string, string> = { manufacturingSite: "lokasi", ...FIELD_LABELS };
      const ambiguity = extraction.ambiguities.length ? `\nPerlu dicek: ${extraction.ambiguities.join("; ")}` : "";
      return { text: `*Saya catat:*\n• ${accepted.map((field) => fieldNames[field]).join("\n• ")}.${ambiguity}\n\n${next.text}` };
    }
  }
  if (startedByAi) {
    conversation.currentStep = "awaiting_batch_details";
    await saveConversation(conversation);
    return { text: COMPLETE_BATCH_PROMPT };
  }
  if (step === "awaiting_intent") return { text: `Halo${conversation.profileName ? `, ${conversation.profileName}` : ""}! 👋\n\nSelamat datang di *LAUT*. Mau mencatat batch baru?\n\nBalas *tambah batch* untuk mulai.\nBalas *batal* kapan saja untuk menghentikan proses.` };

  if (step === "awaiting_site") {
    const sites = await sitesFor(conversation.profileId);
    const selected = sites[Number(input) - 1];
    if (!selected) return { text: "Nomor lokasi belum sesuai.\n\n" + (await sitePrompt(conversation.profileId)).text };
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
      return { text: "Nomor lini belum sesuai.\n\nKirim satu nomor, atau beberapa nomor seperti: 1,2." };
    }
    draft.productionLineIds = selected.map((line) => line.id);
    conversation.currentStep = "awaiting_batch_details";
    await saveConversation(conversation);
    return { text: COMPLETE_BATCH_PROMPT };
  }
  if (step === "awaiting_batch_details") {
    return promptForMissing(conversation, draft);
  }
  if (step === "awaiting_review") {
    if (lower === "confirm") {
      const result = await confirmBatch(conversation.profileId, draft, sourceChannel);
      if (typeof result.batchId === "string") {
        await closeConversation(conversation.id);
        const confirmation = `*Batch berhasil dikonfirmasi* ✅\n\nID batch: ${result.batchId}\nData sudah dikunci dan tercatat di riwayat LAUT.`;
        try {
          const analysis = await analyzeAndSaveBatch(conversation.profileId, result.batchId);
          return { text: `${confirmation}\n\n${formatWhatsAppAnalysisSummary(analysis)}`, close: true };
        } catch (error) {
          console.error("WhatsApp batch analysis failed after confirmation.", error);
          return { text: `${confirmation}\n\n_Analisis awal belum tersedia. Anda dapat melihat batch ini di LAUT._`, close: true };
        }
      }
      return review(draft);
    }
    const edit = /^ubah\s+(.+)$/i.exec(input);
    const editStep = edit ? stepForEdit(edit[1]) : undefined;
    if (!editStep) return { text: 'Balas *confirm* untuk menyimpan, *ubah <field>* untuk koreksi, atau *batal* untuk berhenti.' };
    conversation.currentStep = editStep;
    await saveConversation(conversation);
    return { text: withCancelHint(STEPS.find(([candidate]) => candidate === editStep)![2]) };
  }

  if (step === "awaiting_product_config_consent") {
    if (["ya", "yes", "y"].includes(lower)) {
      draft.productConfigAdditionApproved = true;
      return promptForMissing(conversation, draft);
    }
    if (["tidak", "no", "n"].includes(lower)) {
      delete draft.species;
      delete draft.productSpecification;
      delete draft.productConfigAdditionApproved;
      conversation.currentStep = "awaiting_species";
      await saveConversation(conversation);
      return speciesPrompt(draft.manufacturingSiteId!);
    }
    return { text: "Balas *ya* untuk menambahkan produk ke lokasi ini, atau *tidak* untuk memilih produk lain." };
  }

  const definition = STEPS.find(([candidate]) => candidate === step);
  if (!definition) throw new Error("Unknown WhatsApp wizard step.");
  const [, field, prompt] = definition;
  if (field === "species" || field === "productSpecification") {
    if (!input || input.length > 2_000) return { text: "Mohon kirim teks yang valid.\n\n" + prompt };
    draft[field] = input;
    const productConfigurationReply = await promptForProductConfiguration(conversation, draft);
    if (productConfigurationReply) return productConfigurationReply;
  } else {
    const value = parseMass(input);
    if (value === undefined) return { text: "Mohon kirim angka kg yang valid.\nContoh: 12,5" };
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
  return promptForStep(next[0], draft);
}
