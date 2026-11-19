#!/bin/bash
set -e
echo "[+] Running Alembic migrations..."
alembic upgrade head
echo "[+] Starting uvicorn..."
exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}" --workers "${WORKERS:-2}" --log-level "${LOG_LEVEL:-info}"
