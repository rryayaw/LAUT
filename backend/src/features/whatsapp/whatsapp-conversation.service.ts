import { randomUUID } from "node:crypto";
import { prisma } from "../../db/prisma.js";
import type { DeliveryStatus, InboundChannelMessage, SentChannelMessage } from "./messaging-channel.types.js";

type Row = Record<string, unknown>;
export type WhatsAppConversation = {
  id: string;
  profileId: string;
  profileName: string | null;
  currentStep: string;
  language: string | null;
  draft: Record<string, unknown>;
};

type InboundResult = { duplicate: boolean; linked: boolean; profileName: string | null; identityId?: string; conversation?: WhatsAppConversation };

export type WhatsAppConversationSummary = {
  id: string;
  phoneNumber: string;
  status: "active" | "closed" | "expired";
  currentStep: string;
  language: string | null;
  lastMessageAt: string;
};

export type WhatsAppMessage = {
  id: string;
  direction: "inbound" | "outbound";
  messageType: string;
  text: string | null;
  deliveryStatus: string | null;
  createdAt: string;
};

export type WhatsAppIdentity = {
  id: string;
  phoneNumber: string;
  verifiedAt: string | null;
};

export type OwnedWhatsAppConversation = {
  conversation: WhatsAppConversation;
  identityId: string;
  status: "active" | "closed" | "expired";
};

function database() {
  if (!prisma) throw new Error("Database access is not configured.");
  return prisma;
}

export function normalizeWhatsAppNumber(value: string) {
  const normalized = value.replace(/[^0-9]/g, "");
  if (!/^[0-9]{7,15}$/.test(normalized)) throw new Error("Provide a valid E.164 WhatsApp number.");
  return normalized;
}

export async function linkWhatsAppIdentity(profileId: string, phoneNumber: string): Promise<WhatsAppIdentity> {
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
  const identity = rows[0] as { id?: string; external_identity?: string; verified_at?: Date | string | null } | undefined;
  if (!identity?.id || !identity.external_identity) throw new Error("Unable to save the WhatsApp identity.");
  return {
    id: identity.id,
    phoneNumber: identity.external_identity,
    verifiedAt: identity.verified_at ? new Date(identity.verified_at).toISOString() : null
  };
}

/** Returns the calling profile's linked WhatsApp number, if it has one. */
export async function getWhatsAppIdentity(profileId: string): Promise<WhatsAppIdentity | null> {
  const rows = await database().$queryRawUnsafe<Array<{
    id: string;
    external_identity: string;
    verified_at: Date | string | null;
  }>>(
    `select id, external_identity, verified_at
       from public.whatsapp_identities
      where profile_id = $1::uuid and provider = 'vonage' and channel = 'whatsapp'
      limit 1`,
    profileId
  );
  const identity = rows[0];
  if (!identity) return null;

  return {
    id: identity.id,
    phoneNumber: identity.external_identity,
    verifiedAt: identity.verified_at ? new Date(identity.verified_at).toISOString() : null
  };
}

/** Lists only conversations belonging to the authenticated LAUT profile. */
export async function listWhatsAppConversations(profileId: string): Promise<WhatsAppConversationSummary[]> {
  const rows = await database().$queryRawUnsafe<Array<{
    id: string;
    phone_number: string;
    status: WhatsAppConversationSummary["status"];
    current_step: string;
    language: string | null;
    last_message_at: Date | string;
  }>>(
    `select conversation.id, identity.external_identity as phone_number, conversation.status,
            conversation.current_step, conversation.language, conversation.last_message_at
       from public.whatsapp_conversations conversation
       join public.whatsapp_identities identity on identity.id = conversation.whatsapp_identity_id
      where identity.profile_id = $1::uuid and identity.provider = 'vonage' and identity.channel = 'whatsapp'
      order by conversation.last_message_at desc`,
    profileId
  );

  return rows.map((row) => ({
    id: row.id,
    phoneNumber: row.phone_number,
    status: row.status,
    currentStep: row.current_step,
    language: row.language,
    lastMessageAt: new Date(row.last_message_at).toISOString()
  }));
}

