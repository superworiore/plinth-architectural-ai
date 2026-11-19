"""PLINTH API — main FastAPI application entry point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from config import settings
from database import Base, check_db_connection, engine

# ---------------------------------------------------------------------------
# Import all routers
# ---------------------------------------------------------------------------
from routers import (
    ai,
    approvals,
    auth,
    activity,
    compliance,
    costs,
    documents,
    exports,
    files,
    floors,
    projects,
    site_logs,
    vendors,
    websocket,
    floorplan_detection,
)

# ---------------------------------------------------------------------------
# Rate limiter (shared across routers)
# ---------------------------------------------------------------------------
limiter = Limiter(key_func=get_remote_address)


# ---------------------------------------------------------------------------
# Lifespan (replaces deprecated @app.on_event)
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run startup / shutdown logic."""
    settings.validate_production()

    # In dev (SQLite), auto-create tables for convenience.
    # In production, run: alembic upgrade head
    if settings.DATABASE_URL.startswith("sqlite"):
        Base.metadata.create_all(bind=engine)
        print("[+] SQLite tables ensured (dev mode)")
    else:
        print("[+] Production DB -- run 'alembic upgrade head' to apply migrations")

    print(f"[+] PLINTH API starting -- DEBUG={settings.DEBUG}")
    yield
    print("[+] PLINTH API shutting down")


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------
app = FastAPI(
    title="PLINTH API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS — restricted to allowed origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Timing middleware
from middleware.timing import ProcessTimeMiddleware
app.add_middleware(ProcessTimeMiddleware)


# ---------------------------------------------------------------------------
# Global exception handlers
# ---------------------------------------------------------------------------
from sqlalchemy.exc import OperationalError

@app.exception_handler(OperationalError)
async def db_operational_exception_handler(request: Request, exc: OperationalError):
    return JSONResponse(
        status_code=503,
        content={
            "detail": "Database connection temporarily unavailable. Please check your Supabase connection.",
        },
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    if settings.DEBUG:
        raise exc
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


# ---------------------------------------------------------------------------
# Register routers
# ---------------------------------------------------------------------------
app.include_router(auth.router,       prefix="/api/auth",       tags=["Auth"])
app.include_router(projects.router,   prefix="/api/projects",   tags=["Projects"])
app.include_router(floors.router,     prefix="/api",            tags=["Floors"])
app.include_router(costs.router,      prefix="/api",            tags=["Costs"])
app.include_router(documents.router,  prefix="/api",            tags=["Documents"])
app.include_router(compliance.router, prefix="/api",            tags=["Compliance"])
app.include_router(activity.router,   prefix="/api",            tags=["Activity"])
app.include_router(ai.router,         prefix="/api/ai",         tags=["AI"])
app.include_router(
    floorplan_detection.router,
    prefix="/api/ai/floorplan",
    tags=["Floor Plan Detection"],
)

app.include_router(exports.router,    prefix="/api",            tags=["Exports"])
app.include_router(files.router,      prefix="/api",            tags=["Files"])
app.include_router(approvals.router,  prefix="/api",            tags=["Approvals"])
app.include_router(vendors.router,    prefix="/api",            tags=["Vendors"])
app.include_router(site_logs.router,  prefix="/api",            tags=["Site Logs"])
app.include_router(websocket.router,  prefix="/ws",             tags=["WebSocket"])


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/api/health", tags=["Health"])
def health_check():
    db_ok = check_db_connection()
    return {
        "status": "healthy" if db_ok else "degraded",
        "database": "connected" if db_ok else "disconnected",
        "version": "1.0.0",
    }
