import { prisma } from "../../db/prisma.js";
import { syntheticRedSnapperDataset } from "./synthetic-red-snapper.dataset.js";
import { randomUUID } from "node:crypto";

const DATASET_SITE_TIMEZONE = "Asia/Jakarta";
const DATASET_SOURCE = "LAUT_synthetic_red_snapper_dataset.xlsx";
const SOURCE_TAG_TO_CAPABILITY_CODE: Record<string, string> = {
  Filleting: "filleting",
  Trimming: "trimming",
  Deboning: "deboning",
  "Quality control": "quality_control",
  Packaging: "packaging",
  Freezing: "freezing"
};

type SyntheticBatch = (typeof syntheticRedSnapperDataset.batches)[number];

export function mapSyntheticCapabilityTags(processTags: readonly string[]) {
  return [...new Set(processTags.flatMap((tag) => {
    const code = SOURCE_TAG_TO_CAPABILITY_CODE[tag];
    return code ? [code] : [];
  }))];
}

export function validateSyntheticRedSnapperDataset() {
  const seenBatchIds = new Set<string>();

  for (const batch of syntheticRedSnapperDataset.batches) {
    if (!batch.sourceBatchId || seenBatchIds.has(batch.sourceBatchId)) {
      throw new Error(`Synthetic dataset contains a missing or duplicate batch ID: ${batch.sourceBatchId}`);
    }
    seenBatchIds.add(batch.sourceBatchId);

    const values = [
      batch.rawInputKg,
      batch.sellableOutputKg,
      batch.byproductKg,
      batch.trimmingKg,
      batch.qualityRejectKg,
      batch.spoilageKg,
      batch.otherLossKg
    ];
    if (values.some((value) => !Number.isFinite(value) || value < 0)) {
      throw new Error(`Synthetic batch ${batch.sourceBatchId} contains an invalid weight.`);
    }

    const accountedKg = batch.sellableOutputKg + batch.byproductKg + batch.trimmingKg
      + batch.qualityRejectKg + batch.spoilageKg + batch.otherLossKg;
    if (Math.abs(batch.rawInputKg - accountedKg) > 0.01) {
      throw new Error(`Synthetic batch ${batch.sourceBatchId} does not balance.`);
    }
  }

  return { batchCount: syntheticRedSnapperDataset.batches.length };
}

function importReference(batch: SyntheticBatch) {
  return `SYNTHETIC-RED-SNAPPER:${batch.sourceBatchId}`;
}