/** Reads a message history only after ownership is established through its identity. */
export async function listWhatsAppMessages(profileId: string, conversationId: string): Promise<WhatsAppMessage[] | undefined> {
  const ownsConversation = await database().$queryRawUnsafe<Array<{ id: string }>>(
    `select conversation.id
       from public.whatsapp_conversations conversation
       join public.whatsapp_identities identity on identity.id = conversation.whatsapp_identity_id
      where conversation.id = $1::uuid and identity.profile_id = $2::uuid
      limit 1`,
    conversationId,
    profileId
  );
  if (!ownsConversation[0]) return undefined;

  const rows = await database().$queryRawUnsafe<Array<{
    id: string;
    direction: WhatsAppMessage["direction"];
    message_type: string;
    text_content: string | null;
    delivery_status: string | null;
    created_at: Date | string;
  }>>(
    `select message.id, message.direction, message.message_type, message.text_content,
            message.delivery_status, message.created_at
       from public.whatsapp_messages message
      where message.whatsapp_conversation_id = $1::uuid
      order by message.created_at asc`,
    conversationId
  );

  return rows.map((row) => ({
    id: row.id,
    direction: row.direction,
    messageType: row.message_type,
    text: row.text_content,
    deliveryStatus: row.delivery_status,
    createdAt: new Date(row.created_at).toISOString()
  }));
}

/** Resolves a conversation only through the calling profile's verified identity. */
export async function getOwnedWhatsAppConversation(profileId: string, conversationId: string): Promise<OwnedWhatsAppConversation | undefined> {
  const rows = await database().$queryRawUnsafe<Array<{
    id: string;
    whatsapp_identity_id: string;
    status: OwnedWhatsAppConversation["status"];
    current_step: string;
    language: string | null;
    draft: Record<string, unknown>;
    display_name: string | null;
  }>>(
    `select conversation.id, conversation.whatsapp_identity_id, conversation.status, conversation.current_step,
            conversation.language, conversation.draft, profile.display_name
       from public.whatsapp_conversations conversation
       join public.whatsapp_identities identity on identity.id = conversation.whatsapp_identity_id
       join public.profiles profile on profile.id = identity.profile_id
      where conversation.id = $1::uuid
        and identity.profile_id = $2::uuid
        and identity.provider = 'vonage'
        and identity.channel = 'whatsapp'
      limit 1`,
    conversationId,
    profileId
  );
  const row = rows[0];
  if (!row) return undefined;
  return {
    identityId: row.whatsapp_identity_id,
    status: row.status,
    conversation: {
      id: row.id,
      profileId,
      profileName: row.display_name,
      currentStep: row.current_step,
      language: row.language,
      draft: row.draft && typeof row.draft === "object" && !Array.isArray(row.draft) ? row.draft : {}
    }
  };
}

/** Opens the one active conversation for a verified number without delivering a message to WhatsApp. */
export async function openDashboardWhatsAppConversation(profileId: string, restart = false): Promise<WhatsAppConversationSummary> {
  const db = database();
  return db.$transaction(async (tx) => {
    const identities = await tx.$queryRawUnsafe<Array<{ id: string; external_identity: string }>>(
      `select id, external_identity
         from public.whatsapp_identities
        where profile_id = $1::uuid and provider = 'vonage' and channel = 'whatsapp'
        limit 1`,
      profileId
    );
    const identity = identities[0];
    if (!identity) throw new Error("Link a verified WhatsApp number before starting a dashboard conversation.");

    await tx.$executeRawUnsafe(
      `update public.whatsapp_conversations
          set status = 'expired'
        where whatsapp_identity_id = $1::uuid and status = 'active' and expires_at <= now()`,
      identity.id
    );
    if (restart) {
      await tx.$executeRawUnsafe(
        `update public.whatsapp_conversations
            set status = 'closed'
          where whatsapp_identity_id = $1::uuid and status = 'active'`,
        identity.id
      );
    }
    const active = await tx.$queryRawUnsafe<Array<{
      id: string; status: WhatsAppConversationSummary["status"]; current_step: string; language: string | null; last_message_at: Date | string;
    }>>(
      `select id, status, current_step, language, last_message_at
         from public.whatsapp_conversations
        where whatsapp_identity_id = $1::uuid and status = 'active'
        order by last_message_at desc
        limit 1`,
      identity.id
    );
    const conversation = active[0] ?? (await tx.$queryRawUnsafe<Array<{
      id: string; status: WhatsAppConversationSummary["status"]; current_step: string; language: string | null; last_message_at: Date | string;
    }>>(
      `insert into public.whatsapp_conversations (whatsapp_identity_id)
       values ($1::uuid)
       returning id, status, current_step, language, last_message_at`,
      identity.id
    ))[0];
    if (!conversation) throw new Error("Unable to start a WhatsApp conversation.");
    return {
      id: conversation.id,
      phoneNumber: identity.external_identity,
      status: conversation.status,
      currentStep: conversation.current_step,
      language: conversation.language,
      lastMessageAt: new Date(conversation.last_message_at).toISOString()
    };
  });
}

