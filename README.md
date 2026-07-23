# Trackr — AI Job Application Tracker (v1)

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

**Automation pipeline (implemented in v1):**

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
Track Application                  (SQLite)
        ↓
Show Follow-up Reminder            (rule-based, computed on load)
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
# edit .env and paste your free Groq API key (https://console.groq.com/keys)
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
4. Add environment variable `GROQ_API_KEY` in the Render dashboard.
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
| GET | `/api/applications` | List all tracked applications |
| POST | `/api/applications` | Save a new tracked application |
| PUT | `/api/applications/<id>` | Update dates / status / notes |
| DELETE | `/api/applications/<id>` | Remove an application |
| GET | `/api/reminders` | Applications whose follow-up date is due |

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
- **Email/SMS reminders** (currently in-app banner only) via a scheduled job (e.g. Render Cron)
- **Auth** so multiple students can use one deployment with separate accounts
- **PostgreSQL** instead of SQLite for persistent storage on Render

---

## 🛠 Tech stack summary

- **Backend**: Python, Flask, SQLite, Groq API, Gunicorn
- **Frontend (v1)**: HTML, CSS, vanilla JavaScript (zero build step)
- **Deployment**: Vercel (frontend), Render (backend)
