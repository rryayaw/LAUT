"use client";

import { type FormEvent, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CircleAlert, LoaderCircle, Plus, RefreshCw, Send, Smartphone } from "lucide-react";
import { AsyncBoundary } from "@/components/app/AsyncBoundary";
import { OperationsShell } from "@/components/app/OperationsShell";
import { PageHeader } from "@/components/app/PageHeader";
import { useAsyncData } from "@/hooks/useAsyncData";
import {
  listWhatsAppConversations,
  listWhatsAppMessages,
  sendWhatsAppConversationMessage,
  startWhatsAppConversation,
  type WhatsAppConversation
} from "./api/whatsapp.api";

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function statusLabel(status: WhatsAppConversation["status"]) {
  return status === "active" ? "Active" : status === "closed" ? "Closed" : "Expired";
}

function renderInlineAssistantMarkdown(text: string) {
  return text.split(/(\*[^*]+\*|_[^_]+_)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith("*") && part.endsWith("*")) return <strong key={index}>{part.slice(1, -1)}</strong>;
    if (part.startsWith("_") && part.endsWith("_")) return <em key={index}>{part.slice(1, -1)}</em>;
    return <span key={index}>{part}</span>;
  });
}

function AssistantMessageText({ text }: Readonly<{ text: string }>) {
  return (
    <div className="space-y-1 whitespace-pre-wrap">
      {text.split("\n").map((line, index) => (
        <p key={index}>{renderInlineAssistantMarkdown(line)}</p>
      ))}
    </div>
  );
}

