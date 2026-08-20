import { Router } from "express";
import { getAuthenticatedUser, requireAuthenticatedUser } from "./auth.middleware.js";

export const authRouter = Router();

authRouter.get("/v1/auth/me", requireAuthenticatedUser, (_request, response) => {
  response.status(200).json({ user: getAuthenticatedUser(response) });
});
