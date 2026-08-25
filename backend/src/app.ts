import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { apiDocsRouter } from "./features/api-docs/api-docs.routes.js";
import { authRouter } from "./features/auth/auth.routes.js";
import { batchAnalysisRouter } from "./features/batch-analysis/batch-analysis.routes.js";
import { batchReportingRouter } from "./features/batch-reporting/batch-reporting.routes.js";
import { healthRouter } from "./features/health/health.routes.js";
import { processingConfigRouter } from "./features/processing-config/processing-config.routes.js";
import { whatsappRouter } from "./features/whatsapp/whatsapp.routes.js";

export const app = express();

const configuredOrigins = new Set(env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean));
const isLocalDevelopmentOrigin = (origin: string) => /^http:\/\/(localhost|127\.0\.0\.1):(3000|3001)$/.test(origin);

app.use(cors({
  origin(origin, callback) {
    // Next may advance to port 3001 when port 3000 is occupied. Keep that
    // common local fallback working without broadening production CORS.
    const isAllowed = !origin || configuredOrigins.has(origin) || (process.env.NODE_ENV !== "production" && isLocalDevelopmentOrigin(origin));
    callback(null, isAllowed);
  }
}));
app.use(express.json());
app.use(healthRouter);
app.use(apiDocsRouter);
app.use(whatsappRouter);
app.use(authRouter);
app.use(batchAnalysisRouter);
app.use(processingConfigRouter);
app.use(batchReportingRouter);
