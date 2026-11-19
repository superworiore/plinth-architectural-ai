# ============================================================================
# PLINTH — Clean development startup script
# Run from the project root: .\scripts\start-dev.ps1
#
# What this does:
#   1. Kills any stale Node.js or Python processes that hold ports 8080/8081/8000
#   2. Waits for TCP connections to drain (avoids FIN_WAIT_1 / port-in-use errors)
#   3. Starts the FastAPI backend (port 8000) in a background job
#   4. Starts the Vite frontend (port 8081, since 8080 is taken by Oracle TNS)
#
# The SSR "transport invoke timed out" error is fixed in vite.config.ts by:
#   - Adding ssr.external for heavy browser-only packages (gsap, lenis, etc.)
#   - Adding optimizeDeps.include to pre-bundle common packages as single files
# ============================================================================

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host ""
Write-Host "PLINTH — Clean startup" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# ── 1. Kill stale processes ──────────────────────────────────────────────────
Write-Host "[1/3] Killing stale node.exe / python.exe processes..." -ForegroundColor Yellow
$killed = @()
Get-Process node, python -ErrorAction SilentlyContinue | ForEach-Object {
    $killed += $_.Id
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}
if ($killed.Count -gt 0) {
    Write-Host "      Killed PIDs: $($killed -join ', ')" -ForegroundColor Gray
} else {
    Write-Host "      No stale processes found." -ForegroundColor Gray
}

# ── 2. Wait for ports to clear ───────────────────────────────────────────────
Write-Host "[2/3] Waiting for ports 8000/8081 to clear..." -ForegroundColor Yellow
$maxWait = 10
$waited  = 0
do {
    Start-Sleep -Seconds 1
    $waited++
    $busy = netstat -ano 2>$null |
        Select-String ":8000 |:8081 " |
        Where-Object { $_ -match "ESTABLISHED|LISTEN|TIME_WAIT|FIN_WAIT" }
} while ($busy -and $waited -lt $maxWait)

if ($busy) {
    Write-Host "      WARNING: Ports may still be in use after ${waited}s. Proceeding anyway." -ForegroundColor Red
} else {
    Write-Host "      Ports clear after ${waited}s." -ForegroundColor Gray
}

# ── 3. Start backend ─────────────────────────────────────────────────────────
Write-Host "[3/3] Starting FastAPI backend on http://127.0.0.1:8000 ..." -ForegroundColor Yellow
$backendJob = Start-Job -ScriptBlock {
    Set-Location "$using:ProjectRoot\backend"
    & .\venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload 2>&1
}
Write-Host "      Backend job started (Job ID: $($backendJob.Id))" -ForegroundColor Gray

# Give backend a moment to bind
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Starting Vite dev server..." -ForegroundColor Cyan
Write-Host "  Frontend : http://localhost:8081/" -ForegroundColor Green
Write-Host "  Backend  : http://127.0.0.1:8000/" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C to stop both servers." -ForegroundColor Gray
Write-Host ""

# ── 4. Start frontend (foreground so Ctrl+C stops everything) ────────────────
try {
    Set-Location $ProjectRoot
    npx vite dev --clearScreen false
} finally {
    Write-Host ""
    Write-Host "Stopping backend job..." -ForegroundColor Yellow
    Stop-Job -Job $backendJob -ErrorAction SilentlyContinue
    Remove-Job -Job $backendJob -Force -ErrorAction SilentlyContinue
    Write-Host "Done." -ForegroundColor Cyan
}
