"use client";

import { useMemo, useState } from "react";
import { CheckCheck, CircleAlert, RefreshCw, Smartphone } from "lucide-react";
import { AsyncBoundary } from "@/components/app/AsyncBoundary";
import { OperationsShell } from "@/components/app/OperationsShell";
import { PageHeader } from "@/components/app/PageHeader";
import { useAsyncData } from "@/hooks/useAsyncData";
import {
  listWhatsAppConversations,
  listWhatsAppMessages,
  type WhatsAppConversation
} from "./api/whatsapp.api";

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function statusLabel(status: WhatsAppConversation["status"]) {
  return status === "active" ? "Active" : status === "closed" ? "Closed" : "Expired";
}

export function WhatsAppView() {
  const [selectedConversationId, setSelectedConversationId] = useState<string>();
  const { data: conversations, error: conversationsError, isLoading: conversationsLoading, reload: reloadConversations } = useAsyncData(
    listWhatsAppConversations,
    []
  );

  const selectedConversation = useMemo(
    () => conversations?.find((conversation) => conversation.id === selectedConversationId) ?? conversations?.[0],
    [conversations, selectedConversationId]
  );

  const { data: messages, error: messagesError, isLoading: messagesLoading, reload: reloadMessages } = useAsyncData(
    () => selectedConversation ? listWhatsAppMessages(selectedConversation.id) : Promise.resolve([]),
    [selectedConversation?.id]
  );

  const reload = () => {
    reloadConversations();
    reloadMessages();
  };

  return (
    <OperationsShell>
      <a className="skip-link" href="#whatsapp-content">Skip to WhatsApp conversations</a>
      <main className="mx-auto flex h-[calc(100dvh-3.5rem)] max-w-[92rem] flex-col overflow-hidden px-7 py-6" id="whatsapp-content" tabIndex={-1}>
        <PageHeader
          breadcrumb="Operations / WhatsApp"
          description="Messages are read from the verified WhatsApp identity linked to your signed-in LAUT account. Refresh when you need the latest messages."
          title="WhatsApp batch assistant"
          actions={
            <button
              className="inline-flex h-10 items-center gap-2 border border-[var(--line-strong)] bg-[var(--surface)] px-3 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
              onClick={reload}
              type="button"
            >
              <RefreshCw aria-hidden="true" size={15} strokeWidth={1.75} />
              Refresh
            </button>
          }
        />

        <div className="mt-6 min-h-0 flex-1">
          <AsyncBoundary
            emptyMessage="Link a verified WhatsApp number to this account, then send a message to LAUT to begin a batch conversation."
            emptyTitle="No linked conversations"
            error={conversationsError}
            isEmpty={(conversations?.length ?? 0) === 0}
            isLoading={conversationsLoading}
          >
          <div className="grid h-full min-h-0 grid-cols-1 grid-rows-[minmax(12rem,0.45fr)_minmax(0,1fr)] overflow-hidden border border-[var(--line)] bg-[var(--surface)] lg:grid-cols-[17rem_minmax(0,1fr)] lg:grid-rows-1">
            <aside className="flex min-h-0 flex-col border-b border-[var(--line)] bg-[var(--surface-subtle)] lg:border-r lg:border-b-0">
              <div className="border-b border-[var(--line)] px-4 py-4">
                <p className="text-xs font-medium text-[var(--muted)]">Linked conversations</p>
              </div>
              <div className="min-h-0 flex-1 divide-y divide-[var(--line)] overflow-y-auto">
                {(conversations ?? []).map((conversation) => {
                  const isSelected = selectedConversation?.id === conversation.id;
                  return (
                    <button
                      className={`w-full px-4 py-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus)] ${isSelected ? "bg-[var(--surface)]" : "hover:bg-white/60"}`}
                      key={conversation.id}
                      onClick={() => setSelectedConversationId(conversation.id)}
                      type="button"
                    >
                      <span className="flex items-center justify-between gap-2"><span className="font-mono text-xs text-[var(--ink)]">+{conversation.phoneNumber}</span><span className={`h-2 w-2 rounded-full ${conversation.status === "active" ? "bg-[var(--brand)]" : "bg-[var(--line-strong)]"}`} /></span>
                      <span className="mt-2 block text-xs text-[var(--muted)]">{statusLabel(conversation.status)} · {conversation.currentStep.replace(/^awaiting_/, "")}</span>
                      <span className="mt-2 block text-[11px] text-[var(--muted)]">{formatDate(conversation.lastMessageAt)}</span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <section aria-label="Conversation messages" className="flex min-h-0 min-w-0 flex-col">
              <header className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
                <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center bg-[var(--brand-soft)] text-[var(--brand)]"><Smartphone aria-hidden="true" size={17} strokeWidth={1.75} /></span><div><p className="font-mono text-sm text-[var(--ink)]">+{selectedConversation?.phoneNumber}</p><p className="text-xs text-[var(--muted)]">{selectedConversation ? `${statusLabel(selectedConversation.status)} conversation` : ""}</p></div></div>
                <p className="text-xs text-[var(--muted)]">Read-only transcript</p>
              </header>

              <AsyncBoundary
                emptyMessage="This conversation has no messages yet."
                emptyTitle="No messages recorded"
                error={messagesError}
                isEmpty={(messages?.length ?? 0) === 0}
                isLoading={messagesLoading}
              >
                <ol className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5" role="list">
                  {(messages ?? []).map((message) => {
                    const outgoing = message.direction === "outbound";
                    return (
                      <li className={`flex ${outgoing ? "justify-end" : "justify-start"}`} key={message.id}>
                        <div className={`max-w-[75%] px-4 py-3 text-sm leading-6 ${outgoing ? "bg-[var(--brand)] text-white" : "border border-[var(--line)] bg-[var(--surface-subtle)] text-[var(--ink)]"}`}>
                          <p className="whitespace-pre-wrap">{message.text ?? "Unsupported message type"}</p>
                          <p className={`mt-2 flex items-center gap-1.5 text-[11px] ${outgoing ? "text-white/75" : "text-[var(--muted)]"}`}>
                            {formatDate(message.createdAt)}
                            {outgoing && <CheckCheck aria-hidden="true" size={13} strokeWidth={1.75} />}
                            {message.deliveryStatus ? ` ${message.deliveryStatus}` : ""}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </AsyncBoundary>
              <footer className="flex items-center gap-2 border-t border-[var(--line)] bg-[var(--surface-subtle)] px-5 py-3 text-xs leading-5 text-[var(--muted)]">
                <CircleAlert aria-hidden="true" className="shrink-0 text-[var(--risk)]" size={15} strokeWidth={1.75} />
                Reply in WhatsApp to keep the conversation and batch wizard in sync. Sending from the dashboard is intentionally unavailable.
              </footer>
            </section>
          </div>
          </AsyncBoundary>
        </div>
      </main>
    </OperationsShell>
  );
}
