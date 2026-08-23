import assert from "node:assert/strict";
import test from "node:test";
import { assessProductionEvidence, type AnalysisEvidence } from "../src/features/batch-analysis/production-analysis.graph.js";

function evidence(overrides: Partial<AnalysisEvidence> = {}): AnalysisEvidence {
  return {
    batchId: "batch",
    rawInputKg: 100,
    sellableOutputKg: 70,
    sellableYieldPercent: 70,
    knownLossPercent: 30,
    massBalanceDifferenceKg: 0,
    comparableYields: [80, 81, 82],
    comparableCount: 3,
    sharedContext: [],
    batchContext: {
      batchReference: null, productionDate: null, species: "tuna", productSpecification: "fillet beku",
      lossBreakdownKg: {}, supplier: null, shift: null, fishSizeCategory: null, storageState: null,
      receivingCondition: null, receivingTemperatureC: null, deliveryDelayMinutes: null,
      productionDurationMinutes: null, operatorNotes: null
    },
    productionLines: [],
    comparableBatches: [],
    ...overrides
  };
}

test("analysis labels a sufficiently lower yield as below baseline", () => {
  const assessment = assessProductionEvidence(evidence());

  assert.equal(assessment.status, "below_baseline");
  assert.equal(assessment.comparableAverageYieldPercent, 81);
  assert.equal(assessment.yieldDifferencePercentagePoints, -11);
});

test("analysis refuses a baseline label without three comparables", () => {
  const assessment = assessProductionEvidence(evidence({ comparableYields: [80, 81], comparableCount: 2 }));

  assert.equal(assessment.status, "insufficient_history");
  assert.equal(assessment.comparableAverageYieldPercent, null);
});
