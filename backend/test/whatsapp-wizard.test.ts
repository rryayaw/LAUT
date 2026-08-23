import assert from "node:assert/strict";
import test from "node:test";
import { nextMissingBatchField, type WizardDraft } from "../src/features/whatsapp/batch-wizard.service.js";
import { InMemoryMessageDeduplicator } from "../src/features/whatsapp/in-memory-message-deduplicator.js";

test("the wizard asks only the first missing batch field", () => {
  const draft: WizardDraft = {
    manufacturingSiteId: "site",
    productionLineIds: ["line"],
    species: "tuna",
    rawInputKg: 100,
    sellableOutputKg: 70,
    trimmingKg: 10,
    qualityRejectKg: 5,
    byproductKg: 10,
    spoilageKg: 3,
    otherLossKg: 2
  };

  assert.deepEqual(nextMissingBatchField(draft)?.slice(0, 2), ["awaiting_product_specification", "productSpecification"]);
});

test("a duplicate inbound message is claimed once and can be released for retry", () => {
  const deduplicator = new InMemoryMessageDeduplicator();

  assert.equal(deduplicator.claim("message-1"), true);
  assert.equal(deduplicator.claim("message-1"), false);
  deduplicator.release("message-1");
  assert.equal(deduplicator.claim("message-1"), true);
});
