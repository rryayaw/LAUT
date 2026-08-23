import { Router } from "express";
import { InMemoryMessageDeduplicator } from "./in-memory-message-deduplicator.js";
import { VonageWhatsAppAdapter } from "./vonage-whatsapp.adapter.js";

export const whatsappRouter = Router();
const adapter = new VonageWhatsAppAdapter();
const inboundMessageDeduplicator = new InMemoryMessageDeduplicator();
const statusDeduplicator = new InMemoryMessageDeduplicator();

whatsappRouter.post("/v1/whatsapp/inbound", async (request, response) => {
  if (!adapter.isConfigured()) return response.sendStatus(503);
  if (!adapter.hasValidWebhookSignature(request.header("authorization"))) return response.sendStatus(401);

  const message = adapter.parseInbound(request.body);
  if (!message) return response.sendStatus(204);
  const deduplicationKey = `${message.provider}:${message.externalMessageId}`;
  if (!inboundMessageDeduplicator.claim(deduplicationKey)) return response.sendStatus(204);

  try {
    await adapter.sendText({ to: message.from, text: "LAUT is connected. Reply \"tambah batch\" to begin." });
    return response.sendStatus(204);
  } catch (error) {
    inboundMessageDeduplicator.release(deduplicationKey);
    console.error("Unable to send Vonage WhatsApp Sandbox reply", error instanceof Error ? error.message : error);
    return response.sendStatus(502);
  }
});

whatsappRouter.post("/v1/whatsapp/status", (request, response) => {
  if (!adapter.isConfigured()) return response.sendStatus(503);
  if (!adapter.hasValidWebhookSignature(request.header("authorization"))) return response.sendStatus(401);

  const status = adapter.parseDeliveryStatus(request.body);
  if (status && statusDeduplicator.claim(`${status.provider}:${status.externalMessageId}:${status.status}`)) {
    console.info("Vonage WhatsApp delivery status", { messageUuid: status.externalMessageId, status: status.status });
  }
  return response.sendStatus(204);
});