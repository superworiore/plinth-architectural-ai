"""SQLAlchemy database engine, session factory, and base model."""

from urllib.parse import urlparse, urlunparse, urlencode, parse_qs
from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from config import settings


def _clean_pgbouncer_url(url: str) -> str:
    """Remove ?pgbouncer=true from URL — psycopg2 doesn't understand it."""
    if "pgbouncer" not in url:
        return url
    parsed = urlparse(url)
    params = parse_qs(parsed.query)
    params.pop("pgbouncer", None)
    new_query = urlencode({k: v[0] for k, v in params.items()})
    return urlunparse(parsed._replace(query=new_query))


def _build_engine_kwargs() -> dict:
    """Build engine kwargs based on the database type."""
    url = settings.DATABASE_URL

    if url.startswith("sqlite"):
        # SQLite — local dev only
        return {"connect_args": {"check_same_thread": False}}

    # PostgreSQL (Supabase) — connection pool tuned for web workloads
    kwargs: dict = {
        "pool_size": 10,          # maintained open connections
        "max_overflow": 20,       # burst connections above pool_size
        "pool_pre_ping": True,    # test connection health before use
        "pool_recycle": 1800,     # recycle connections every 30 min
    }

    # PgBouncer (Supabase pooled endpoint) does not support prepared statements
    if "pgbouncer=true" in url:
        kwargs["connect_args"] = {"prepare_threshold": None}

    return kwargs


# Strip ?pgbouncer=true from URL so psycopg2 doesn't reject it
_db_url = _clean_pgbouncer_url(settings.DATABASE_URL)
engine = create_engine(_db_url, echo=settings.DEBUG, **_build_engine_kwargs())

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency — yields a DB session, closes on completion."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_db_connection() -> bool:
    """Test database connectivity (used by /api/health)."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
