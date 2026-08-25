import { Router } from "express";
import { z } from "zod";
import { getAuthenticatedUser, requireAuthenticatedUser } from "../auth/auth.middleware.js";
import { advanceBatchWizard } from "./batch-wizard.service.js";
import { InMemoryMessageDeduplicator } from "./in-memory-message-deduplicator.js";
import { linkWhatsAppIdentity, listWhatsAppConversations, listWhatsAppMessages, recordDeliveryStatus, recordInboundMessage, recordOutboundMessage } from "./whatsapp-conversation.service.js";
import { VonageWhatsAppAdapter } from "./vonage-whatsapp.adapter.js";

export const whatsappRouter = Router();
const adapter = new VonageWhatsAppAdapter();
const statusDeduplicator = new InMemoryMessageDeduplicator();
const linkSchema = z.object({ phoneNumber: z.string().min(7).max(20) });
const conversationParamsSchema = z.object({ conversationId: z.string().uuid() });

whatsappRouter.get("/v1/whatsapp/conversations", requireAuthenticatedUser, async (_request, response) => {
  try {
    const conversations = await listWhatsAppConversations(getAuthenticatedUser(response).id);
    return response.status(200).json({ conversations });
  } catch (error) {
    console.error("Unable to list WhatsApp conversations", error);
    return response.status(503).json({ error: "WhatsApp conversations are unavailable." });
  }
});

whatsappRouter.get("/v1/whatsapp/conversations/:conversationId/messages", requireAuthenticatedUser, async (request, response) => {
  const parsed = conversationParamsSchema.safeParse(request.params);
  if (!parsed.success) return response.status(400).json({ error: "Provide a valid conversation ID." });

  try {
    const messages = await listWhatsAppMessages(getAuthenticatedUser(response).id, parsed.data.conversationId);
    if (!messages) return response.status(404).json({ error: "WhatsApp conversation was not found." });
    return response.status(200).json({ messages });
  } catch (error) {
    console.error("Unable to list WhatsApp messages", error);
    return response.status(503).json({ error: "WhatsApp messages are unavailable." });
  }
});

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
    const text = inbound.linked && inbound.conversation
      ? (await advanceBatchWizard(inbound.conversation, message.text ?? "")).text
      : "Nomor WhatsApp ini belum terhubung ke akun *LAUT*.\n\nMasuk ke LAUT melalui web, lalu hubungkan nomor ini terlebih dahulu.";
    const sent = await adapter.sendText({ to: message.from, text });
    await recordOutboundMessage(inbound.identityId, inbound.conversation?.id, sent, text);
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
