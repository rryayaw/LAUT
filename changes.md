# Changes

## 2026-08-18 — Repository foundation created

- Established LAUT as a web-first production intelligence platform with WhatsApp as an integrated operational channel.
- Added a minimal monorepo environment: Next.js frontend, FastAPI backend, PostgreSQL, and Docker Compose.
- Added `docs/project.md` as the current product source of truth.
- Deferred all product features, AI workflows, WhatsApp integration, authentication, and deployment configuration until the foundation is approved and requirements are implemented.

## 2026-08-19 — Desktop dashboard mockup implemented

- Promoted the dashboard from an empty frontend shell to a high-fidelity desktop mockup using local scenario data from the red-snapper PRD flow.
- Added a feature-owned dashboard view and local snapshot data shaped for a future Supabase repository/data layer; no backend or external data integration is implemented.
- Added an accessible investigation evidence sheet using Radix Dialog and a consistent Lucide icon set.
- Deferred non-dashboard routes, real batch actions, search, Supabase integration, and all operational write actions. Their disabled navigation state makes that scope explicit in the mockup.

## 2026-08-20 — Frontend structure aligned to repository rules

- Moved Next.js App Router files from the incorrect `src/components/app/` location to `src/app/`.
- Split the dashboard view into feature-owned domain components for navigation, metrics, batch review, investigation review, trend analysis, batch history, and supplier signals.
- Added the `@/` alias for `src/` imports and updated the Tailwind and generated CSS scripts for the `src/app/` route location.
- Added editable shadcn `Button` and `Sheet` primitives under `src/components/ui/`, plus the shared `cn` utility under `src/utils/`.
- Removed the empty `src/components/app/` and `src/components/app/lib/` directories; shared app-shell components will be added there only when they are genuinely shared.

## 2026-08-20 — Batch processing-unit provenance added

- Added processing unit as a first-class field on the dashboard's local batch contract, distinct from the processing facility.
- Updated the active review, investigation evidence, and batch history mockup to display the reported processing unit for each batch.

## 2026-08-20 — Development asset cache made self-healing

- Updated the frontend development command to clear only Next.js generated output before starting, preventing production build artifacts from causing development CSS and JavaScript asset 404s.

## 2026-08-20 — Production site, line, and batch model clarified

- Clarified that one user can access multiple production sites, each site can contain multiple production lines, and each batch belongs to one site while linking to one or more production lines.
- Promoted batch variables such as sellable output, spoilage, trimming, reject, by-product, unexplained mass, receiving condition, supplier, shift, and process duration as the deterministic inputs for yield, mass balance, anomaly, and investigation analysis.
- Replaced the broad processing-unit placeholder with production-line process tags and saved line descriptions as retrievable context for comparable-batch filtering, AI explanations, and investigation recommendations.
- Updated the dashboard mock data and labels to show production-site/line provenance and process tags instead of the older processing-unit field.
