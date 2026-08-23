import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { env } from "../../config/env.js";
import type { DeliveryStatus, InboundChannelMessage, MessagingChannelAdapter, SentChannelMessage } from "./messaging-channel.types.js";

const inboundMessageSchema = z.object({
  channel: z.literal("whatsapp"),
  from: z.string().min(1),
  message_uuid: z.string().min(1),
  message_type: z.string(),
  text: z.string().optional()
}).passthrough();

const messageStatusSchema = z.object({
  channel: z.literal("whatsapp"),
  message_uuid: z.string().min(1),
  status: z.string().min(1)
}).passthrough();

const base64UrlToBuffer = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized + "=".repeat((4 - normalized.length % 4) % 4), "base64");
};

export class VonageWhatsAppAdapter implements MessagingChannelAdapter {
  isConfigured() {
    return Boolean(env.VONAGE_SIGNATURE_SECRET && env.VONAGE_API_KEY && env.VONAGE_API_SECRET &&
      env.VONAGE_WHATSAPP_FROM && env.VONAGE_MESSAGES_API_URL);
  }

  hasValidWebhookSignature(authorization: string | undefined) {
    if (!env.VONAGE_SIGNATURE_SECRET || !authorization?.startsWith("Bearer ")) return false;

    const token = authorization.slice("Bearer ".length);
    const parts = token.split(".");
    if (parts.length !== 3) return false;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    try {
      const header = JSON.parse(base64UrlToBuffer(encodedHeader).toString("utf8")) as { alg?: string };
      const payload = JSON.parse(base64UrlToBuffer(encodedPayload).toString("utf8")) as { exp?: number };
      if (header.alg !== "HS256" || (payload.exp !== undefined && payload.exp * 1000 <= Date.now())) return false;

      const expected = createHmac("sha256", env.VONAGE_SIGNATURE_SECRET)
        .update(`${encodedHeader}.${encodedPayload}`)
        .digest();
      const received = base64UrlToBuffer(encodedSignature);
      return received.length === expected.length && timingSafeEqual(received, expected);
    } catch {
      return false;
    }
  }

  parseInbound(payload: unknown): InboundChannelMessage | undefined {
    const parsed = inboundMessageSchema.safeParse(payload);
    if (!parsed.success) return undefined;
    return { provider: "vonage", channel: "whatsapp", externalMessageId: parsed.data.message_uuid, from: parsed.data.from, text: parsed.data.text };
  }

  parseDeliveryStatus(payload: unknown): DeliveryStatus | undefined {
    const parsed = messageStatusSchema.safeParse(payload);
    if (!parsed.success) return undefined;
    return { provider: "vonage", channel: "whatsapp", externalMessageId: parsed.data.message_uuid, status: parsed.data.status };
  }

  async sendText({ to, text }: { to: string; text: string }): Promise<SentChannelMessage> {
    if (!this.isConfigured()) throw new Error("Vonage WhatsApp is not configured.");
    const basicCredentials = Buffer.from(`${env.VONAGE_API_KEY}:${env.VONAGE_API_SECRET}`).toString("base64");
    const response = await fetch(env.VONAGE_MESSAGES_API_URL!, {
      method: "POST",
      headers: { Authorization: `Basic ${basicCredentials}`, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.VONAGE_WHATSAPP_FROM, to, message_type: "text", text, channel: "whatsapp" })
    });
    if (!response.ok) throw new Error(`Vonage Messages API returned ${response.status}`);
    const payload = await response.json().catch(() => undefined) as { message_uuid?: unknown } | undefined;
    if (!payload || typeof payload.message_uuid !== "string" || payload.message_uuid.trim() === "") {
      throw new Error("Vonage Messages API response did not include a message UUID.");
    }
    return { provider: "vonage", channel: "whatsapp", externalMessageId: payload.message_uuid };
  }
}
