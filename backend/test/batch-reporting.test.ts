import assert from "node:assert/strict";
import test from "node:test";
import { validateBatch } from "../src/features/batch-reporting/batch-reporting.routes.js";

test("a complete balanced batch is ready to confirm", () => {
  const validation = validateBatch({
    species: "tuna",
    product_specification: "fillet beku",
    raw_input_kg: 100,
    sellable_output_kg: 70,
    trimming_kg: 10,
    quality_reject_kg: 5,
    byproduct_kg: 10,
    spoilage_kg: 3,
    other_loss_kg: 2
  }, 1);

  assert.equal(validation.isReadyToConfirm, true);
  assert.equal(validation.metrics.sellableYieldPercent, 70);
  assert.equal(validation.metrics.massBalanceDifferenceKg, 0);
});

test("an unbalanced batch cannot be confirmed", () => {
  const validation = validateBatch({
    species: "tuna",
    product_specification: "fillet beku",
    raw_input_kg: 100,
    sellable_output_kg: 80,
    trimming_kg: 10,
    quality_reject_kg: 5,
    byproduct_kg: 10,
    spoilage_kg: 3,
    other_loss_kg: 2
  }, 1);

  assert.equal(validation.isReadyToConfirm, false);
  assert.match(validation.errors.join(" "), /exceeds raw input/i);
});

test("a missing mass stays a warning instead of becoming an inferred value", () => {
  const validation = validateBatch({
    species: "tuna",
    product_specification: "fillet beku",
    raw_input_kg: 100,
    sellable_output_kg: 70,
    trimming_kg: 10,
    quality_reject_kg: null,
    byproduct_kg: 10,
    spoilage_kg: 3,
    other_loss_kg: 2
  }, 1);

  assert.equal(validation.isReadyToConfirm, false);
  assert.match(validation.warnings.join(" "), /quality_reject_kg/);
});
