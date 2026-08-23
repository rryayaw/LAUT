import { Router } from "express";
import { z } from "zod";
import { getAuthenticatedUser, requireAuthenticatedUser } from "../auth/auth.middleware.js";
import { InMemoryMessageDeduplicator } from "./in-memory-message-deduplicator.js";
import { linkWhatsAppIdentity, recordDeliveryStatus, recordInboundMessage } from "./whatsapp-conversation.service.js";
import { VonageWhatsAppAdapter } from "./vonage-whatsapp.adapter.js";

export const whatsappRouter = Router();
const adapter = new VonageWhatsAppAdapter();
const statusDeduplicator = new InMemoryMessageDeduplicator();
const linkSchema = z.object({ phoneNumber: z.string().min(7).max(20) });

whatsappRouter.put("/v1/whatsapp/identity", requireAuthenticatedUser, async (request, response) => {
  const parsed = linkSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: "Provide a valid phoneNumber." });
  try {
    const identity = await linkWhatsAppIdentity(getAuthenticatedUser(response).id, parsed.data.phoneNumber);
    return response.status(200).json({ whatsappIdentity: identity });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to link WhatsApp identity.";
    return response.status(message.includes("already linked") ? 409 : 503).json({ error: message });
  }
});

whatsappRouter.post("/v1/whatsapp/inbound", async (request, response) => {
  if (!adapter.isConfigured()) return response.sendStatus(503);
  if (!adapter.hasValidWebhookSignature(request.header("authorization"))) return response.sendStatus(401);
  const message = adapter.parseInbound(request.body);
  if (!message) return response.sendStatus(204);
  try {
    const inbound = await recordInboundMessage(message);
    if (inbound.duplicate) return response.sendStatus(204);
    const text = inbound.linked
      ? `LAUT account linked${inbound.profileName ? `, ${inbound.profileName}` : ""}. Reply \"tambah batch\" to begin.`
      : "This WhatsApp number is not linked to a LAUT account yet. Sign in to LAUT and link this number first.";
    await adapter.sendText({ to: message.from, text });
    return response.sendStatus(204);
  } catch (error) {
    console.error("Unable to process Vonage WhatsApp message", error instanceof Error ? error.message : error);
    return response.sendStatus(502);
  }
});

whatsappRouter.post("/v1/whatsapp/status", async (request, response) => {
  if (!adapter.isConfigured()) return response.sendStatus(503);
  if (!adapter.hasValidWebhookSignature(request.header("authorization"))) return response.sendStatus(401);
  const status = adapter.parseDeliveryStatus(request.body);
  if (status && statusDeduplicator.claim(`${status.provider}:${status.externalMessageId}:${status.status}`)) {
    await recordDeliveryStatus(status);
    console.info("Vonage WhatsApp delivery status", { messageUuid: status.externalMessageId, status: status.status });
  }
  return response.sendStatus(204);
});