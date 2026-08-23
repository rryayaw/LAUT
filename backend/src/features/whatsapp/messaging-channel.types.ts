export type InboundChannelMessage = {
  provider: "vonage";
  channel: "whatsapp";
  externalMessageId: string;
  from: string;
  text?: string;
};

export type DeliveryStatus = {
  provider: "vonage";
  channel: "whatsapp";
  externalMessageId: string;
  status: string;
};

export type SentChannelMessage = {
  provider: "vonage";
  channel: "whatsapp";
  externalMessageId: string;
};

export interface MessagingChannelAdapter {
  isConfigured(): boolean;
  hasValidWebhookSignature(authorization: string | undefined): boolean;
  parseInbound(payload: unknown): InboundChannelMessage | undefined;
  parseDeliveryStatus(payload: unknown): DeliveryStatus | undefined;
  sendText(input: { to: string; text: string }): Promise<SentChannelMessage>;
}
