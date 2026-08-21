import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatGoogle } from "@langchain/google/node";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { z } from "zod";
import { env } from "../../config/env.js";

export type AnalysisEvidence = {
  batchId: string;
  rawInputKg: number;
  sellableOutputKg: number;
  sellableYieldPercent: number;
  knownLossPercent: number;
  massBalanceDifferenceKg: number;
  comparableYields: number[];
  comparableCount: number;
  sharedContext: string[];
};

const GuidanceSchema = z.object({
  summary: z.string().min(1).max(800),
  evidence: z.array(z.object({ fact: z.string().min(1).max(400), source: z.enum(["batch", "comparable_history", "line_context"]) })).max(8),
  investigationSteps: z.array(z.object({ priority: z.enum(["low", "medium", "high"]), action: z.string().min(1).max(400), rationale: z.string().min(1).max(400) })).max(6),
  limitations: z.array(z.string().min(1).max(300)).max(6)
});

export type InvestigationGuidance = z.infer<typeof GuidanceSchema>;

export type DeterministicAssessment = {
  status: "insufficient_history" | "within_baseline" | "below_baseline" | "above_baseline";
  comparableAverageYieldPercent: number | null;
  yieldDifferencePercentagePoints: number | null;
  anomalyThresholdPercentagePoints: number | null;
  evidenceLimitations: string[];
};

const AnalysisState = Annotation.Root({
  evidence: Annotation<AnalysisEvidence>,
  assessment: Annotation<DeterministicAssessment>,
  guidance: Annotation<InvestigationGuidance | null>
});

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function assess(evidence: AnalysisEvidence): DeterministicAssessment {
  if (evidence.comparableCount < 3) {
    return {
      status: "insufficient_history",
      comparableAverageYieldPercent: null,
      yieldDifferencePercentagePoints: null,
      anomalyThresholdPercentagePoints: null,
      evidenceLimitations: ["At least three comparable confirmed batches are required before LAUT labels yield as above or below baseline."]
    };
  }

  const comparableAverageYieldPercent = evidence.comparableYields.reduce((sum, value) => sum + value, 0) / evidence.comparableYields.length;
  const yieldDifferencePercentagePoints = evidence.sellableYieldPercent - comparableAverageYieldPercent;
  const anomalyThresholdPercentagePoints = 3;
  const status = yieldDifferencePercentagePoints <= -anomalyThresholdPercentagePoints
    ? "below_baseline"
    : yieldDifferencePercentagePoints >= anomalyThresholdPercentagePoints
      ? "above_baseline"
      : "within_baseline";
  return {
    status,
    comparableAverageYieldPercent: round(comparableAverageYieldPercent),
    yieldDifferencePercentagePoints: round(yieldDifferencePercentagePoints),
    anomalyThresholdPercentagePoints,
    evidenceLimitations: ["This is a yield comparison, not evidence of causation.", "Comparable context is limited to saved batch and production-line data."]
  };
}

async function generateGuidance(evidence: AnalysisEvidence, assessment: DeterministicAssessment): Promise<InvestigationGuidance> {
  if (!env.GOOGLE_API_KEY) throw new Error("GOOGLE_API_KEY is not configured.");
  const model = new ChatGoogle({ apiKey: env.GOOGLE_API_KEY, model: env.GEMINI_MODEL, maxRetries: 2 });
  const structuredModel = model.withStructuredOutput(GuidanceSchema, { name: "laut_investigation_guidance" });
  return structuredModel.invoke([
    new SystemMessage(`You are LAUT's seafood-production investigation assistant. Use only the supplied evidence. Do not invent values, causes, food-safety diagnoses, supplier actions, or certainty. Describe associations as items to investigate. Recommendations must require human review.`),
    new HumanMessage(JSON.stringify({ evidence, assessment }))
  ]);
}

const graph = new StateGraph(AnalysisState)
  .addNode("calculate_assessment", async (state) => ({ assessment: assess(state.evidence) }))
  .addNode("generate_guidance", async (state) => ({ guidance: await generateGuidance(state.evidence, state.assessment) }))
  .addEdge(START, "calculate_assessment")
  .addConditionalEdges("calculate_assessment", (state) => env.GOOGLE_API_KEY && state.assessment.status !== "insufficient_history" ? "generate_guidance" : END)
  .addEdge("generate_guidance", END)
  .compile();

export async function runProductionAnalysis(evidence: AnalysisEvidence) {
  const result = await graph.invoke({ evidence, guidance: null });
  return {
    assessment: result.assessment,
    guidance: result.guidance,
    aiStatus: result.guidance ? "generated" : env.GOOGLE_API_KEY ? "not_required" : "not_configured"
  } as const;
}
