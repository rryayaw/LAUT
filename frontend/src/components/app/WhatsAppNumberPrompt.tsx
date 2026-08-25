"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { MessageCircle, Phone } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAsyncData } from "@/hooks/useAsyncData";
import { getWhatsAppIdentity, linkWhatsAppIdentity } from "@/features/whatsapp/api/whatsapp.api";

export const WHATSAPP_NUMBER_PROMPT_SESSION_KEY = "laut-whatsapp-number-prompted";
export const WHATSAPP_IDENTITY_UPDATED_EVENT = "laut-whatsapp-identity-updated";

/**
 * A non-blocking reminder plus a first-visit modal for users who have not yet
 * connected the WhatsApp number used for their batch conversations.
 */
export function WhatsAppNumberPrompt() {
  const { data: identity, error: identityError, isLoading, reload } = useAsyncData(() => getWhatsAppIdentity(), []);
  const [isOpen, setIsOpen] = useState(false);
  const hasAutoOpened = useRef(false);

  useEffect(() => {
    const wasPromptedThisLogin = window.sessionStorage.getItem(WHATSAPP_NUMBER_PROMPT_SESSION_KEY) === "true";
    if (!isLoading && !identity && !identityError && !hasAutoOpened.current && !wasPromptedThisLogin) {
      hasAutoOpened.current = true;
      window.sessionStorage.setItem(WHATSAPP_NUMBER_PROMPT_SESSION_KEY, "true");
      setIsOpen(true);
    }
  }, [identity, identityError, isLoading]);

  useEffect(() => {
    window.addEventListener(WHATSAPP_IDENTITY_UPDATED_EVENT, reload);
    return () => window.removeEventListener(WHATSAPP_IDENTITY_UPDATED_EVENT, reload);
  }, [reload]);

  if (isLoading || identity || identityError) return null;

  return (
    <>
      <aside className="mx-7 mt-5 flex items-center justify-between gap-4 border border-[var(--line-strong)] bg-[var(--brand-soft)] px-4 py-3 text-[var(--ink)]" role="status">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center bg-[var(--surface)] text-[var(--brand)]">
            <MessageCircle aria-hidden="true" size={18} strokeWidth={1.75} />
          </span>
          <div>
            <p className="text-sm font-semibold">Don’t forget to add your WhatsApp number</p>
            <p className="mt-0.5 text-xs leading-5 text-[var(--muted)]">Keep your batch assistant conversations connected to this workspace.</p>
          </div>
        </div>
        <Button className="h-11 shrink-0 rounded-none bg-[var(--brand)] px-4 text-white shadow-none hover:bg-[var(--brand-strong)]" onClick={() => setIsOpen(true)} type="button">
          Add number
        </Button>
      </aside>
      <WhatsAppNumberDialog onLinked={reload} onOpenChange={setIsOpen} open={isOpen} />
    </>
  );
}

function WhatsAppNumberDialog({ onLinked, onOpenChange, open }: Readonly<{ onLinked: () => void; onOpenChange: (open: boolean) => void; open: boolean }>) {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [error, setError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setIsSaving(true);
    try {
      await linkWhatsAppIdentity(phoneNumber);
      window.dispatchEvent(new Event(WHATSAPP_IDENTITY_UPDATED_EVENT));
      onLinked();
      onOpenChange(false);
      router.push("/configuration");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to add that WhatsApp number. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-[31rem] gap-0 rounded-none border-[var(--line-strong)] bg-[var(--surface)] p-0 shadow-[0_24px_64px_-32px_rgb(19_56_82_/_55%)]">
        <DialogHeader className="border-b border-[var(--line)] px-6 py-5 text-left">
          <span className="mb-4 grid h-10 w-10 place-items-center bg-[var(--brand-soft)] text-[var(--brand)]">
            <Phone aria-hidden="true" size={20} strokeWidth={1.75} />
          </span>
          <DialogTitle className="text-xl font-semibold tracking-tight text-[var(--ink)]">Add your WhatsApp number</DialogTitle>
          <DialogDescription className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
            Use the number your team will message LAUT from. It keeps those batch conversations linked to your workspace.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <div className="px-6 py-5">
            <label className="grid gap-2 text-sm font-medium text-[var(--ink)]" htmlFor="whatsapp-number">
              WhatsApp number
              <Input
                autoComplete="tel"
                autoFocus
                className="h-11 rounded-none border-[var(--line-strong)] bg-[var(--canvas)] text-[var(--ink)] placeholder:text-[var(--muted)] focus-visible:ring-[var(--focus)]"
                id="whatsapp-number"
                inputMode="tel"
                onChange={(event) => setPhoneNumber(event.target.value)}
                placeholder="e.g. +628123456789"
                required
                type="tel"
                value={phoneNumber}
              />
            </label>
            <p className="mt-2 text-xs leading-5 text-[var(--muted)]">Include your country code. You can close this and add it later from the reminder above.</p>
            {error ? <p aria-live="polite" className="mt-4 border border-red-200 bg-red-50 px-3 py-2 text-sm leading-5 text-red-800" role="alert">{error}</p> : null}
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-[var(--line)] px-6 py-4">
            <Button className="h-11 rounded-none" onClick={() => onOpenChange(false)} type="button" variant="outline">Add later</Button>
            <Button className="h-11 rounded-none bg-[var(--brand)] text-white hover:bg-[var(--brand-strong)]" disabled={isSaving} type="submit">
              {isSaving ? "Saving…" : "Save number"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
