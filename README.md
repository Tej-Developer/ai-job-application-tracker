# Trackr — AI Job Application Tracker (v1.2)

> **v1.2 changelog:** automatic **email follow-up reminders** and a **weekly
> digest** email, the ability to **edit the job description / resume**
> snapshot after tracking an application, a **search & filter** toolbar, a
> per-application **notes timeline**, and **CSV/Excel export**. See
> [What's new in v1.2](#-whats-new-in-v12) below for details.


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

## 🏗 Architecture

```
┌─────────────────────┐        HTTPS/JSON       ┌──────────────────────┐
│   Frontend (static)  │  ───────────────────►   │   Backend (Flask)    │
│   HTML + CSS + JS    │  ◄───────────────────   │   REST API           │
│   Deployed: Vercel    │                         │   Deployed: Render    │
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
│   ├── app.py            # Flask app: DB + Groq calls + REST API (single file, low-code)
│   ├── requirements.txt
│   ├── render.yaml        # one-click Render deploy config
│   └── .env.example
├── frontend/
│   ├── index.html         # entire UI: HTML + CSS + vanilla JS (no build step)
│   └── vercel.json
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
# edit .env: paste your free Groq API key (https://console.groq.com/keys)
# and optionally your SMTP details to enable real reminder/digest emails
python app.py
```

Backend runs at `http://localhost:5000`. Check it with:
```bash
curl http://localhost:5000/api/health
```

### 2. Frontend

Just open `frontend/index.html` in a browser — no build tools needed.

If your backend isn't on `localhost:5000`, set the API URL before the page
loads by adding this in `index.html` (already wired to read it):
```html
<script>window.API_BASE_URL = "https://your-backend.onrender.com";</script>
```

---

## ☁️ Deployment

### Backend → Render

1. Push this repo to GitHub.
2. In Render: **New → Web Service**, connect the repo, set root directory to `backend`.
3. Render auto-detects `render.yaml`. Otherwise set manually:
   - Build command: `pip install -r requirements.txt`
   - Start command: `gunicorn app:app --bind 0.0.0.0:$PORT`
4. Add environment variable `GROQ_API_KEY` in the Render dashboard (and, optionally, `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASSWORD`/`SMTP_FROM` to enable real reminder/digest emails — see `.env.example`).
5. Deploy → copy the generated URL (e.g. `https://job-tracker-backend.onrender.com`).

> ⚠️ SQLite on Render's free tier is **ephemeral** (resets on redeploy/restart).
> That's fine for a v1 demo. For persistence, swap in Render's free
> PostgreSQL and change the `sqlite3` calls in `app.py` — the API surface
> stays identical.

### Frontend → Vercel

1. In Vercel: **New Project**, import the repo, set root directory to `frontend`.
2. Framework preset: **Other** (static site, no build step).
3. Before deploying, set the backend URL: either
   - edit the `API_BASE_URL` line in `index.html`, or
   - inject it via a small inline script tag as shown above.
4. Deploy → your tracker is live.

---

## 🔌 API reference (backend)

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | Health check |
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

## 🗺 Roadmap (v2+, per original project brief)

- **Frontend rewrite**: React + Tailwind CSS (component-based, same REST API)
- **React Flow** knowledge graph: visualize applications as nodes (company → skills → status)
- **Chart.js analytics**: response rate, average match score, applications per week
- **Auto-scrape job links** (where legally/technically possible) instead of manual paste
- **Reliable scheduling**: move off in-process `APScheduler` to a Render Cron Job for the reminder/digest jobs, so they run even on the free tier's sleep/wake cycle
- **Auth** so multiple students can use one deployment with separate accounts
- **PostgreSQL** instead of SQLite for persistent storage on Render
- **Excel (.xlsx) export** alongside CSV, if users need native Excel formatting/formulas
- **Resume version history** (keep last few uploads, not just the latest)

---

## 🛠 Tech stack summary

- **Backend**: Python, Flask, SQLite, Groq API, Gunicorn, pypdf (PDF text extraction), APScheduler (scheduled jobs), smtplib (email)
- **Frontend (v1)**: HTML, CSS, vanilla JavaScript (zero build step)
- **Deployment**: Vercel (frontend), Render (backend)
