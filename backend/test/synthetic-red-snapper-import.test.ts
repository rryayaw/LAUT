import assert from "node:assert/strict";
import test from "node:test";
import { syntheticRedSnapperDataset } from "../src/features/synthetic-data/synthetic-red-snapper.dataset.js";
import { mapSyntheticCapabilityTags, validateSyntheticRedSnapperDataset } from "../src/features/synthetic-data/synthetic-red-snapper-import.service.js";

test("the synthetic red snapper fixture is complete and mass balanced", () => {
  assert.deepEqual(validateSyntheticRedSnapperDataset(), { batchCount: 360 });
  assert.equal(syntheticRedSnapperDataset.batches[0]?.sourceBatchId, "BATCH-0001");
});

test("only production-line process tags become LAUT capability tags", () => {
  assert.deepEqual(
    mapSyntheticCapabilityTags(["Receiving", "Sorting", "Filleting", "Trimming", "Quality control"]),
    ["filleting", "trimming", "quality_control"]
  );
});
