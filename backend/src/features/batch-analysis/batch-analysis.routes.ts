import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { getAuthenticatedUser, requireAuthenticatedUser } from "../auth/auth.middleware.js";
import { analyzeAndSaveBatch, BatchAnalysisError, getSavedBatchAnalysis, reanalyzeBatch } from "./batch-analysis.service.js";

const idSchema = z.string().uuid();

function batchId(value: unknown) {
  const parsed = idSchema.safeParse(value);
  if (!parsed.success) throw new BatchAnalysisError(400, "Batch ID is invalid.");
  return parsed.data;
}

function route(handler: (request: Request, response: Response) => Promise<void>) {
  return (request: Request, response: Response) => void handler(request, response).catch((error: unknown) => sendError(response, error));
}

function sendError(response: Response, error: unknown) {
  if (error instanceof BatchAnalysisError) return response.status(error.status).json({ error: error.message });
  console.error("Batch analysis request failed.", error);
  return response.status(500).json({ error: "An unexpected error occurred." });
}

export const batchAnalysisRouter = Router();
batchAnalysisRouter.use(requireAuthenticatedUser);

batchAnalysisRouter.get("/v1/production-batches/:batchId/analysis", route(async (request, response) => {
  const user = getAuthenticatedUser(response);
  const analysis = await getSavedBatchAnalysis(user.id, batchId(request.params.batchId));
  if (!analysis) {
    response.status(404).json({ error: "No saved analysis exists for this production batch." });
    return;
  }
  response.status(200).json({ analysis });
}));

batchAnalysisRouter.post("/v1/production-batches/:batchId/analysis", route(async (request, response) => {
  const user = getAuthenticatedUser(response);
  const analysis = request.query.refresh === "true"
    ? await reanalyzeBatch(user.id, batchId(request.params.batchId))
    : await analyzeAndSaveBatch(user.id, batchId(request.params.batchId));
  response.status(200).json({ analysis });
}));
