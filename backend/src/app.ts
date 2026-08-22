import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { apiDocsRouter } from "./features/api-docs/api-docs.routes.js";
import { authRouter } from "./features/auth/auth.routes.js";
import { batchAnalysisRouter } from "./features/batch-analysis/batch-analysis.routes.js";
import { batchReportingRouter } from "./features/batch-reporting/batch-reporting.routes.js";
import { healthRouter } from "./features/health/health.routes.js";
import { processingConfigRouter } from "./features/processing-config/processing-config.routes.js";

export const app = express();

app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json());
app.use(healthRouter);
app.use(apiDocsRouter);
app.use(authRouter);
app.use(batchAnalysisRouter);
app.use(processingConfigRouter);
app.use(batchReportingRouter);
