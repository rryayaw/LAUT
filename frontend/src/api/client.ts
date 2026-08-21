// Shared HTTP infrastructure for the LAUT backend.
//
// Nothing calls this yet — feature `api/` modules currently resolve against
// `src/placeholder/`. When an endpoint goes live, that feature's api module
// swaps its body to `apiRequest(...)` and nothing else in the app changes.

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

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

let accessToken: string | undefined;

/** Set once the Supabase session is available; sent as the Bearer token. */
export function setAccessToken(token: string | undefined) {
  accessToken = token;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, signal } = options;

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    signal,
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(accessToken === undefined ? {} : { authorization: `Bearer ${accessToken}` })
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => undefined);
    const message =
      typeof detail === "object" && detail !== null && "error" in detail
        ? String((detail as { error: unknown }).error)
        : `Request to ${path} failed with status ${response.status}.`;
    throw new ApiError(message, response.status, detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
