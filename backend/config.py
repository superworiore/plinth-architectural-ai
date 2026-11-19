"""Application settings via pydantic-settings."""

import os
from pathlib import Path
from pydantic_settings import BaseSettings

_BACKEND_DIR = Path(__file__).resolve().parent
_ENV_FILE = _BACKEND_DIR / ".env"


class Settings(BaseSettings):
    """Centralised configuration — reads from environment / .env file."""

    # ── Core ─────────────────────────────────────────────────────────────────
    DEBUG: bool = True

    # ── Database ─────────────────────────────────────────────────────────────
    DATABASE_URL: str = "sqlite:///./plinth.db"
    DATABASE_URL_DIRECT: str = ""  # Non-pooled URL for Alembic migrations

    # ── JWT ───────────────────────────────────────────────────────────────────
    JWT_SECRET: str = "dev-only-secret-change-before-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # ── CORS ──────────────────────────────────────────────────────────────────
    

    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8081,http://127.0.0.1:8081,http://localhost:8080,http://127.0.0.1:8080"

    # AI Providers
    GEMINI_API_KEY: str = ""
    OPENAI_API_KEY: str = ""


    # ── Supabase (optional — for future RLS / Realtime) ───────────────────────
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""

    # ── File Uploads ──────────────────────────────────────────────────────────
    MAX_UPLOAD_SIZE_MB: int = 50

    # ── Seed ──────────────────────────────────────────────────────────────────
    SEED_PASSWORD: str = "demo1234"

    class Config:
        env_file = str(_ENV_FILE) if _ENV_FILE.exists() else ".env"
        extra = "ignore"

    # ── Helpers ───────────────────────────────────────────────────────────────
    def get_allowed_origins(self) -> list[str]:
        """Parse comma-separated ALLOWED_ORIGINS into a list."""
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    def get_migration_url(self) -> str:
        """Return the direct (non-pooled) URL for Alembic, falling back to DATABASE_URL."""
        return self.DATABASE_URL_DIRECT or self.DATABASE_URL

    def validate_production(self) -> None:
        """Raise if dangerous defaults are used in production."""
        if not self.DEBUG and self.JWT_SECRET == "dev-only-secret-change-before-production":
            raise ValueError(
                "SECURITY: You must set a strong JWT_SECRET in production. "
                "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
            )


settings = Settings()
