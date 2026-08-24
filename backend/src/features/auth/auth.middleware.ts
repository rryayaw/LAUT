import type { NextFunction, Request, Response } from "express";
import { createHash } from "node:crypto";
import { getSupabaseClient } from "../../integrations/supabase/supabase.client.js";

export type AuthenticatedUser = {
  id: string;
  email: string | null;
};

// A page view issues several authenticated API calls at once. Cache a token only
// after Supabase has validated it, so those calls do not each trigger a separate
// `/auth/v1/user` request. The short lifetime limits the revocation trade-off and
// makes token refreshes naturally use a new cache entry.
const AUTH_CACHE_TTL_MS = 30_000;
const verifiedUsersByToken = new Map<string, { user: AuthenticatedUser; expiresAt: number }>();

function tokenCacheKey(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

function cachedUser(token: string): AuthenticatedUser | undefined {
  const key = tokenCacheKey(token);
  const entry = verifiedUsersByToken.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt > Date.now()) return entry.user;
  verifiedUsersByToken.delete(key);
  return undefined;
}

function cacheVerifiedUser(token: string, user: AuthenticatedUser): void {
  const now = Date.now();
  for (const [key, entry] of verifiedUsersByToken) {
    if (entry.expiresAt <= now) verifiedUsersByToken.delete(key);
  }
  verifiedUsersByToken.set(tokenCacheKey(token), { user, expiresAt: now + AUTH_CACHE_TTL_MS });
}

export function getAuthenticatedUser(response: Response): AuthenticatedUser {
  const user = response.locals.authenticatedUser as AuthenticatedUser | undefined;

  if (!user) {
    throw new Error("Authenticated user is required before accessing this route.");
  }

  return user;
}

export async function requireAuthenticatedUser(
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> {
  const authorization = request.header("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : undefined;

  if (!token) {
    response.status(401).json({ error: "A Bearer access token is required." });
    return;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    response.status(503).json({ error: "Supabase authentication is not configured." });
    return;
  }

  const cached = cachedUser(token);
  if (cached) {
    response.locals.authenticatedUser = cached;
    next();
    return;
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    response.status(401).json({ error: "The access token is invalid or expired." });
    return;
  }

  const user = {
    id: data.user.id,
    email: data.user.email ?? null
  } satisfies AuthenticatedUser;
  cacheVerifiedUser(token, user);
  response.locals.authenticatedUser = user;
  next();
}
