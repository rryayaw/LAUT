import { prisma } from "../../db/prisma.js";
import type { DeliveryStatus, InboundChannelMessage } from "./messaging-channel.types.js";

type Row = Record<string, unknown>;
type InboundResult = { duplicate: boolean; linked: boolean; profileName: string | null; identityId?: string; conversationId?: string };

function database() {
  if (!prisma) throw new Error("Database access is not configured.");
  return prisma;
}

export function normalizeWhatsAppNumber(value: string) {
  const normalized = value.replace(/[^0-9]/g, "");
  if (!/^[0-9]{7,15}$/.test(normalized)) throw new Error("Provide a valid E.164 WhatsApp number.");
  return normalized;
}

export async function linkWhatsAppIdentity(profileId: string, phoneNumber: string) {
  const externalIdentity = normalizeWhatsAppNumber(phoneNumber);
  const db = database();
  const existing = await db.$queryRawUnsafe<Row[]>(
    `select id, profile_id from public.whatsapp_identities where provider = 'vonage' and channel = 'whatsapp' and external_identity = $1 limit 1`, externalIdentity
  );
  if (existing[0] && existing[0].profile_id !== profileId) throw new Error("This WhatsApp number is already linked to another LAUT user.");
  const rows = await db.$queryRawUnsafe<Row[]>(
    `insert into public.whatsapp_identities (profile_id, provider, channel, external_identity, verified_at)
     values ($1::uuid, 'vonage', 'whatsapp', $2, now())
     on conflict (profile_id, provider, channel) do update set external_identity = excluded.external_identity, verified_at = now()
     returning id, external_identity, verified_at`, profileId, externalIdentity
  );
  return rows[0];
}

export async function recordInboundMessage(message: InboundChannelMessage): Promise<InboundResult> {
  const db = database();
  return db.$transaction(async (tx) => {
    const inserted = await tx.$queryRawUnsafe<Row[]>(
      `insert into public.whatsapp_messages (provider, channel, external_message_id, direction, message_type, text_content)
       values ($1, $2, $3, 'inbound', 'text', $4) on conflict (provider, channel, external_message_id) do nothing returning id`,
      message.provider, message.channel, message.externalMessageId, message.text ?? null
    );
    if (!inserted[0]) return { duplicate: true, linked: false, profileName: null };
    const identities = await tx.$queryRawUnsafe<Row[]>(
      `select identity.id, profile.display_name from public.whatsapp_identities identity join public.profiles profile on profile.id = identity.profile_id
       where identity.provider = $1 and identity.channel = $2 and identity.external_identity = $3 limit 1`,
      message.provider, message.channel, normalizeWhatsAppNumber(message.from)
    );
    const identity = identities[0];
    if (!identity || typeof identity.id !== "string") return { duplicate: false, linked: false, profileName: null };
    await tx.$executeRawUnsafe(`update public.whatsapp_conversations set status = 'expired' where whatsapp_identity_id = $1::uuid and status = 'active' and expires_at <= now()`, identity.id);
    let conversations = await tx.$queryRawUnsafe<Row[]>(
      `select id from public.whatsapp_conversations where whatsapp_identity_id = $1::uuid and status = 'active' and expires_at > now() limit 1`, identity.id
    );
    if (!conversations[0]) {
      conversations = await tx.$queryRawUnsafe<Row[]>(
        `insert into public.whatsapp_conversations (whatsapp_identity_id) values ($1::uuid) returning id`, identity.id
      );
    }
    const conversationId = conversations[0]?.id;
    await tx.$executeRawUnsafe(
      `update public.whatsapp_messages set whatsapp_identity_id = $1::uuid, whatsapp_conversation_id = $2::uuid where id = $3::uuid`,
      identity.id, conversationId, inserted[0].id
    );
    await tx.$executeRawUnsafe(`update public.whatsapp_conversations set last_message_at = now() where id = $1::uuid`, conversationId);
    return { duplicate: false, linked: true, profileName: typeof identity.display_name === 'string' ? identity.display_name : null, identityId: identity.id, conversationId: typeof conversationId === 'string' ? conversationId : undefined };
  });
}

export async function recordDeliveryStatus(status: DeliveryStatus) {
  await database().$executeRawUnsafe(
    `update public.whatsapp_messages set delivery_status = $1 where provider = $2 and channel = $3 and external_message_id = $4`,
    status.status, status.provider, status.channel, status.externalMessageId
  );
}