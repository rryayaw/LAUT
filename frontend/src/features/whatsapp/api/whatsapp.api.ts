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
