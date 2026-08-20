import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { authRouter } from "./features/auth/auth.routes.js";
import { healthRouter } from "./features/health/health.routes.js";

export const app = express();

app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json());
app.use(healthRouter);
app.use(authRouter);
