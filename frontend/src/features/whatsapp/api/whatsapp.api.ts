import { apiRequest, toIsoTimestamp, toText } from "@/api/client";

export type WhatsAppConversation = {
  id: string;
  phoneNumber: string;
  status: "active" | "closed" | "expired";
  currentStep: string;
  language?: string;
  lastMessageAt: string;
};

export type WhatsAppMessage = {
  id: string;
  direction: "inbound" | "outbound";
  messageType: string;
  text?: string;
  deliveryStatus?: string;
  createdAt: string;
};

export type WhatsAppIdentity = {
  id: string;
  phoneNumber: string;
  verifiedAt?: string;
};

type ConversationRow = {
  id: string;
  phoneNumber: string;
  status: WhatsAppConversation["status"];
  currentStep: string;
  language: string | null;
  lastMessageAt: string;
};

type MessageRow = {
  id: string;
  direction: WhatsAppMessage["direction"];
  messageType: string;
  text: string | null;
  deliveryStatus: string | null;
  createdAt: string;
};

type IdentityRow = {
  id: string;
  phoneNumber: string;
  verifiedAt: string | null;
};

function toWhatsAppIdentity(identity: IdentityRow | null): WhatsAppIdentity | null {
  if (!identity) return null;
  return {
    id: identity.id,
    phoneNumber: identity.phoneNumber,
    verifiedAt: toIsoTimestamp(identity.verifiedAt)
  };
}

export async function getWhatsAppIdentity(): Promise<WhatsAppIdentity | null> {
  const { whatsappIdentity } = await apiRequest<{ whatsappIdentity: IdentityRow | null }>("/v1/whatsapp/identity");
  return toWhatsAppIdentity(whatsappIdentity);
}

export async function linkWhatsAppIdentity(phoneNumber: string): Promise<WhatsAppIdentity> {
  const { whatsappIdentity } = await apiRequest<{ whatsappIdentity: IdentityRow }>("/v1/whatsapp/identity", {
    method: "PUT",
    body: { phoneNumber }
  });
  const identity = toWhatsAppIdentity(whatsappIdentity);
  if (!identity) throw new Error("LAUT could not save that WhatsApp number.");
  return identity;
}

export async function listWhatsAppConversations(): Promise<WhatsAppConversation[]> {
  const { conversations } = await apiRequest<{ conversations: ConversationRow[] }>("/v1/whatsapp/conversations");
  return conversations.map((conversation) => ({
    ...conversation,
    language: toText(conversation.language),
    lastMessageAt: toIsoTimestamp(conversation.lastMessageAt) ?? conversation.lastMessageAt
  }));
}

export async function listWhatsAppMessages(conversationId: string): Promise<WhatsAppMessage[]> {
  const { messages } = await apiRequest<{ messages: MessageRow[] }>(
    `/v1/whatsapp/conversations/${conversationId}/messages`
  );
  return messages.map((message) => ({
    ...message,
    text: toText(message.text),
    deliveryStatus: toText(message.deliveryStatus),
    createdAt: toIsoTimestamp(message.createdAt) ?? message.createdAt
  }));
}

export async function startWhatsAppConversation(restart = false): Promise<WhatsAppConversation> {
  const { conversation } = await apiRequest<{ conversation: ConversationRow }>("/v1/whatsapp/conversations", {
    method: "POST",
    body: { restart }
  });
  return {
    ...conversation,
    language: toText(conversation.language),
    lastMessageAt: toIsoTimestamp(conversation.lastMessageAt) ?? conversation.lastMessageAt
  };
}

/** Sends into the same deterministic batch wizard as an inbound WhatsApp message. */
export async function sendWhatsAppConversationMessage(conversationId: string, text: string): Promise<void> {
  await apiRequest(`/v1/whatsapp/conversations/${conversationId}/messages`, {
    method: "POST",
    body: { text }
  });
}
