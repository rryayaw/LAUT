from fastapi import FastAPI

app = FastAPI(title="LAUT API", version="0.1.0")


@app.get("/health", tags=["system"])
def health_check() -> dict[str, str]:
    """Return the service status for local development and orchestration."""
    return {"status": "ok", "service": "laut-api"}
