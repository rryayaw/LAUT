import "dotenv/config";
import { z } from "zod";

const optionalSecret = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().min(1).optional()
);

const environmentSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8000),
  CORS_ORIGIN: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().url().optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_PUBLISHABLE_KEY: optionalSecret,
  GOOGLE_API_KEY: optionalSecret,
  GEMINI_MODEL: z.string().min(1).default("gemini-3.5-flash-lite")
});

export const env = environmentSchema.parse(process.env);
