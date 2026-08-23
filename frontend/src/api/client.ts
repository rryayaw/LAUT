// Shared HTTP infrastructure for the LAUT backend.
//
// Feature `api/` modules call `apiRequest` and translate the response into the
// domain types in `src/types/domain`. Components never touch this file.

import { getSupabaseClient } from "./supabase";

export class ApiError extends Error {
  readonly status: number;
  readonly detail?: unknown;

  constructor(message: string, status: number, detail?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

const baseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000").replace(/\/$/, "");

/**
 * The backend authenticates every `/v1` route with the Supabase access token.
 * Reading it per request rather than caching it lets supabase-js hand back a
 * refreshed token once the previous one expires (tokens last one hour).
 */
async function authorizationHeader(): Promise<Record<string, string>> {
  const supabase = getSupabaseClient();
  if (!supabase) return {};
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { authorization: `Bearer ${token}` } : {};
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  /** Status codes to resolve as `undefined` instead of throwing, e.g. a 404 that just means "nothing saved yet". */
  resolveStatuses?: number[];
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, signal, resolveStatuses = [] } = options;

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      signal,
      headers: {
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(await authorizationHeader())
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new ApiError(`Cannot reach the LAUT API at ${baseUrl}. Is the backend running?`, 0, cause);
  }

  if (!response.ok) {
    if (resolveStatuses.includes(response.status)) return undefined as T;
    const detail: unknown = await response.json().catch(() => undefined);
    const message =
      typeof detail === "object" && detail !== null && "error" in detail
        ? String((detail as { error: unknown }).error)
        : `Request to ${path} failed with status ${response.status}.`;
    throw new ApiError(message, response.status, detail);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

// ---------------------------------------------------------------------------
// Response coercion
//
// Postgres `numeric` columns arrive as JSON strings, dates as either a plain
// `YYYY-MM-DD` or a full timestamp, and optional columns as null. These narrow
// those to the shapes `src/types/domain` declares.
// ---------------------------------------------------------------------------

export function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function toRequiredNumber(value: unknown, fallback = 0): number {
  return toNumber(value) ?? fallback;
}

export function toText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/** Normalises a date or timestamp to `YYYY-MM-DD`, which is what every view groups on. */
export function toDateOnly(value: unknown): string | undefined {
  const text = toText(value);
  if (!text) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString().slice(0, 10);
}

export function toIsoTimestamp(value: unknown): string | undefined {
  const text = toText(value);
  if (!text) return undefined;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}
