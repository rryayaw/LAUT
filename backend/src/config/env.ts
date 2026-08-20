import "dotenv/config";
import { z } from "zod";

const environmentSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8000),
  CORS_ORIGIN: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().url().optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional()
});

export const env = environmentSchema.parse(process.env);
