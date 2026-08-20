# LAUT — Product Source of Truth

Last updated: 2026-08-20

## Product definition

LAUT is an AI-powered, web-first production intelligence platform for Indonesian seafood processors. It records and analyses batch-level yield and production losses, identifies abnormal performance among comparable historical batches, and supports human-led investigation. WhatsApp is an integrated, low-friction operational channel; the web application remains the complete system of record.

## MVP focus

The first use case is a narrow fish-filleting operation: one species/product configuration, measurable raw-material input, sellable output, and loss categories. The intended workflow is:

```text
Configure operation → report batch → validate → confirm → calculate yield
→ compare similar batches → detect abnormal loss → explain evidence
→ recommend investigation → human approves or dismisses
```

## Product principles

- Web-first and channel-flexible: web and WhatsApp use the same backend domain logic.
- Measure before interpretation: deterministic backend code calculates yield, mass balance, ratios, and validation results.
- Compare like with like: historical comparison is limited to relevant, comparable batches.
- Investigation, not accusation: identify associations worth checking, never assert unsupported causation.
- Human control: only confirmed records become trusted history; people approve, modify, or dismiss investigations.

## Domain model clarifications

These rules supersede older wording that used "processing unit" as a broad placeholder.

- User-to-site access: one user can be attached to multiple production sites. A production site represents a physical plant, facility, or operating location that the user can access.
- Site-to-line structure: one production site can contain multiple production lines. A production line is the operational path where a batch is processed, such as a fillet line, trimming line, packing line, or combined flow.
- Batch-to-line relationship: each batch must belong to one production site and must be linked to one or more production lines. Multi-line batches are allowed when the same batch moves through or is split across multiple lines.
- Batch variables: each batch stores confirmed production measurements and context variables such as raw-material input, sellable output, trimming, reject, by-product, spoilage, unexplained mass, receiving condition, supplier, shift, fish size, process duration, and operator notes. Deterministic backend code uses these variables to calculate yield, mass balance, loss ratios, comparable-batch baselines, and anomaly inputs.
- Production-line process tags: each production line can have user-defined process tags, such as cutting, trimming, packaging, quality control, freezing, glazing, or rework. Tags are attached as badges based on the user's description of what the line does.
- Production-line context: the user's saved line description remains retrievable context for AI explanations, comparable-batch filtering, and investigation recommendations. The AI can use this context to explain evidence, but it must not convert vague descriptions into trusted production measurements without confirmation.

## Data and analysis responsibilities

- Production sites own their production lines, processing configuration, loss taxonomy, and site-level permissions.
- Production lines own process tags, saved process descriptions, expected process stages, and line-specific operating context.
- Batches own confirmed measurements, source-channel provenance, user corrections, linked production line IDs, and calculated analysis outputs.
- Comparable-batch retrieval should consider species, product specification, site, linked production lines, process tags/stages, fish-size category, chilled/frozen state, and other validated variables where available.
- Line/process evidence may support investigation recommendations, but LAUT must present it as association or operational context rather than proven causation.

## Technical baseline

| Layer | Baseline |
| --- | --- |
| Frontend | Next.js + TypeScript + Tailwind CSS |
| Backend | FastAPI + Python |
| Database | PostgreSQL |
| AI orchestration | LangGraph, when the workflow is implemented |
| ML/statistics | scikit-learn, pandas, scipy |
| Operational channel | Meta WhatsApp Cloud API, deferred |
| Local environment | Docker Compose |

## Repository structure

```text
frontend/     Next.js application
  src/app/    Next.js App Router files
  src/features/ feature-owned frontend code
backend/      FastAPI application and domain features
docs/         Product direction and change record
```

Feature code should remain self-contained in the relevant feature folder. Shared infrastructure is limited to genuine cross-cutting concerns.

## Current implementation state

The repository includes an executable local environment and a desktop-only dashboard mockup in the Next.js frontend. The dashboard presents local scenario data for confirmed batches, comparable yield, mass balance, supplier associations, production-site and production-line provenance, process tags, and human-led investigation review. It is organized as a feature-owned view with a local snapshot shaped for a future Supabase data layer.

The FastAPI health endpoint and PostgreSQL service remain foundational only. Batch management, real analytics, AI, authentication, WhatsApp integration, Supabase integration, and all operational write actions are intentionally not implemented yet.

## Guardrails

- Do not let an LLM invent production quantities.
- Do not use an LLM for deterministic calculations.
- Do not treat correlations as proven causation.
- Do not implement food-safety diagnosis, autonomous supplier rejection, or ERP scope.
- Never trust unconfirmed batch data as historical evidence.
