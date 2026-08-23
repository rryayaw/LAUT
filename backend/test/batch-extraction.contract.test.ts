import assert from "node:assert/strict";
import test from "node:test";
import { batchExtractionSchema } from "../src/features/whatsapp/batch-extraction.service.js";

test("an informal batch candidate can contain several explicitly stated fields", () => {
  const result = batchExtractionSchema.parse({
    intent: "provide_batch_data",
    language: "id",
    tone: "casual",
    fields: {
      species: "tuna",
      productSpecification: "fillet beku",
      rawInputKg: 100,
      sellableOutputKg: 70,
      trimmingKg: 10,
      qualityRejectKg: 5,
      byproductKg: 10,
      spoilageKg: 3,
      otherLossKg: 2
    },
    ambiguities: []
  });

  assert.equal(result.fields.species, "tuna");
  assert.equal(result.fields.otherLossKg, 2);
});

test("the extraction contract rejects out-of-bounds production values", () => {
  const result = batchExtractionSchema.safeParse({
    intent: "provide_batch_data",
    language: "id",
    tone: "casual",
    fields: { rawInputKg: -1 },
    ambiguities: []
  });

  assert.equal(result.success, false);
});