export async function importSyntheticRedSnapperDataset(email: string) {
  if (!prisma) throw new Error("DATABASE_URL is required to import synthetic data.");
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) throw new Error("A target profile email is required.");

  const validation = validateSyntheticRedSnapperDataset();
  const profile = await prisma.profile.findFirst({
    where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    select: { id: true, email: true }
  });
  if (!profile) throw new Error(`No profile exists for ${normalizedEmail}.`);

  return prisma.$transaction(async (tx) => {
    let site = await tx.manufacturingSite.findFirst({
      where: { ownerId: profile.id, name: syntheticRedSnapperDataset.siteName }
    });
    if (!site) {
      site = await tx.manufacturingSite.create({
        data: {
        ownerId: profile.id,
        name: syntheticRedSnapperDataset.siteName,
        timezone: DATASET_SITE_TIMEZONE
        }
      });
    }

    const lineDefinitions = new Map<string, { name: string; processTags: string[] }>();
    for (const batch of syntheticRedSnapperDataset.batches) {
      const existing = lineDefinitions.get(batch.sourceLineId);
      lineDefinitions.set(batch.sourceLineId, {
        name: batch.lineName,
        processTags: [...new Set([...(existing?.processTags ?? []), ...batch.processTags])]
      });
    }

    const linesBySourceId = new Map<string, string>();
    for (const [sourceLineId, lineDefinition] of lineDefinitions) {
      const line = await tx.productionLine.upsert({
        where: {
          manufacturingSiteId_name: {
            manufacturingSiteId: site.id,
            name: `Synthetic — ${lineDefinition.name}`
          }
        },
        update: {
          description: `Synthetic test line. Source process stages: ${lineDefinition.processTags.join(", ")}.`
        },
        create: {
          manufacturingSiteId: site.id,
          name: `Synthetic — ${lineDefinition.name}`,
          description: `Synthetic test line. Source process stages: ${lineDefinition.processTags.join(", ")}.`
        }
      });
      linesBySourceId.set(sourceLineId, line.id);

      const codes = mapSyntheticCapabilityTags(lineDefinition.processTags);
      const tags = await tx.capabilityTag.findMany({ where: { code: { in: codes } }, select: { id: true, code: true } });
      if (tags.length !== codes.length) {
        throw new Error(`Capability tag configuration is incomplete for ${lineDefinition.name}.`);
      }
      await tx.productionLineCapabilityTag.createMany({
        data: tags.map((tag) => ({ productionLineId: line.id, capabilityTagId: tag.id })),
        skipDuplicates: true
      });
    }

    const references = syntheticRedSnapperDataset.batches.map(importReference);
    const existing = await tx.productionBatch.findMany({
      where: { manufacturingSiteId: site.id, batchReference: { in: references } },
      select: { batchReference: true }
    });
    const existingReferences = new Set(existing.flatMap((batch) => batch.batchReference ? [batch.batchReference] : []));
    const batchesToInsert = syntheticRedSnapperDataset.batches.filter((batch) => !existingReferences.has(importReference(batch)));
    const timestamp = new Date();
    const imported = batchesToInsert.map((batch) => ({ batch, id: randomUUID() }));

    await tx.productionBatch.createMany({
      data: imported.map(({ batch, id }) => ({
          id,
          manufacturingSiteId: site.id,
          status: "confirmed",
          sourceChannel: "import",
          batchReference: importReference(batch),
          productionDate: new Date(`${batch.productionDate}T00:00:00.000Z`),
          species: batch.species,
          productSpecification: batch.productSpecification,
          rawInputKg: batch.rawInputKg,
          sellableOutputKg: batch.sellableOutputKg,
          byproductKg: batch.byproductKg,
          trimmingKg: batch.trimmingKg,
          qualityRejectKg: batch.qualityRejectKg,
          spoilageKg: batch.spoilageKg,
          otherLossKg: batch.otherLossKg,
          supplier: batch.supplier,
          shift: batch.shift,
          receivingCondition: batch.receivingCondition,
          receivingTemperatureC: batch.receivingTemperatureC,
          deliveryDelayMinutes: batch.deliveryDelayMinutes,
          productionDurationMinutes: batch.productionDurationMinutes,
          confirmedAt: timestamp
      }))
    });
    await tx.productionBatchLine.createMany({
      data: imported.map(({ batch, id }) => ({
        productionBatchId: id,
        productionLineId: linesBySourceId.get(batch.sourceLineId)!,
        manufacturingSiteId: site.id,
        sequence: 1
      }))
    });
    await tx.productionBatchAuditEvent.createMany({
      data: imported.map(({ batch, id }) => ({
        productionBatchId: id,
        actorUserId: profile.id,
        eventType: "imported_confirmed",
        metadata: {
            synthetic: true,
            source: DATASET_SOURCE,
            sourceBatchId: batch.sourceBatchId,
            mapping: {
              normal_byproduct_kg: "byproduct_kg",
              unexplained_difference_kg: "other_loss_kg"
            }
        }
      }))
    });

    return {
      ...validation,
      siteId: site.id,
      inserted: imported.length,
      skipped: syntheticRedSnapperDataset.batches.length - imported.length,
      lineCount: linesBySourceId.size
    };
  }, { maxWait: 10_000, timeout: 120_000 });
}
