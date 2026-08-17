# LAUT

LAUT is a web-first production intelligence platform for Indonesian seafood processors. It records batch-level yield and loss data, detects abnormal performance among comparable batches, and supports evidence-based investigation.

## Local development

Prerequisites: Docker Desktop with Docker Compose.

1. Copy the example environment files:

   ```powershell
   Copy-Item frontend/.env.example frontend/.env.local
   Copy-Item backend/.env.example backend/.env
   ```

2. Start the local stack:

   ```powershell
   docker compose up --build
   ```

3. Open the applications:

   - Web: http://localhost:3000
   - API health check: http://localhost:8000/health
   - API docs: http://localhost:8000/docs

See [docs/project.md](docs/project.md) for the active product direction and [docs/changes.md](docs/changes.md) for material decisions and implementation changes.
