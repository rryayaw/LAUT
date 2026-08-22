# LAUT

LAUT is a production-intelligence platform for Indonesian seafood processors. It helps teams record batch yield and loss data, compare confirmed batches, and investigate abnormal performance.

## Start the frontend

```powershell
cd frontend
npm ci
npm run dev
```

Open http://localhost:3000.

The current frontend runs from local demo data. Refreshing the page resets changes.

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

## Notes

- Supabase migrations in `supabase/migrations/` must be applied to the hosted project before using data routes.
- `docker-compose.yml` is not the current supported development path; use the separate frontend/backend commands above.
- Product decisions and detailed implementation status live in local `docs/project.md`.
