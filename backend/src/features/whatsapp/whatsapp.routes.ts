import { createHmac, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env.js";

const inboundMessageSchema = z.object({
  channel: z.string(),
  from: z.string().min(1),
  message_uuid: z.string().min(1),
  message_type: z.string(),
  text: z.string().optional()
}).passthrough();

const messageStatusSchema = z.object({
  channel: z.string(),
  message_uuid: z.string().min(1),
  status: z.string().min(1)
}).passthrough();

const webhookUnavailable = () =>
  !env.VONAGE_SIGNATURE_SECRET || !env.VONAGE_API_KEY || !env.VONAGE_API_SECRET ||
  !env.VONAGE_WHATSAPP_FROM || !env.VONAGE_MESSAGES_API_URL;

const base64UrlToBuffer = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized + "=".repeat((4 - normalized.length % 4) % 4), "base64");
};

const hasValidVonageSignature = (authorization: string | undefined) => {
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
};

const sendText = async (to: string, text: string) => {
  const basicCredentials = Buffer.from(`${env.VONAGE_API_KEY}:${env.VONAGE_API_SECRET}`).toString("base64");
  const response = await fetch(env.VONAGE_MESSAGES_API_URL!, {
    method: "POST",
    headers: { Authorization: `Basic ${basicCredentials}`, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.VONAGE_WHATSAPP_FROM, to, message_type: "text", text, channel: "whatsapp" })
  });
  if (!response.ok) throw new Error(`Vonage Messages API returned ${response.status}`);
};

export const whatsappRouter = Router();

whatsappRouter.post("/v1/whatsapp/inbound", async (request, response) => {
  if (webhookUnavailable()) return response.sendStatus(503);
  if (!hasValidVonageSignature(request.header("authorization"))) return response.sendStatus(401);

  const parsed = inboundMessageSchema.safeParse(request.body);
  if (!parsed.success || parsed.data.channel !== "whatsapp") return response.sendStatus(204);

  try {
    await sendText(parsed.data.from, "LAUT is connected. Reply \"tambah batch\" to begin.");
    return response.sendStatus(204);
  } catch (error) {
    console.error("Unable to send Vonage WhatsApp Sandbox reply", error instanceof Error ? error.message : error);
    return response.sendStatus(502);
  }
});

whatsappRouter.post("/v1/whatsapp/status", (request, response) => {
  if (!env.VONAGE_SIGNATURE_SECRET) return response.sendStatus(503);
  if (!hasValidVonageSignature(request.header("authorization"))) return response.sendStatus(401);

  const parsed = messageStatusSchema.safeParse(request.body);
  if (parsed.success && parsed.data.channel === "whatsapp") {
    console.info("Vonage WhatsApp delivery status", { messageUuid: parsed.data.message_uuid, status: parsed.data.status });
  }
  return response.sendStatus(204);
});