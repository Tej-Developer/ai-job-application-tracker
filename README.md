# Trackr — AI Job Application Tracker (v2.0)

> **v2.0 changelog:** the frontend is now a **React app** (Vite + Tailwind +
> React Router), replacing the static HTML/JS pages from v1.4. This version
> also fixes two UX bugs (no way back from the login screen, a hover
> contrast bug on the nav "Get started" button), adds a **password
> visibility toggle**, and introduces **user profiles** — a username, editable
> anytime, plus in-app password changes. The "low-code, no build step" rule
> from v1.x is dropped here by request; see
> [What's new in v2.0](#-whats-new-in-v20) below for the full breakdown.


Students applying to 100+ companies lose track of what was applied to, when
interviews are scheduled, when to follow up, and what got rejected. **Trackr**
fixes that: paste a job description, get an instant AI-powered resume match
score and improvement tips, then track the application through its lifecycle
with automatic follow-up reminders.

This is **version 1** — built low-code and functional first. It is fully
working end-to-end, deployable in minutes, and structured so the "future"
features (React, knowledge graph, analytics) can be layered on later without
touching the backend.

---

## ✨ What v1 does

| Step | Feature |
|---|---|
| 1 | Paste a job link + job description + your resume text |
| 2 | AI (Groq) extracts **company**, **role**, **required skills** |
| 3 | AI compares your resume against the job and returns a **match score (0–100)** |
| 4 | AI suggests **specific resume improvements** |
| 5 | Save the job as a tracked **application** |
| 6 | Update **applied / interview / follow-up dates** and **status** (Applied → Interview → Offer/Rejected) anytime |
| 7 | A **reminder banner** automatically surfaces applications whose follow-up date has arrived |

> Note: v1 does not scrape job sites automatically (many block scraping /
> require login). You paste the job description text — this keeps it
> reliable and free. Auto-scraping from a URL can be added in v2.

---

## 🆕 What's new in v1.1

| Feature | How it works |
|---|---|
| **Upload resume as PDF** | Click "Upload PDF resume" → the file is sent to the backend → text is extracted with `pypdf` → the resume textarea auto-fills. No manual copy-paste needed. |
| **Resume is saved automatically** | Every upload overwrites a single saved resume row in SQLite. On your **next visit**, the app calls `GET /api/resume` on load and pre-fills the textarea for you — no re-upload required. |
| **Required fields** | Job description and resume can no longer be empty. The frontend highlights missing fields in red and blocks the "Analyze" click; the backend also rejects the request with a 400 if either is blank (defense in depth). |

New/changed API routes:

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/resume` | Returns the last saved resume (`filename`, `resume_text`, `updated_at`) |
| POST | `/api/resume/upload` | Multipart form upload (`file`) → extracts PDF text via `pypdf`, saves it, returns the text |
| POST | `/api/analyze` | Now returns **400** if `job_description` or `resume_text` is missing |

> Note: only text-based PDFs are supported (i.e. not a scanned image of a
> resume with no selectable text). If a scanned PDF is uploaded, the API
> returns a clear error asking for a text-based PDF instead — OCR can be
> added in a later version if needed.

---

## 🆕 What's new in v1.2

| Feature | How it works |
|---|---|
| **Auto-send follow-up emails** | A background scheduler (`APScheduler`, in-process) checks every day at 08:00 for applications whose follow-up date has arrived and emails you automatically via SMTP. Each application is only reminded once per day (`last_reminded_date` guard). |
| **Weekly digest email** | Every Monday at 08:00, a summary email goes out: total applications, breakdown by status, average resume match score, and interviews coming up in the next 7 days. |
| **Notification settings** | A new "Email reminders & weekly digest" panel lets you set your email and toggle reminders/digest independently — saved to the backend, no re-entry needed. |
| **Edit job description / resume after tracking** | Click **Details** on any tracked application to expand an inline panel with editable job description and resume-snapshot fields. Save updates them in place. |
| **Search & filter** | A search box (company/role) and a status dropdown filter the applications table live, backed by `?search=` and `?status=` query params on the list endpoint. |
| **Notes timeline** | Each application now has a running activity log instead of one overwritable notes field — add free-text notes anytime, and status changes are logged automatically (e.g. "Status changed to Interview."). |
| **Export to CSV/Excel** | An "Export CSV" button downloads all tracked applications as a `.csv` file — opens directly in Excel, Google Sheets, or Numbers. |

New/changed API routes:

| Method | Route | Purpose |
|---|---|---|
| GET / POST | `/api/settings` | Get/save notification email + reminders/digest toggles |
| GET | `/api/applications?search=&status=` | List applications, optionally filtered |
| PUT | `/api/applications/<id>` | Now also accepts `job_description`, `resume_text`, and re-analysis fields (`match_score`, `skills`, `suggestions`); auto-logs a timeline entry on status change |
| GET | `/api/applications/<id>/timeline` | List the notes/activity timeline for one application |
| POST | `/api/applications/<id>/timeline` | Add a free-text note to the timeline |
| GET | `/api/export/csv` | Download all applications as CSV |

**Email setup (optional):** if you don't configure SMTP, reminder/digest
emails are simply logged to the console instead of sent — nothing breaks.
To enable real emails, fill in the SMTP variables in `.env` (see
`.env.example`). For Gmail, use an **App Password**, not your regular
password (Google account → Security → App Passwords).

> ⚠️ **Scheduler note:** the daily/weekly jobs run inside the Flask process
> via `APScheduler`. On Render's **free** tier, web services spin down after
> a period of no traffic and spin back up on the next request — so a
> scheduled job won't fire while the service is asleep. For reliable
> scheduling in production, either upgrade to a Render plan that stays
> always-on, or replace the in-process scheduler with a Render **Cron Job**
> that calls a small `/api/run-reminders` trigger endpoint on a schedule.

---

## 🆕 What's new in v1.3

| Feature | How it works |
|---|---|
| **Accounts (email + password)** | New `/api/auth/register` and `/api/auth/login` routes create/verify accounts. Passwords are hashed with Werkzeug's `generate_password_hash` (never stored in plain text). |
| **Login tokens (JWT)** | On login/register you get a signed JSON Web Token (`PyJWT`), valid for 7 days. The frontend stores it in `localStorage` and sends it as `Authorization: Bearer <token>` on every request. |
| **Private data per user** | Every table (`applications`, `resume`, `settings`, `timeline`) is now scoped by `user_id`. A `login_required` decorator on every data route rejects requests without a valid token, and ownership is checked before any read/edit/delete — one user can never see or modify another user's data. |
| **Login/register screen** | The frontend now shows a login/register form until you're authenticated, then reveals the app with your email + a "Log out" button in the header. |

**Before this version**, the tracker had one shared SQLite database — every
visitor saw the same resume, applications, and settings. **Now**, each
account only ever sees its own data, verified end-to-end (tested that user
B gets a 404, not user A's data, when trying to read/edit/delete something
they don't own).

New/changed API routes:

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/auth/register` | `{email, password}` → creates an account, returns a token |
| POST | `/api/auth/login` | `{email, password}` → verifies credentials, returns a token |
| GET | `/api/auth/me` | Returns the logged-in user's profile (used to restore a session on page load) |
| *(all previous routes)* | — | Now require `Authorization: Bearer <token>` and are scoped to the logged-in user |

**Environment setup:** add a `SECRET_KEY` to `.env` (used to sign tokens).
Generate one with:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```
If `SECRET_KEY` isn't set, the app falls back to an insecure dev default and
prints a warning — fine for local testing, but **must** be set to a real
random value before deploying, or anyone could forge a valid login token.

> ⚠️ **Upgrading from v1.2:** the old `resume` and `settings` tables used a
> single shared row and are schema-incompatible with per-user data. On
> first run, v1.3 automatically detects and drops those old tables (any
> previously shared resume/settings will need to be re-entered per
> account). Tracked applications are preserved but won't show up for anyone
> until assigned a `user_id` — since Render's free-tier SQLite is ephemeral
> anyway, the simplest path is to just start fresh (delete `tracker.db`
> locally, or let Render's redeploy reset it).

---

## 🆕 What's new in v1.4

The frontend is now **two static pages** instead of one, with a shared
visual identity:

| File | Purpose |
|---|---|
| `frontend/index.html` | **Landing page.** Public marketing page — explains what Trackr does, how it works, and links to the app. No login required, no API calls. |
| `frontend/app.html` | **The app.** Login/register screen, then a dashboard with stat cards, tabbed navigation (Applications / New application / Settings), and all existing functionality from v1.1–v1.3 (analyze, track, edit, search, filter, timeline, export, notification settings). |

**Design direction:** the whole product is about tracking many things
moving through stages at once (Applied → Interview → Offer/Rejected) — the
same mental model as an airport departure board. That's the visual
throughline:

- A **departure-board hero** on the landing page: sample tracked
  applications "flip" into place like split-flap board rows (respects
  `prefers-reduced-motion`).
- **Status pills** in the dashboard table use the same board-inspired
  palette (slate = Applied, amber = Interview, green = Offer, rust = Rejected).
- **Typography**: Space Grotesk for headlines, Inter for body text, and IBM
  Plex Mono for data/scores/status — the monospace face ties back to the
  board motif.
- **Dashboard stat cards** (Tracked / Interviews / Avg match / Follow-ups
  due) are computed client-side from the same `/api/applications` and
  `/api/reminders` responses the table already uses — no new API calls.

No backend changes in this version — `backend/app.py` and the API contract
are untouched. `vercel.json` now also rewrites `/app` → `/app.html` for a
cleaner URL if you want to link people straight to the dashboard.

---

## 🆕 What's new in v2.0

**The frontend is now a real React app** (`frontend/`), built with Vite,
styled with Tailwind CSS, and routed with React Router — replacing the two
static HTML pages from v1.4. Structure:

```
frontend/src/
├── main.jsx                    # entry point (Router + Auth/Toast providers)
├── App.jsx                     # route definitions
├── lib/api.js                   # fetch wrapper: attaches auth token, handles 401s
├── context/
│   ├── AuthContext.jsx           # login/register/logout, session bootstrap
│   └── ToastContext.jsx          # toast notifications (replaces alert())
├── components/
│   ├── ProtectedRoute.jsx        # redirects to /login if not authenticated
│   └── StatusPill.jsx            # Applied/Interview/Offer/Rejected badge
└── pages/
    ├── Landing.jsx                # marketing page ("/")
    ├── Auth.jsx                   # login/register ("/login", "/register")
    ├── DashboardLayout.jsx        # nav + tabs + user menu, wraps the routes below
    └── dashboard/
        ├── Applications.jsx        # stat cards, search/filter, table, detail drawer
        ├── NewApplication.jsx      # paste job/resume, PDF upload, analyze, track
        ├── Settings.jsx            # notification preferences
        └── Profile.jsx             # NEW: username + password management
```

**Bugs fixed from the previous version:**

| Bug | Fix |
|---|---|
| No way back from the login screen | `Auth.jsx` now has a persistent "← Back to Trackr" link to the landing page. |
| "Get started" in the nav was unreadable on hover | Root cause: a generic `.nav-links a:hover` color rule was overriding the button's own text color, so on hover the text became the same dark navy as the button background. Rebuilt with Tailwind, every button now sets its own explicit background *and* text color for every state — no more inherited/overridden colors. |

**New features:**

| Feature | How it works |
|---|---|
| **User profiles** | A new **Profile** tab (in the user menu) lets you view your email, and edit your **username** and **password**. Backend: `users` table now has a `username` column (auto-generated from your email prefix at signup if you don't set one), and a new `PUT /api/auth/profile` endpoint handles updates. Changing your password requires your current password. |
| **Password visibility toggle** | Every password field (login, register, change-password) has an eye icon to reveal/hide what you typed. |
| **Toast notifications** | Save/error feedback now shows as a toast in the corner instead of `alert()` or small inline text. |
| **Slide-over detail drawer** | Clicking "Details" on an application now opens a proper slide-over panel (job description, resume snapshot, notes timeline) instead of an inline expanding table row. |

**Design refresh:** kept the departure-board visual identity from v1.4
(Space Grotesk / Inter / IBM Plex Mono, the slate/amber/green/rust status
palette, the flip-animated hero board) but rebuilt everything as proper
React components with Tailwind utility classes, consistent spacing, and
real hover/focus states throughout.

New/changed API routes:

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Now also accepts an optional `username` (validated, must be unique; auto-generated from the email prefix if omitted) |
| POST | `/api/auth/login` | Now also returns `username` |
| GET | `/api/auth/me` | Now also returns `username` |
| PUT | `/api/auth/profile` | **New.** `{username}` and/or `{current_password, new_password}` → updates the logged-in user's profile |

> ⚠️ **Upgrading from v1.3:** the `users` table gets a new `username` column
> via an automatic migration (`ALTER TABLE ... ADD COLUMN`) — existing
> accounts keep working, they just won't have a username set until they
> visit the Profile tab (or the frontend can be updated to prompt for one).

---

## 🏗 Architecture

```
┌─────────────────────┐        HTTPS/JSON       ┌──────────────────────┐
│  Frontend (React)     │  ───────────────────►   │   Backend (Flask)    │
│  Vite + Tailwind +    │  ◄───────────────────   │   REST API           │
│  React Router          │                         │                       │
│  Deployed: Vercel      │                         │   Deployed: Render    │
└─────────────────────┘                          └──────────┬───────────┘
                                                              │
                                       ┌──────────────────────┼───────────────────┐
                                       ▼                                          ▼
                              ┌────────────────┐                        ┌──────────────────┐
                              │  SQLite (file)  │                        │   Groq LLM API    │
                              │  applications DB │                        │  (free tier)      │
                              └────────────────┘                        └──────────────────┘
```

**Automation pipeline (implemented through v1.2):**

```
Paste Job Description + Resume
        ↓
Extract Company / Role / Skills   (Groq)
        ↓
Compare Resume vs Job             (Groq)
        ↓
Calculate Match Score              (Groq)
        ↓
Suggest Improvements               (Groq)
        ↓
Track Application                  (SQLite + auto timeline entry)
        ↓
Show Follow-up Reminder            (in-app banner, computed on load)
        ↓
Auto-email Follow-up Reminder       (daily scheduled job, SMTP)
        ↓
Auto-email Weekly Digest             (Monday scheduled job, SMTP)
```

---

## 📁 Project structure

```
job-tracker/
├── backend/
│   ├── app.py            # Flask app: DB + Groq calls + REST API
│   ├── requirements.txt
│   ├── render.yaml        # one-click Render deploy config
│   └── .env.example
├── frontend/
│   ├── src/                # React app (see the v2.0 section above for the full tree)
│   ├── index.html          # Vite entry HTML
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── vercel.json          # SPA rewrite config
│   └── .env.example
└── README.md
```

---

## 🚀 Run it locally

### 1. Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate   # optional but recommended
pip install -r requirements.txt
cp .env.example .env
# edit .env: set SECRET_KEY (see the v1.3 section above for how to generate one),
# paste your free Groq API key (https://console.groq.com/keys),
# and optionally your SMTP details to enable real reminder/digest emails
python app.py
```

Backend runs at `http://localhost:5000`. Check it with:
```bash
curl http://localhost:5000/api/health
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env
# edit .env if your backend isn't on localhost:5000
npm run dev
```

Opens at `http://localhost:5173`. The landing page is at `/`, login/register
at `/login` and `/register`, and the dashboard at `/app` (redirects to
`/login` if you're not authenticated).

To build for production: `npm run build` (outputs to `frontend/dist`).

---

## ☁️ Deployment

### Backend → Render

1. Push this repo to GitHub.
2. In Render: **New → Web Service**, connect the repo, set root directory to `backend`.
3. Render auto-detects `render.yaml`. Otherwise set manually:
   - Build command: `pip install -r requirements.txt`
   - Start command: `gunicorn app:app --bind 0.0.0.0:$PORT`
4. Add environment variables in the Render dashboard: `GROQ_API_KEY`, and **`SECRET_KEY`** (required — generate with `python -c "import secrets; print(secrets.token_hex(32))"`). Optionally add `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASSWORD`/`SMTP_FROM` to enable real reminder/digest emails — see `.env.example`.
5. Deploy → copy the generated URL (e.g. `https://job-tracker-backend.onrender.com`).

> ⚠️ SQLite on Render's free tier is **ephemeral** (resets on redeploy/restart).
> That's fine for a v1 demo. For persistence, swap in Render's free
> PostgreSQL and change the `sqlite3` calls in `app.py` — the API surface
> stays identical.

### Frontend → Vercel

1. In Vercel: **New Project**, import the repo, set root directory to `frontend`.
2. Framework preset: **Vite** (auto-detected). Build command `npm run build`, output directory `dist` (already set in `vercel.json`).
3. Add an environment variable: `VITE_API_BASE_URL` = your Render backend URL (e.g. `https://job-tracker-backend.onrender.com`).
4. Deploy → the landing page is at the root URL, login/register at `/login` and `/register`, and the dashboard at `/app`. `vercel.json` handles the SPA routing so refreshing any of these URLs works correctly.

---

## 🔌 API reference (backend)

All routes below (except `/api/health` and `/api/auth/*`) require an
`Authorization: Bearer <token>` header and only return/modify data owned
by the logged-in user.

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | Health check (public) |
| POST | `/api/auth/register` | `{email, password}` → create account, returns a token |
| POST | `/api/auth/login` | `{email, password}` → verify login, returns a token |
| GET | `/api/auth/me` | Current user's profile (used to restore a session) |
| PUT | `/api/auth/profile` | `{username}` and/or `{current_password, new_password}` → update profile |
| POST | `/api/analyze` | `{job_description, resume_text, job_link}` → AI extraction + match score |
| GET | `/api/resume` | Get the saved resume (prefill on load) |
| POST | `/api/resume/upload` | Upload a PDF resume → extracts & saves text |
| GET / POST | `/api/settings` | Get/save notification email + reminders/digest toggles |
| GET | `/api/applications?search=&status=` | List tracked applications, optionally filtered |
| POST | `/api/applications` | Save a new tracked application |
| PUT | `/api/applications/<id>` | Update dates / status / notes / job description / resume snapshot / AI results |
| DELETE | `/api/applications/<id>` | Remove an application (and its timeline) |
| GET | `/api/applications/<id>/timeline` | List notes/activity log for one application |
| POST | `/api/applications/<id>/timeline` | Add a note to the timeline |
| GET | `/api/reminders` | Applications whose follow-up date is due (in-app banner) |
| GET | `/api/export/csv` | Download all applications as CSV |

---

## 🧠 Why Groq

Groq's API is OpenAI-compatible and has a generous free tier, making it the
right choice for a student project: fast inference, no cost, and a drop-in
`chat/completions` call (`backend/app.py → call_groq()`). Swapping to another
provider later only requires editing that one function.

---

## 🗺 Roadmap (v3+)

- **React Flow** knowledge graph: visualize applications as nodes (company → skills → status)
- **Chart.js analytics**: response rate, average match score, applications per week — the dashboard stat cards are a lightweight first step toward this
- **Auto-scrape job links** (where legally/technically possible) instead of manual paste
- **Reliable scheduling**: move off in-process `APScheduler` to a Render Cron Job for the reminder/digest jobs, so they run even on the free tier's sleep/wake cycle
- **Password reset / email verification** — currently there's no "forgot password" flow
- **PostgreSQL** instead of SQLite for persistent, non-ephemeral storage on Render
- **Excel (.xlsx) export** alongside CSV, if users need native Excel formatting/formulas
- **Resume version history** (keep last few uploads, not just the latest)
- **Avatar upload** for profiles (currently just an initial-letter badge)

---

## 🛠 Tech stack summary

- **Backend**: Python, Flask, SQLite, Groq API, Gunicorn, pypdf (PDF text extraction), APScheduler (scheduled jobs), smtplib (email), PyJWT + Werkzeug security (authentication)
- **Frontend**: React 18, Vite, React Router, Tailwind CSS, lucide-react (icons), Space Grotesk / Inter / IBM Plex Mono via Google Fonts
- **Deployment**: Vercel (frontend), Render (backend)
