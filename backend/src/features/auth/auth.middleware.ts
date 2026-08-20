import type { NextFunction, Request, Response } from "express";
import { getSupabaseClient } from "../../integrations/supabase/supabase.client.js";

export type AuthenticatedUser = {
  id: string;
  email: string | null;
};

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

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    response.status(401).json({ error: "The access token is invalid or expired." });
    return;
  }

  response.locals.authenticatedUser = {
    id: data.user.id,
    email: data.user.email ?? null
  } satisfies AuthenticatedUser;
  next();
}
