"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AsyncBoundary } from "@/components/app/AsyncBoundary";
import { OperationsShell } from "@/components/app/OperationsShell";
import { PageHeader } from "@/components/app/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WHATSAPP_IDENTITY_UPDATED_EVENT } from "@/components/app/WhatsAppNumberPrompt";
import { useAsyncData } from "@/hooks/useAsyncData";
import { getWhatsAppIdentity, linkWhatsAppIdentity } from "@/features/whatsapp/api/whatsapp.api";
import { listLossCategories, listProcessTags, listProductConfigs } from "./api/processing-config.api";

export function ProcessingConfigView() {
  const { data: configs, error, isLoading } = useAsyncData(() => listProductConfigs(), []);
  const { data: lossCategories } = useAsyncData(() => listLossCategories(), []);
  const { data: processTags } = useAsyncData(() => listProcessTags(), []);
  const { data: whatsappIdentity, error: whatsappError, isLoading: isLoadingWhatsApp, reload: reloadWhatsApp } = useAsyncData(() => getWhatsAppIdentity(), []);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [saveError, setSaveError] = useState<string>();
  const [isSavingWhatsApp, setIsSavingWhatsApp] = useState(false);

  useEffect(() => {
    setPhoneNumber(whatsappIdentity?.phoneNumber ?? "");
  }, [whatsappIdentity]);

  async function saveWhatsAppNumber(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError(undefined);
    setIsSavingWhatsApp(true);
    try {
      await linkWhatsAppIdentity(phoneNumber);
      window.dispatchEvent(new Event(WHATSAPP_IDENTITY_UPDATED_EVENT));
      reloadWhatsApp();
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "Unable to save that WhatsApp number. Please try again.");
    } finally {
      setIsSavingWhatsApp(false);
    }
  }

  return (
    <OperationsShell>
      <a className="skip-link" href="#configuration-content">Skip to configuration</a>
      <main className="mx-auto max-w-[92rem] px-7 py-6" id="configuration-content" tabIndex={-1}>
        <PageHeader
          breadcrumb="Operations / configuration"
          description="What LAUT treats as comparable, how loss is categorised, and the measurement tolerance it applies. These settings shape every calculation."
          title="Processing configuration"
        />

        <div className="mt-6 space-y-6">
          <section aria-labelledby="whatsapp-number-title" className="border-y border-[var(--line)] bg-[var(--surface)]">
            <div className="border-b border-[var(--line)] px-5 py-4">
              <p className="text-xs font-medium text-[var(--muted)]">Batch assistant</p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight" id="whatsapp-number-title">WhatsApp number</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">Use the number your team messages LAUT from. Changing it updates future WhatsApp conversations for this workspace.</p>
            </div>
            <form className="flex items-end gap-4 px-5 py-5" onSubmit={saveWhatsAppNumber}>
              <label className="grid max-w-md flex-1 gap-2 text-sm font-medium text-[var(--ink)]" htmlFor="configuration-whatsapp-number">
                {whatsappIdentity ? "Linked WhatsApp number" : "WhatsApp number"}
                <Input
                  autoComplete="tel"
                  className="h-11 rounded-none border-[var(--line-strong)] bg-[var(--canvas)] text-[var(--ink)] placeholder:text-[var(--muted)] focus-visible:ring-[var(--focus)]"
                  disabled={isLoadingWhatsApp}
                  id="configuration-whatsapp-number"
                  inputMode="tel"
                  onChange={(event) => setPhoneNumber(event.target.value)}
                  placeholder="e.g. +628123456789"
                  required
                  type="tel"
                  value={phoneNumber}
                />
              </label>
              <Button className="h-11 rounded-none bg-[var(--brand)] px-4 text-white hover:bg-[var(--brand-strong)]" disabled={isSavingWhatsApp || isLoadingWhatsApp} type="submit">
                {isSavingWhatsApp ? "Saving…" : whatsappIdentity ? "Change number" : "Add number"}
              </Button>
            </form>
            {whatsappError ? <p className="border-t border-[var(--line)] px-5 py-3 text-sm text-[var(--risk)]" role="alert">Unable to load the WhatsApp setting. Refresh and try again.</p> : null}
            {saveError ? <p aria-live="polite" className="border-t border-[var(--line)] px-5 py-3 text-sm text-[var(--risk)]" role="alert">{saveError}</p> : null}
            <p className="border-t border-[var(--line)] px-5 py-3 text-[11px] leading-4 text-[var(--muted)]">Include your country code. In the production setup, changing this number should be confirmed through a WhatsApp ownership check.</p>
          </section>

          <AsyncBoundary error={error} isLoading={isLoading}>
            <section aria-labelledby="product-config-title" className="border-y border-[var(--line)] bg-[var(--surface)]">
              <div className="border-b border-[var(--line)] px-5 py-4">
                <p className="text-xs font-medium text-[var(--muted)]">Comparison basis</p>
                <h2 className="mt-1 text-lg font-semibold tracking-tight" id="product-config-title">Species and product specifications</h2>
              </div>
              <table className="w-full border-collapse text-left text-sm">
                <thead className="border-b border-[var(--line)] bg-[var(--surface-subtle)] text-xs font-medium text-[var(--muted)]">
                  <tr>
                    <th className="px-5 py-3 font-medium">Species</th>
                    <th className="px-4 py-3 font-medium">Product specification</th>
                    <th className="px-4 py-3 font-medium">State</th>
                    <th className="px-4 py-3 font-medium">Production site</th>
                    <th className="px-4 py-3 font-medium">Observed median yield</th>
                    <th className="px-4 py-3 font-medium">Mass-balance tolerance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {(configs ?? []).map((config) => (
                    <tr className="transition-colors duration-150 hover:bg-[var(--surface-subtle)]" key={config.id}>
                      <td className="px-5 py-3.5 font-medium text-[var(--ink)]">{config.species}</td>
                      <td className="px-4 py-3.5">{config.productSpec}</td>
                      <td className="px-4 py-3.5"><Badge tone="soft">{config.chilledOrFrozen === "chilled" ? "Chilled" : "Frozen"}</Badge></td>
                      <td className="px-4 py-3.5 text-xs text-[var(--muted)]">{config.siteName}</td>
                      <td className="px-4 py-3.5 font-mono text-xs font-semibold text-[var(--brand)]">
                        {config.observedMedianYieldPct}%
                        <span className="ml-2 font-sans font-normal text-[var(--muted)]">n={config.sampleSize}</span>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs">±{config.massBalanceTolerancePct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-[var(--line)] px-5 py-3 text-[11px] leading-4 text-[var(--muted)]">
                Batches are only compared within the same species and specification. The yield shown is the median
                measured across confirmed batches, not a target — LAUT does not set expectations for a process it has
                only observed. The tolerance is operator-set and is never inferred by the AI.
              </p>
            </section>

            <section aria-labelledby="loss-taxonomy-title" className="border-y border-[var(--line)] bg-[var(--surface)]">
              <div className="border-b border-[var(--line)] px-5 py-4">
                <p className="text-xs font-medium text-[var(--muted)]">Mass balance</p>
                <h2 className="mt-1 text-lg font-semibold tracking-tight" id="loss-taxonomy-title">Loss taxonomy</h2>
              </div>
              <div className="divide-y divide-[var(--line)]">
                {(lossCategories ?? []).map((category) => (
                  <article className="flex items-start gap-4 px-5 py-3.5" key={category.code}>
                    <span aria-hidden="true" className={`mt-1 h-3 w-3 shrink-0 balance-${category.tone}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-sm font-medium text-[var(--ink)]">{category.label}</h3>
                        <Badge tone={category.countsAsLoss ? "risk" : "neutral"}>
                          {category.countsAsLoss ? "Counts as loss" : "Not a loss"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{category.description}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section aria-labelledby="tag-catalogue-title" className="border-y border-[var(--line)] bg-[var(--surface)]">
              <div className="border-b border-[var(--line)] px-5 py-4">
                <p className="text-xs font-medium text-[var(--muted)]">Line context</p>
                <h2 className="mt-1 text-lg font-semibold tracking-tight" id="tag-catalogue-title">Process tag catalogue</h2>
              </div>
              <div className="grid grid-cols-3 divide-x divide-y divide-[var(--line)]">
                {(processTags ?? []).map((tag) => (
                  <article className="px-5 py-3.5" key={tag.code}>
                    <Badge tone="soft">{tag.label}</Badge>
                    <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{tag.description}</p>
                  </article>
                ))}
              </div>
              <p className="border-t border-[var(--line)] px-5 py-3 text-[11px] leading-4 text-[var(--muted)]">
                Tags describe what a line does and become retrievable context for explanation. A tag is never
                treated as evidence that a line caused a loss.
              </p>
            </section>
          </AsyncBoundary>
        </div>
      </main>
    </OperationsShell>
  );
}
