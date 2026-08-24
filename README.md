# LAUT

LAUT is a production-intelligence platform for Indonesian seafood processors. It helps teams record batch yield and loss data, compare confirmed batches, and investigate abnormal performance.

## Start the frontend

The frontend reads and writes everything through the backend, so start the backend
first (see below) and have a Supabase user to sign in as.

```powershell
cd frontend
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Fill in `frontend/.env.local` before the first run:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | Where the backend is listening, e.g. `http://localhost:8000`. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. Must be the same project the backend uses. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key, used for sign-in only. |

Open http://localhost:3000 and sign in. Every page is gated on a Supabase session,
because each backend route requires that account's access token — the token also
scopes which manufacturing sites and batches are visible.

If the app says it cannot reach the LAUT API, the backend is not running or
`NEXT_PUBLIC_API_BASE_URL` points somewhere else. If it says Supabase is not
configured, the two `NEXT_PUBLIC_SUPABASE_*` values are missing from
`frontend/.env.local`.

## Start the backend

```powershell
cd backend
npm ci
Copy-Item .env.example .env
npm run prisma:generate
npm run dev
```

The health check is available at http://localhost:8000/health. Interactive endpoint documentation and testing are available at http://localhost:8000/docs.

For database-backed and authenticated API routes, fill in these values in `backend/.env`:

```env
DATABASE_URL=postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_<key>
```

To enable AI investigation guidance, also add:

```env
GOOGLE_API_KEY=<google-ai-studio-key>
GEMINI_MODEL=gemini-3.5-flash-lite
```

Never commit real environment files or use a Supabase service-role/secret key in the application.

## Test the WhatsApp bot

The current integration uses the Vonage WhatsApp Sandbox. Each tester needs
their own LAUT user, at least one manufacturing site with an active production
line, and a WhatsApp number that has joined the Sandbox. The manual identity
link below is a development-only shortcut; it must not be exposed as a
self-service production feature until phone ownership is verified.

1. Apply the repository's Supabase migrations to the test project. This
   includes the WhatsApp conversation tables and the production batch analyses
   table used after confirmation.
2. Start the backend and expose port 8000 through an HTTPS tunnel:

   ```powershell
   cd backend
   npm run dev
   ngrok http 8000
   ```

3. In the Vonage Sandbox application, configure the tunnel URL as the signed
   webhook endpoints:

   ```text
   https://<your-tunnel-host>/v1/whatsapp/inbound
   https://<your-tunnel-host>/v1/whatsapp/status
   ```

4. Add these Vonage values to backend/.env, using the Sandbox sender and
   signing secret from that application:

   ```env
   VONAGE_API_KEY=<vonage-api-key>
   VONAGE_API_SECRET=<vonage-api-secret>
   VONAGE_WHATSAPP_FROM=<sandbox-sender-number>
   VONAGE_MESSAGES_API_URL=https://messages-sandbox.nexmo.com/v1/messages
   VONAGE_SIGNATURE_SECRET=<webhook-signature-secret>
   ```

5. Sign in as the tester in Swagger at http://localhost:8000/docs using their
   Supabase access token, then call PUT /v1/whatsapp/identity with the
   tester's number in international format:

   ```json
   { "phoneNumber": "+628123456789" }
   ```

   That number can be linked to only one LAUT profile. The tester must also
   create their own site and active line through the authenticated API before
   starting a batch.

6. From that linked WhatsApp number, send tambah batch. Follow the prompts,
   or send one informal message with the batch details. The bot asks for only
   the remaining values, then shows a deterministic review. Send confirm to
   create the immutable batch, or batal at any time to stop.

   Example informal message:

   ```text
   tuna fillet beku, bahan baku 100 kg, hasil jual 70 kg, trimming 10 kg,
   reject kualitas 5 kg, produk samping 10 kg, spoilage 3 kg, kehilangan lain 2 kg
   ```

After confirmation, LAUT saves a deterministic analysis. A baseline label
requires at least three comparable confirmed batches; Gemini guidance is
optional and requires GOOGLE_API_KEY. If the Phase 6 migration has not yet
been applied, the batch still confirms but its WhatsApp analysis will be shown
as unavailable.

## Import the synthetic red snapper dataset

The supplied workbook is available as a reproducible test fixture. Its 360
mass-balanced records import into a separate **Synthetic Red Snapper Test Site**
owned by the specified test user. Imported batches are confirmed, marked with
`source_channel = import`, and use `SYNTHETIC-RED-SNAPPER:` batch references.
The command is idempotent: re-running it skips batch references already
present in that test site.

First apply the `add_import_source_channel` migration in
`supabase/migrations/`, then run:

```powershell
cd backend
npm run import:synthetic-red-snapper -- --email test@test.com
```

Use only a dedicated test account. The importer retains production and
mass-balance values, but deliberately does not import the workbook's injected
anomaly labels or notes as operational facts.

## Tests

Run the deterministic suite from the backend directory:

```powershell
npm test
```

It does not call Gemini, Vonage, or the hosted database. To verify saved
analysis persistence against a running local backend and the configured
test-user token, use:

```powershell
npm run dev
# In another terminal:
npm run test:hosted
```

The hosted test uses an existing confirmed batch owned by
TEST_SUPABASE_ACCESS_TOKEN. It may create that batch's first saved analysis
and, on its first run, creates the reusable PHASE7-INTEGRATION batch. Use the
dedicated LAUT test user, never a customer account.

## Notes

- Supabase migrations in `supabase/migrations/` must be applied to the hosted project before using data routes.
- `docker-compose.yml` is not the current supported development path; use the separate frontend/backend commands above.
- Product decisions and detailed implementation status live in local `docs/project.md`.
