import assert from "node:assert/strict";
import test from "node:test";
import "dotenv/config";

const runHostedTests = process.env.RUN_HOSTED_INTEGRATION_TESTS === "true";
const backendUrl = process.env.TEST_BACKEND_URL ?? "http://localhost:8000";
const accessToken = process.env.TEST_SUPABASE_ACCESS_TOKEN;

async function api(path: string, init: RequestInit = {}) {
  return fetch(`${backendUrl}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${accessToken}`, ...init.headers }
  });
}

test("a confirmed owned batch persists and returns the same analysis", { skip: !runHostedTests }, async () => {
  assert.ok(accessToken, "TEST_SUPABASE_ACCESS_TOKEN is required.");
  const batchesResponse = await api("/v1/production-batches");
  assert.equal(batchesResponse.status, 200, "The backend must be running and the test token must be valid.");
  const batches = await batchesResponse.json() as { productionBatches: Array<{ id: string; status: string }> };
  const batch = batches.productionBatches.find((candidate) => candidate.status === "confirmed");
  assert.ok(batch, "The linked test user needs at least one confirmed batch.");

  const createdResponse = await api(`/v1/production-batches/${batch.id}/analysis`, { method: "POST" });
  assert.equal(createdResponse.status, 200);
  const created = await createdResponse.json() as { analysis: { batchId: string; assessment: unknown } };
  assert.equal(created.analysis.batchId, batch.id);
  assert.ok(created.analysis.assessment);

  const savedResponse = await api(`/v1/production-batches/${batch.id}/analysis`);
  assert.equal(savedResponse.status, 200);
  const saved = await savedResponse.json() as { analysis: { batchId: string; assessment: unknown } };
  assert.equal(saved.analysis.batchId, batch.id);
  assert.deepEqual(saved.analysis.assessment, created.analysis.assessment);
});

test("a valid test batch confirms once and records its audit event", { skip: !runHostedTests }, async () => {
  assert.ok(accessToken, "TEST_SUPABASE_ACCESS_TOKEN is required.");
  const sitesResponse = await api("/v1/manufacturing-sites");
  assert.equal(sitesResponse.status, 200);
  const sites = await sitesResponse.json() as { manufacturingSites: Array<{ id: string }> };
  const site = sites.manufacturingSites[0];
  assert.ok(site, "The test user needs an owned manufacturing site.");

  const linesResponse = await api(`/v1/manufacturing-sites/${site.id}/production-lines`);
  assert.equal(linesResponse.status, 200);
  const lines = await linesResponse.json() as { productionLines: Array<{ id: string; is_active: boolean }> };
  const line = lines.productionLines.find((candidate) => candidate.is_active);
  assert.ok(line, "The test site needs an active production line.");

  const invalidResponse = await api("/v1/production-batches", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ manufacturingSiteId: site.id, productionLineIds: [line.id], rawInputKg: -1 })
  });
  assert.equal(invalidResponse.status, 400);

  const batchesResponse = await api("/v1/production-batches");
  const batches = await batchesResponse.json() as { productionBatches: Array<{ id: string; batch_reference: string | null; status: string }> };
  let batch = batches.productionBatches.find((candidate) => candidate.batch_reference === "PHASE7-INTEGRATION");
  if (!batch) {
    const createResponse = await api("/v1/production-batches", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        manufacturingSiteId: site.id,
        productionLineIds: [line.id],
        sourceChannel: "web",
        batchReference: "PHASE7-INTEGRATION",
        species: "tuna",
        productSpecification: "fillet beku",
        rawInputKg: 100,
        sellableOutputKg: 70,
        trimmingKg: 10,
        qualityRejectKg: 5,
        byproductKg: 10,
        spoilageKg: 3,
        otherLossKg: 2
      })
    });
    assert.equal(createResponse.status, 201);
    const created = await createResponse.json() as { productionBatch: { batch: { id: string } } };
    batch = { id: created.productionBatch.batch.id, batch_reference: "PHASE7-INTEGRATION", status: "draft" };
  }

  if (batch.status === "draft") {
    const confirmResponse = await api(`/v1/production-batches/${batch.id}/confirm`, { method: "POST" });
    assert.equal(confirmResponse.status, 200);
  }

  const auditResponse = await api(`/v1/production-batches/${batch.id}/audit-events`);
  assert.equal(auditResponse.status, 200);
  const audit = await auditResponse.json() as { auditEvents: Array<{ event_type: string }> };
  assert.ok(audit.auditEvents.some((event) => event.event_type === "confirmed"));

  const repeatedConfirm = await api(`/v1/production-batches/${batch.id}/confirm`, { method: "POST" });
  assert.equal(repeatedConfirm.status, 409);
});
