import { Router } from "express";
import swaggerUi from "swagger-ui-express";

const uuid = { type: "string", format: "uuid" };
const bearer = [{ bearerAuth: [] }];
const pathId = (name: string) => ({ name, in: "path", required: true, schema: uuid });
const secured = (summary: string) => ({ summary, security: bearer, responses: { "200": { description: "Success" }, "401": { description: "Bearer token is missing, invalid, or expired" } } });
const jsonBody = (schema: object) => ({ required: true, content: { "application/json": { schema } } });

const openapi = {
  openapi: "3.0.3",
  info: { title: "LAUT API", version: "0.1.0", description: "Use Authorize with a Supabase user access token before trying protected endpoints." },
  servers: [{ url: "http://localhost:8000", description: "Local development" }],
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
    schemas: {
      SiteInput: { type: "object", required: ["name"], properties: { name: { type: "string", example: "Muara Baru Plant" }, timezone: { type: "string", example: "Asia/Jakarta" }, location: { type: ["string", "null"] }, notes: { type: ["string", "null"] } } },
      LineInput: { type: "object", required: ["name"], properties: { name: { type: "string", example: "Fillet Line A" }, description: { type: ["string", "null"] }, isActive: { type: "boolean", default: true } } },
      TagInput: { type: "object", required: ["capabilityTagId"], properties: { capabilityTagId: uuid, otherContext: { type: ["string", "null"] } } },
      BatchInput: { type: "object", required: ["manufacturingSiteId", "productionLineIds"], properties: { manufacturingSiteId: uuid, productionLineIds: { type: "array", minItems: 1, items: uuid }, sourceChannel: { type: "string", enum: ["web", "whatsapp"], default: "web" }, species: { type: ["string", "null"] }, productSpecification: { type: ["string", "null"] }, rawInputKg: { type: ["number", "null"], minimum: 0 }, sellableOutputKg: { type: ["number", "null"], minimum: 0 }, trimmingKg: { type: ["number", "null"], minimum: 0 }, qualityRejectKg: { type: ["number", "null"], minimum: 0 }, byproductKg: { type: ["number", "null"], minimum: 0 }, spoilageKg: { type: ["number", "null"], minimum: 0 }, otherLossKg: { type: ["number", "null"], minimum: 0 }, supplier: { type: ["string", "null"] }, shift: { type: ["string", "null"] }, fishSizeCategory: { type: ["string", "null"] }, storageState: { type: ["string", "null"] }, receivingCondition: { type: ["string", "null"] }, receivingTemperatureC: { type: ["number", "null"] }, deliveryDelayMinutes: { type: ["integer", "null"] }, productionDurationMinutes: { type: ["integer", "null"] }, operatorNotes: { type: ["string", "null"] } } }
    }
  },
  paths: {
    "/health": { get: { summary: "Check backend health", responses: { "200": { description: "Backend is running" } } } },
    "/v1/whatsapp/inbound": { post: { summary: "Receive a signed Vonage WhatsApp message", description: "Public provider callback. Vonage must send a valid signed webhook; this endpoint does not use a Supabase user token.", responses: { "204": { description: "Message accepted" }, "401": { description: "Webhook signature is missing or invalid" }, "503": { description: "Vonage Sandbox credentials are not configured" } } } },
    "/v1/whatsapp/status": { post: { summary: "Receive a signed Vonage WhatsApp delivery status", description: "Public provider callback. Vonage must send a valid signed webhook.", responses: { "204": { description: "Status accepted" }, "401": { description: "Webhook signature is missing or invalid" }, "503": { description: "Webhook signature secret is not configured" } } } },
    "/v1/auth/me": { get: secured("Get authenticated user") },
    "/v1/capability-tags": { get: secured("List preset capability tags") },
    "/v1/manufacturing-sites": { get: secured("List owned manufacturing sites"), post: { ...secured("Create manufacturing site"), requestBody: jsonBody({ $ref: "#/components/schemas/SiteInput" }), responses: { "201": { description: "Created" } } } },
    "/v1/manufacturing-sites/{siteId}": { patch: { ...secured("Update manufacturing site"), parameters: [pathId("siteId")], requestBody: jsonBody({ $ref: "#/components/schemas/SiteInput" }) } },
    "/v1/manufacturing-sites/{siteId}/production-lines": { get: { ...secured("List site production lines"), parameters: [pathId("siteId")] }, post: { ...secured("Create production line"), parameters: [pathId("siteId")], requestBody: jsonBody({ $ref: "#/components/schemas/LineInput" }), responses: { "201": { description: "Created" } } } },
    "/v1/production-lines/{productionLineId}": { patch: { ...secured("Update production line"), parameters: [pathId("productionLineId")], requestBody: jsonBody({ $ref: "#/components/schemas/LineInput" }) } },
    "/v1/production-lines/{productionLineId}/capability-tags": { get: { ...secured("List line capability tags"), parameters: [pathId("productionLineId")] }, post: { ...secured("Assign line capability tag"), parameters: [pathId("productionLineId")], requestBody: jsonBody({ $ref: "#/components/schemas/TagInput" }), responses: { "201": { description: "Created" } } } },
    "/v1/production-lines/{productionLineId}/capability-tags/{capabilityTagId}": { patch: { ...secured("Update Other tag context"), parameters: [pathId("productionLineId"), pathId("capabilityTagId")], requestBody: jsonBody({ type: "object", properties: { otherContext: { type: ["string", "null"] } } }) }, delete: { ...secured("Remove line capability tag"), parameters: [pathId("productionLineId"), pathId("capabilityTagId")], responses: { "204": { description: "Deleted" } } } },
    "/v1/production-batches": { get: secured("List owned production batches"), post: { ...secured("Create draft production batch"), requestBody: jsonBody({ $ref: "#/components/schemas/BatchInput" }), responses: { "201": { description: "Created" } } } },
    "/v1/production-batches/{batchId}": { get: { ...secured("Get production batch"), parameters: [pathId("batchId")] }, patch: { ...secured("Update draft production batch"), parameters: [pathId("batchId")], requestBody: jsonBody({ $ref: "#/components/schemas/BatchInput" }) } },
    "/v1/production-batches/{batchId}/validation": { get: { ...secured("Validate batch mass balance"), parameters: [pathId("batchId")] } },
    "/v1/production-batches/{batchId}/confirm": { post: { ...secured("Confirm a complete valid draft"), parameters: [pathId("batchId")] } },
    "/v1/production-batches/{batchId}/audit-events": { get: { ...secured("List batch audit events"), parameters: [pathId("batchId")] } },
    "/v1/production-batches/{batchId}/comparables": { get: { ...secured("List comparable confirmed batches"), parameters: [pathId("batchId")] } },
    "/v1/production-batches/{batchId}/analysis": { post: { ...secured("Run deterministic analysis and optional Gemini guidance"), description: "The batch must be confirmed and complete. At least three comparables are required for a baseline label.", parameters: [pathId("batchId")] } }
  }
} as const;

export const apiDocsRouter = Router();
apiDocsRouter.get("/openapi.json", (_request, response) => response.status(200).json(openapi));
apiDocsRouter.use("/docs", swaggerUi.serve, swaggerUi.setup(openapi, { explorer: true }));