/** Persists a dashboard message in the shared conversation without relaying it through Vonage. */
export async function recordDashboardConversationMessage(identityId: string, conversationId: string, direction: "inbound" | "outbound", text: string) {
  const db = database();
  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `insert into public.whatsapp_messages
         (whatsapp_identity_id, whatsapp_conversation_id, provider, channel, external_message_id, direction, message_type, text_content, delivery_status)
       values ($1::uuid, $2::uuid, 'laut-dashboard', 'web', $3, $4, 'text', $5, 'delivered')`,
      identityId,
      conversationId,
      randomUUID(),
      direction,
      text
    );
    await tx.$executeRawUnsafe(
      `update public.whatsapp_conversations set last_message_at = now() where id = $1::uuid`,
      conversationId
    );
  });
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
      `select identity.id, identity.profile_id, profile.display_name from public.whatsapp_identities identity join public.profiles profile on profile.id = identity.profile_id
       where identity.provider = $1 and identity.channel = $2 and identity.external_identity = $3 limit 1`,
      message.provider, message.channel, normalizeWhatsAppNumber(message.from)
    );
    const identity = identities[0];
    if (!identity || typeof identity.id !== "string") return { duplicate: false, linked: false, profileName: null };
    await tx.$executeRawUnsafe(`update public.whatsapp_conversations set status = 'expired' where whatsapp_identity_id = $1::uuid and status = 'active' and expires_at <= now()`, identity.id);
    let conversations = await tx.$queryRawUnsafe<Row[]>(
      `select id, current_step, language, draft from public.whatsapp_conversations where whatsapp_identity_id = $1::uuid and status = 'active' and expires_at > now() limit 1`, identity.id
    );
    if (!conversations[0]) {
      conversations = await tx.$queryRawUnsafe<Row[]>(
        `insert into public.whatsapp_conversations (whatsapp_identity_id) values ($1::uuid) returning id, current_step, language, draft`, identity.id
      );
    }
    const conversation = conversations[0];
    const conversationId = conversation?.id;
    if (typeof conversationId !== "string" || typeof identity.profile_id !== "string") throw new Error("WhatsApp conversation data is invalid.");
    await tx.$executeRawUnsafe(
      `update public.whatsapp_messages set whatsapp_identity_id = $1::uuid, whatsapp_conversation_id = $2::uuid where id = $3::uuid`,
      identity.id, conversationId, inserted[0].id
    );
    await tx.$executeRawUnsafe(`update public.whatsapp_conversations set last_message_at = now() where id = $1::uuid`, conversationId);
    return {
      duplicate: false,
      linked: true,
      profileName: typeof identity.display_name === "string" ? identity.display_name : null,
      identityId: identity.id as string,
      conversation: {
        id: conversationId,
        profileId: identity.profile_id,
        profileName: typeof identity.display_name === "string" ? identity.display_name : null,
        currentStep: typeof conversation.current_step === "string" ? conversation.current_step : "awaiting_intent",
        language: typeof conversation.language === "string" ? conversation.language : null,
        draft: conversation.draft && typeof conversation.draft === "object" && !Array.isArray(conversation.draft)
          ? conversation.draft as Record<string, unknown>
          : {}
      }
    };
  });
}

export async function saveConversation(conversation: WhatsAppConversation) {
  await database().$executeRawUnsafe(
    `update public.whatsapp_conversations
     set current_step = $1, language = $2, draft = $3::jsonb, last_message_at = now(), expires_at = now() + interval '24 hours'
     where id = $4::uuid and status = 'active'`,
    conversation.currentStep,
    conversation.language,
    JSON.stringify(conversation.draft),
    conversation.id
  );
}

export async function closeConversation(conversationId: string) {
  await database().$executeRawUnsafe(
    `update public.whatsapp_conversations set status = 'closed', last_message_at = now() where id = $1::uuid and status = 'active'`,
    conversationId
  );
}

export async function recordOutboundMessage(identityId: string | undefined, conversationId: string | undefined, message: SentChannelMessage, text: string) {
  await database().$executeRawUnsafe(
    `insert into public.whatsapp_messages (whatsapp_identity_id, whatsapp_conversation_id, provider, channel, external_message_id, direction, message_type, text_content)
     values ($1::uuid, $2::uuid, $3, $4, $5, 'outbound', 'text', $6)
     on conflict (provider, channel, external_message_id) do nothing`,
    identityId ?? null,
    conversationId ?? null,
    message.provider,
    message.channel,
    message.externalMessageId,
    text
  );
}

export async function recordDeliveryStatus(status: DeliveryStatus) {
  await database().$executeRawUnsafe(
    `update public.whatsapp_messages set delivery_status = $1 where provider = $2 and channel = $3 and external_message_id = $4`,
    status.status, status.provider, status.channel, status.externalMessageId
  );
}
