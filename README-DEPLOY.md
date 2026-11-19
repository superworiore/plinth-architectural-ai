# PLINTH — Deployment Guide

This guide covers deploying PLINTH (FastAPI backend + React frontend) with **Supabase PostgreSQL** as the database.

---

## 🗄️ Step 1: Set Up Supabase Database

1. Go to [supabase.com](https://supabase.com) → **New project**
2. Note your **Project Reference** (`[PROJECT_REF]`) and **Database Password**
3. Go to **Settings → Database** and copy:
   - **Session mode (port 6543)** → your `DATABASE_URL` (pooled, for the app)
   - **Direct connection (port 5432)** → your `DATABASE_URL_DIRECT` (for migrations)

---

## ⚙️ Step 2: Configure Backend Environment

```bash
cd backend
cp .env.example .env
```

Edit `.env` and fill in:

```env
DEBUG=false
DATABASE_URL=postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DATABASE_URL_DIRECT=postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
JWT_SECRET=<generate with: python -c "import secrets; print(secrets.token_hex(32))">
ALLOWED_ORIGINS=https://your-frontend.vercel.app
```

---

## 🗃️ Step 3: Run Database Migrations

From the `backend/` directory with your venv activated:

```bash
# Activate virtual environment
.\venv\Scripts\activate          # Windows
# source venv/bin/activate       # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Run migrations against Supabase (uses DATABASE_URL_DIRECT)
alembic upgrade head

# Verify migrations applied
alembic current

# Seed demo data
python seed.py
```

After seeding, you can verify in the **Supabase Table Editor** that all 15 tables exist and the `users` table has 6 demo accounts.

---

## 🚀 Step 4: Deploy Backend

### Option A — Railway (Recommended, easiest)

1. Go to [railway.app](https://railway.app) → **New Project → Deploy from GitHub Repo**
2. Select your repo, set **Root Directory** to `backend/`
3. Set environment variables (same as `.env`) in Railway dashboard
4. Railway auto-detects `Dockerfile` and builds your image
5. Your backend URL will be: `https://plinth-backend-production.up.railway.app`

### Option B — Render

1. Go to [render.com](https://render.com) → **New Web Service**
2. Connect repo, set **Root Directory** to `backend/`
3. **Build Command**: `pip install -r requirements.txt`
4. **Start Command**: `bash start.sh`
5. Add environment variables

### Option C — Docker (VPS / Cloud VM)

```bash
# From repo root
docker compose up -d
# Or build the backend image manually:
cd backend
docker build -t plinth-backend .
docker run -p 8000:8000 --env-file .env plinth-backend
```

---

## 🌐 Step 5: Deploy Frontend

### Vercel (Recommended)

1. Go to [vercel.com](https://vercel.com) → **Import Project**
2. Set **Root Directory** to `.` (repo root)
3. Add environment variable:
   ```
   VITE_API_URL=https://your-backend.railway.app
   ```
4. **Build Command**: `npm run build`
5. **Output Directory**: `dist`

### Netlify

Same steps — add `VITE_API_URL` in **Site settings → Environment variables**.

---

## ✅ Verification Checklist

- [ ] `GET https://your-backend.railway.app/api/health` returns `{"status": "healthy", "database": "connected"}`
- [ ] Login at `https://your-frontend.vercel.app/login` with `architect@plinth.ai / demo1234`
- [ ] Create a new project — verify it appears in Supabase Table Editor → `projects`
- [ ] Run compliance check — verify `compliance_checks` table populated
- [ ] Export PDF — verify HTML report downloads
- [ ] Export BOQ CSV — verify CSV downloads

---

## 🔑 Demo Accounts

All passwords: `demo1234` (or `SEED_PASSWORD` env var)

| Role | Email |
|---|---|
| Super Admin | admin@plinth.ai |
| Architect | architect@plinth.ai |
| Interior Designer | interior@plinth.ai |
| Structural Engineer | structural@plinth.ai |
| Client | client@plinth.ai |
| Vendor | vendor@plinth.ai |

---

## 📊 Supabase Dashboard Useful Links

After deploying, use these Supabase features:
- **Table Editor** — Browse/edit rows directly
- **SQL Editor** — Run custom queries
- **Logs** — Monitor DB queries
- **Auth** (optional) — If you later want to migrate to Supabase Auth
- **Storage** (optional) — Replace local `uploads/` folder with Supabase Storage