export function WhatsAppView() {
  const [selectedConversationId, setSelectedConversationId] = useState<string>();
  const [draftMessage, setDraftMessage] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [writeError, setWriteError] = useState<string>();
  const transcriptRef = useRef<HTMLOListElement>(null);
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

  useLayoutEffect(() => {
    const transcript = transcriptRef.current;
    if (!transcript || !messages?.length) return;
    const frame = requestAnimationFrame(() => {
      transcript.scrollTop = transcript.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [messages]);

  const reload = () => {
    reloadConversations();
    reloadMessages();
  };

  async function startConversation(restart = false) {
    if (restart && !window.confirm("Start a new chat? Your current draft conversation will be closed, but its history will remain available.")) return;
    setIsStarting(true);
    setWriteError(undefined);
    try {
      const conversation = await startWhatsAppConversation(restart);
      setSelectedConversationId(conversation.id);
      reloadConversations();
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : "Unable to start a conversation.");
    } finally {
      setIsStarting(false);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedConversation || !draftMessage.trim() || isSending) return;
    setIsSending(true);
    setWriteError(undefined);
    try {
      await sendWhatsAppConversationMessage(selectedConversation.id, draftMessage.trim());
      setDraftMessage("");
      reloadMessages();
      reloadConversations();
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : "Unable to send this message.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <OperationsShell>
      <a className="skip-link" href="#batch-assistant-content">Skip to batch assistant conversations</a>
      <main className="mx-auto flex h-[calc(100dvh-3.5rem)] max-w-[92rem] flex-col overflow-hidden px-7 py-6" id="batch-assistant-content" tabIndex={-1}>
        <PageHeader
          breadcrumb="Operations / Batch assistant"
          description="Start, review, and confirm production batches in one guided conversation."
          title="LAUT batch assistant"
          actions={
            <div className="flex items-center gap-2">
              {(conversations?.length ?? 0) > 0 ? (
                <button
                  className="inline-flex h-10 items-center gap-2 bg-[var(--brand)] px-3 text-sm font-medium text-white transition hover:bg-[var(--brand-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isStarting}
                  onClick={() => void startConversation(conversations?.some((conversation) => conversation.status === "active"))}
                  type="button"
                >
                  {isStarting ? <LoaderCircle aria-hidden="true" className="animate-spin" size={15} strokeWidth={1.75} /> : <Plus aria-hidden="true" size={15} strokeWidth={1.75} />}
                  New chat
                </button>
              ) : null}
              <button
                className="inline-flex h-10 items-center gap-2 border border-[var(--line-strong)] bg-[var(--surface)] px-3 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
                onClick={reload}
                type="button"
              >
                <RefreshCw aria-hidden="true" size={15} strokeWidth={1.75} />
                Refresh
              </button>
            </div>
          }
        />

        <div className="mt-6 min-h-0 flex-1">
          <AsyncBoundary
            error={conversationsError}
            isLoading={conversationsLoading}
          >
          {(conversations?.length ?? 0) === 0 ? (
            <section className="flex h-full min-h-[18rem] flex-col items-center justify-center border-y border-[var(--line)] bg-[var(--surface)] px-6 text-center">
              <span className="grid h-11 w-11 place-items-center bg-[var(--brand-soft)] text-[var(--brand)]"><Smartphone aria-hidden="true" size={20} strokeWidth={1.75} /></span>
              <h2 className="mt-4 text-lg font-semibold tracking-tight text-[var(--ink)]">Start a batch conversation</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">Start a guided batch conversation here. Messages remain in this transcript and are not sent to your linked phone.</p>
              <button
                className="mt-5 inline-flex h-10 items-center gap-2 bg-[var(--brand)] px-4 text-sm font-medium text-white transition hover:bg-[var(--brand-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isStarting}
                onClick={() => void startConversation()}
                type="button"
              >
                {isStarting ? <LoaderCircle aria-hidden="true" className="animate-spin" size={16} strokeWidth={1.75} /> : <Plus aria-hidden="true" size={16} strokeWidth={1.75} />}
                {isStarting ? "Starting…" : "Start conversation"}
              </button>
              {writeError ? <p className="mt-3 text-sm text-[var(--risk)]" role="alert">{writeError}</p> : null}
            </section>
          ) : (
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
                <p className="text-xs text-[var(--muted)]">Guided batch chat</p>
              </header>

              <AsyncBoundary
                className="flex min-h-0 flex-1 flex-col"
                emptyMessage="This conversation has no messages yet."
                emptyTitle="No messages recorded"
                error={messagesError}
                isEmpty={(messages?.length ?? 0) === 0}
                isLoading={messagesLoading}
              >
                <ol className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5" ref={transcriptRef} role="list">
                  {(messages ?? []).map((message) => {
                    const isLautMessage = message.direction === "outbound";
                    return (
                      <li className={`flex ${isLautMessage ? "justify-start" : "justify-end"}`} key={message.id}>
                        <div className={`max-w-[75%] px-4 py-3 text-sm leading-6 ${isLautMessage ? "border border-[var(--line)] bg-[var(--surface-subtle)] text-[var(--ink)]" : "bg-[var(--brand)] text-white"}`}>
                          {isLautMessage
                            ? <AssistantMessageText text={message.text ?? "Unsupported message type"} />
                            : <p className="whitespace-pre-wrap">{message.text ?? "Unsupported message type"}</p>}
                          <p className={`mt-2 flex items-center gap-1.5 text-[11px] ${isLautMessage ? "text-[var(--muted)]" : "text-white/75"}`}>
                            {formatDate(message.createdAt)}
                            {message.deliveryStatus ? ` ${message.deliveryStatus}` : ""}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </AsyncBoundary>
              <footer className="shrink-0 border-t border-[var(--line)] bg-[var(--surface-subtle)] px-5 py-3">
                {writeError ? <p className="mb-2 text-xs leading-5 text-[var(--risk)]" role="alert">{writeError}</p> : null}
                <form className="flex items-end gap-3" onSubmit={sendMessage}>
                  <label className="sr-only" htmlFor="dashboard-batch-message">Message the batch assistant</label>
                  <textarea
                    className="min-h-10 flex-1 resize-none border border-[var(--line-strong)] bg-[var(--surface)] px-3 py-2 text-sm leading-5 text-[var(--ink)] placeholder:text-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!selectedConversation || selectedConversation.status !== "active" || isSending}
                    id="dashboard-batch-message"
                    onChange={(event) => setDraftMessage(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
                    placeholder={selectedConversation?.status === "active" ? "Reply to the batch assistant…" : "Start an active conversation to reply"}
                    rows={1}
                    value={draftMessage}
                  />
                  <button
                    aria-label="Send message"
                    className="grid h-10 w-10 shrink-0 place-items-center bg-[var(--brand)] text-white transition hover:bg-[var(--brand-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!selectedConversation || selectedConversation.status !== "active" || !draftMessage.trim() || isSending}
                    type="submit"
                  >
                    {isSending ? <LoaderCircle aria-hidden="true" className="animate-spin" size={16} strokeWidth={1.75} /> : <Send aria-hidden="true" size={16} strokeWidth={1.75} />}
                  </button>
                </form>
                <p className="mt-2 flex items-center gap-2 text-xs leading-5 text-[var(--muted)]"><CircleAlert aria-hidden="true" className="shrink-0 text-[var(--risk)]" size={14} strokeWidth={1.75} /> Press Enter to send. Use Shift+Enter for a new line.</p>
              </footer>
            </section>
          </div>
          )}
          </AsyncBoundary>
        </div>
      </main>
    </OperationsShell>
  );
}
