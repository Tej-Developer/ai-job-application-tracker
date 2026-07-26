"""
AI Job Application Tracker - Backend (v1.3)
------------------------------------------
A single-file Flask app (kept intentionally low-code) that:
  1. Requires login (email + password, JWT-based) so every user's data --
     resume, tracked applications, notes, and settings -- is private to them
  2. Accepts a pasted job description + resume text (typed OR uploaded as PDF)
  3. Saves the uploaded resume so the user never has to re-upload it
  4. Calls Groq (free LLM API) to extract company, required skills,
     a resume match score, and improvement suggestions
  5. Stores applications (with dates & status) in SQLite, scoped per user
  6. Computes "due for follow-up" reminders, and can EMAIL them automatically
     on a schedule (daily reminder check + weekly digest) via APScheduler
  7. Lets the user edit job description / resume snapshot after tracking
  8. Supports search & filter, a per-application notes timeline, and CSV export

Run locally:
    pip install -r requirements.txt
    cp .env.example .env   # add your GROQ_API_KEY, SECRET_KEY (+ optional SMTP)
    python app.py
"""

import os
import io
import csv
import json
import sqlite3
import smtplib
from functools import wraps
from email.mime.text import MIMEText
from datetime import date, datetime, timedelta

import jwt
import requests
from flask import Flask, request, jsonify, g, Response
from flask_cors import CORS
from dotenv import load_dotenv
from pypdf import PdfReader
from werkzeug.security import generate_password_hash, check_password_hash
from apscheduler.schedulers.background import BackgroundScheduler

load_dotenv()

DB_PATH = os.path.join(os.path.dirname(__file__), "tracker.db")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

# Used to sign login tokens (JWT). MUST be set to a long random string in
# production -- if left as the dev default, all deployments would share the
# same signing key, which would let anyone forge a login token.
SECRET_KEY = os.getenv("SECRET_KEY", "dev-only-insecure-secret-change-me")
TOKEN_EXPIRY_DAYS = 7

# SMTP config for auto-reminders / digest emails. All optional -- if unset,
# emails are simply logged to the console instead of sent, so the app keeps
# working with zero email setup.
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USER)

app = Flask(__name__)
CORS(app)  # allow the Vercel frontend to call this API

if SECRET_KEY == "dev-only-insecure-secret-change-me":
    print("[WARNING] SECRET_KEY is not set -- using an insecure default. "
          "Set SECRET_KEY in your .env before deploying.")

# ----------------------------------------------------------------------
# Database helpers
# ----------------------------------------------------------------------

def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(exception=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def _table_columns(conn, table):
    return {row[1] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}


def init_db():
    conn = sqlite3.connect(DB_PATH)

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS applications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            company TEXT,
            job_title TEXT,
            job_link TEXT,
            job_description TEXT,
            resume_text TEXT,               -- resume snapshot used for this application
            skills TEXT,                    -- JSON list stored as text
            match_score INTEGER,
            suggestions TEXT,               -- JSON list stored as text
            applied_date TEXT,
            interview_date TEXT,
            follow_up_date TEXT,
            status TEXT DEFAULT 'Applied',  -- Applied / Interview / Offer / Rejected
            notes TEXT,
            last_reminded_date TEXT,        -- prevents sending the same reminder twice
            created_at TEXT
        )
        """
    )

    # One resume per user.
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS resume (
            user_id INTEGER PRIMARY KEY,
            filename TEXT,
            resume_text TEXT,
            updated_at TEXT
        )
        """
    )

    # One notification-preferences row per user.
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS settings (
            user_id INTEGER PRIMARY KEY,
            notification_email TEXT,
            reminders_enabled INTEGER DEFAULT 1,
            digest_enabled INTEGER DEFAULT 1
        )
        """
    )

    # Per-application timeline / activity log (multiple notes over time,
    # not just one overwritable "notes" field).
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS timeline (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            application_id INTEGER NOT NULL,
            note TEXT,
            created_at TEXT,
            FOREIGN KEY (application_id) REFERENCES applications (id) ON DELETE CASCADE
        )
        """
    )

    # ---- lightweight migrations for DBs created by earlier (pre-auth) versions ----
    app_cols = _table_columns(conn, "applications")
    for col, ddl in (
        ("resume_text", "ALTER TABLE applications ADD COLUMN resume_text TEXT"),
        ("last_reminded_date", "ALTER TABLE applications ADD COLUMN last_reminded_date TEXT"),
        ("user_id", "ALTER TABLE applications ADD COLUMN user_id INTEGER"),
    ):
        if col not in app_cols:
            conn.execute(ddl)

    # The old `resume` / `settings` tables (pre-v1.3) used a fixed single row
    # (id = 1) shared by everyone. That schema is incompatible with per-user
    # data, so if we detect the old shape we drop and recreate it -- any
    # previously "shared" resume/settings simply need re-entering per account.
    for table in ("resume", "settings"):
        cols = _table_columns(conn, table)
        if "user_id" not in cols and "id" in cols:
            conn.execute(f"DROP TABLE {table}")
    conn.commit()

    # Re-run CREATE TABLE IF NOT EXISTS in case anything was just dropped above.
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS resume (
            user_id INTEGER PRIMARY KEY,
            filename TEXT,
            resume_text TEXT,
            updated_at TEXT
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS settings (
            user_id INTEGER PRIMARY KEY,
            notification_email TEXT,
            reminders_enabled INTEGER DEFAULT 1,
            digest_enabled INTEGER DEFAULT 1
        )
        """
    )

    conn.commit()
    conn.close()


# ----------------------------------------------------------------------
# Auth helpers
# ----------------------------------------------------------------------

def generate_token(user_id: int) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.utcnow() + timedelta(days=TOKEN_EXPIRY_DAYS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def login_required(f):
    """Reads `Authorization: Bearer <token>`, verifies it, and sets g.user_id.
    Every data route (applications, resume, settings, timeline, export) uses
    this so users only ever see their own data."""
    @wraps(f)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        token = auth_header.replace("Bearer ", "").strip()
        if not token:
            return jsonify({"error": "Authentication required"}), 401
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            g.user_id = payload["user_id"]
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Session expired, please log in again"}), 401
        except Exception:
            return jsonify({"error": "Invalid or missing token"}), 401
        return f(*args, **kwargs)
    return wrapper


# ----------------------------------------------------------------------
# Groq AI helper
# ----------------------------------------------------------------------

def call_groq(job_description: str, resume_text: str) -> dict:
    """Ask Groq to extract company/skills and score the resume match.
    Returns a dict with keys: company, job_title, skills, match_score, suggestions.
    Falls back to a safe default if the API key is missing or the call fails.
    """
    if not GROQ_API_KEY:
        return {
            "company": "Unknown (no GROQ_API_KEY set)",
            "job_title": "",
            "skills": [],
            "match_score": 0,
            "suggestions": ["Add GROQ_API_KEY in .env to enable AI analysis."],
        }

    system_prompt = (
        "You are an expert technical recruiter assistant. Given a job description and a "
        "candidate resume, respond with ONLY valid JSON (no markdown, no commentary) in "
        "exactly this shape: "
        '{"company": string, "job_title": string, "skills": string[], '
        '"match_score": number (0-100), "suggestions": string[]}. '
        "skills = the key technical/soft skills required by the job. "
        "match_score = how well the resume matches those skills. "
        "suggestions = 3-5 short, actionable ways to improve the resume for this job."
    )

    user_prompt = f"JOB DESCRIPTION:\n{job_description}\n\nRESUME:\n{resume_text}"

    try:
        resp = requests.post(
            GROQ_URL,
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": GROQ_MODEL,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": 0.2,
                "response_format": {"type": "json_object"},
            },
            timeout=30,
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        data = json.loads(content)
        return {
            "company": data.get("company", "Unknown"),
            "job_title": data.get("job_title", ""),
            "skills": data.get("skills", []),
            "match_score": int(data.get("match_score", 0)),
            "suggestions": data.get("suggestions", []),
        }
    except Exception as exc:  # network error, bad JSON, etc.
        return {
            "company": "Unknown",
            "job_title": "",
            "skills": [],
            "match_score": 0,
            "suggestions": [f"AI analysis failed: {exc}"],
        }


# ----------------------------------------------------------------------
# Email helper (used by auto-reminders + weekly digest)
# ----------------------------------------------------------------------

def send_email(to_addr: str, subject: str, body: str) -> bool:
    """Send a plain-text email via SMTP. Returns True on success.
    If SMTP isn't configured, logs to the console instead of failing --
    so the automation logic can run in dev/demo without email setup."""
    if not to_addr:
        return False
    if not (SMTP_HOST and SMTP_USER and SMTP_PASSWORD):
        print(f"[email skipped - no SMTP configured] to={to_addr} subject={subject}\n{body}")
        return False
    try:
        msg = MIMEText(body)
        msg["Subject"] = subject
        msg["From"] = SMTP_FROM
        msg["To"] = to_addr
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM, [to_addr], msg.as_string())
        return True
    except Exception as exc:
        print(f"[email failed] to={to_addr}: {exc}")
        return False


# ---- Scheduled job 1: daily reminder check -> emails anything due today, per user ----
def check_and_send_reminders():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    today = date.today().isoformat()

    users_with_settings = conn.execute(
        "SELECT * FROM settings WHERE reminders_enabled = 1 AND notification_email != ''"
    ).fetchall()

    for settings_row in users_with_settings:
        user_id = settings_row["user_id"]
        to_addr = settings_row["notification_email"]
        due = conn.execute(
            """
            SELECT * FROM applications
            WHERE user_id = ? AND follow_up_date != '' AND follow_up_date <= ?
            AND status NOT IN ('Rejected', 'Offer')
            AND (last_reminded_date IS NULL OR last_reminded_date != ?)
            """,
            (user_id, today, today),
        ).fetchall()

        for row in due:
            body = (
                f"Follow-up reminder for your application to {row['company']} "
                f"({row['job_title'] or 'role not specified'}).\n"
                f"Follow-up was due: {row['follow_up_date']}\n"
                f"Current status: {row['status']}\n\n"
                "Sent automatically by Trackr."
            )
            sent = send_email(to_addr, f"Follow-up due: {row['company']}", body)
            if sent:
                conn.execute(
                    "UPDATE applications SET last_reminded_date = ? WHERE id = ?",
                    (today, row["id"]),
                )
    conn.commit()
    conn.close()


# ---- Scheduled job 2: weekly digest -> summary email every Monday, per user ----
def send_weekly_digest():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    users_with_settings = conn.execute(
        "SELECT * FROM settings WHERE digest_enabled = 1 AND notification_email != ''"
    ).fetchall()

    for settings_row in users_with_settings:
        user_id = settings_row["user_id"]
        to_addr = settings_row["notification_email"]
        rows = conn.execute(
            "SELECT * FROM applications WHERE user_id = ?", (user_id,)
        ).fetchall()

        total = len(rows)
        by_status = {}
        for r in rows:
            by_status[r["status"]] = by_status.get(r["status"], 0) + 1
        avg_score = round(sum(r["match_score"] or 0 for r in rows) / total, 1) if total else 0
        week_ahead = (date.today() + timedelta(days=7)).isoformat()
        upcoming_interviews = [
            r for r in rows
            if r["interview_date"] and date.today().isoformat() <= r["interview_date"] <= week_ahead
        ]

        lines = [
            f"Weekly Trackr digest — {date.today().isoformat()}",
            "",
            f"Total tracked applications: {total}",
            "By status: " + ", ".join(f"{k}: {v}" for k, v in by_status.items()) if by_status else "No applications yet.",
            f"Average resume match score: {avg_score}%",
            "",
            f"Interviews in the next 7 days: {len(upcoming_interviews)}",
        ]
        for r in upcoming_interviews:
            lines.append(f"  - {r['company']} on {r['interview_date']}")

        send_email(to_addr, "Your weekly job search digest", "\n".join(lines))

    conn.close()


scheduler = BackgroundScheduler()
scheduler.add_job(check_and_send_reminders, "cron", hour=8, minute=0, id="daily_reminders")
scheduler.add_job(send_weekly_digest, "cron", day_of_week="mon", hour=8, minute=0, id="weekly_digest")


# ----------------------------------------------------------------------
# Auth routes
# ----------------------------------------------------------------------

@app.route("/api/auth/register", methods=["POST"])
def register():
    payload = request.get_json(force=True) or {}
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""

    if not email or "@" not in email:
        return jsonify({"error": "A valid email is required"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    db = get_db()
    existing = db.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    if existing:
        return jsonify({"error": "An account with this email already exists"}), 409

    cur = db.execute(
        "INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)",
        (email, generate_password_hash(password), datetime.utcnow().isoformat()),
    )
    db.commit()
    user_id = cur.lastrowid

    # Give every new user a default settings row so /api/settings GET works immediately.
    db.execute(
        "INSERT INTO settings (user_id, notification_email, reminders_enabled, digest_enabled) VALUES (?, '', 1, 1)",
        (user_id,),
    )
    db.commit()

    token = generate_token(user_id)
    return jsonify({"token": token, "email": email}), 201


@app.route("/api/auth/login", methods=["POST"])
def login():
    payload = request.get_json(force=True) or {}
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""

    db = get_db()
    user = db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Invalid email or password"}), 401

    token = generate_token(user["id"])
    return jsonify({"token": token, "email": user["email"]})


@app.route("/api/auth/me", methods=["GET"])
@login_required
def me():
    db = get_db()
    user = db.execute("SELECT id, email, created_at FROM users WHERE id = ?", (g.user_id,)).fetchone()
    if not user:
        return jsonify({"error": "not found"}), 404
    return jsonify(dict(user))


# ----------------------------------------------------------------------
# Routes
# ----------------------------------------------------------------------

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "time": datetime.utcnow().isoformat()})


@app.route("/api/analyze", methods=["POST"])
@login_required
def analyze():
    """Step 1: paste job description + resume -> get AI extraction & match score.
    Both fields are required -- there's no useful match score without a resume,
    and nothing to analyze without a job description."""
    payload = request.get_json(force=True) or {}
    job_description = payload.get("job_description", "").strip()
    resume_text = payload.get("resume_text", "").strip()
    job_link = payload.get("job_link", "").strip()

    if not job_description:
        return jsonify({"error": "job_description is required"}), 400
    if not resume_text:
        return jsonify({"error": "resume_text is required"}), 400

    result = call_groq(job_description, resume_text)
    result["job_link"] = job_link
    return jsonify(result)


@app.route("/api/resume", methods=["GET"])
@login_required
def get_resume():
    """Return the current user's previously saved resume (if any) so the
    frontend can prefill it and they never have to re-upload/retype it."""
    db = get_db()
    row = db.execute("SELECT * FROM resume WHERE user_id = ?", (g.user_id,)).fetchone()
    if not row:
        return jsonify({"filename": "", "resume_text": "", "updated_at": ""})
    return jsonify(dict(row))


@app.route("/api/resume/upload", methods=["POST"])
@login_required
def upload_resume():
    """Accept a PDF resume, extract its text with pypdf, and save it (overwriting
    this user's previous resume) so it's available on future visits without
    re-uploading. Private to the logged-in user."""
    file = request.files.get("file")
    if not file or file.filename == "":
        return jsonify({"error": "No file uploaded"}), 400
    if not file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Only PDF files are supported"}), 400

    try:
        reader = PdfReader(file.stream)
        text = "\n".join(page.extract_text() or "" for page in reader.pages).strip()
    except Exception as exc:
        return jsonify({"error": f"Could not read PDF: {exc}"}), 400

    if not text:
        return jsonify({"error": "No selectable text found in this PDF (it may be a scanned image)."}), 400

    db = get_db()
    db.execute(
        """
        INSERT INTO resume (user_id, filename, resume_text, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
            filename = excluded.filename,
            resume_text = excluded.resume_text,
            updated_at = excluded.updated_at
        """,
        (g.user_id, file.filename, text, datetime.utcnow().isoformat()),
    )
    db.commit()
    return jsonify({"filename": file.filename, "resume_text": text})


@app.route("/api/settings", methods=["GET"])
@login_required
def get_settings():
    """This user's notification preferences: where to send reminder/digest emails."""
    db = get_db()
    row = db.execute("SELECT * FROM settings WHERE user_id = ?", (g.user_id,)).fetchone()
    if not row:
        return jsonify({"notification_email": "", "reminders_enabled": True, "digest_enabled": True})
    d = dict(row)
    d["reminders_enabled"] = bool(d["reminders_enabled"])
    d["digest_enabled"] = bool(d["digest_enabled"])
    return jsonify(d)


@app.route("/api/settings", methods=["POST"])
@login_required
def save_settings():
    payload = request.get_json(force=True) or {}
    db = get_db()
    db.execute(
        """
        INSERT INTO settings (user_id, notification_email, reminders_enabled, digest_enabled)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
            notification_email = excluded.notification_email,
            reminders_enabled = excluded.reminders_enabled,
            digest_enabled = excluded.digest_enabled
        """,
        (
            g.user_id,
            payload.get("notification_email", ""),
            1 if payload.get("reminders_enabled", True) else 0,
            1 if payload.get("digest_enabled", True) else 0,
        ),
    )
    db.commit()
    return get_settings()


@app.route("/api/applications", methods=["GET"])
@login_required
def list_applications():
    """Supports optional ?search= (matches company/job_title) and
    ?status= (exact match) query params for the search & filter UI.
    Always scoped to the logged-in user."""
    db = get_db()
    search = request.args.get("search", "").strip()
    status = request.args.get("status", "").strip()

    query = "SELECT * FROM applications WHERE user_id = ?"
    params = [g.user_id]
    if search:
        query += " AND (company LIKE ? OR job_title LIKE ?)"
        like = f"%{search}%"
        params += [like, like]
    if status:
        query += " AND status = ?"
        params.append(status)
    query += " ORDER BY created_at DESC"

    rows = db.execute(query, params).fetchall()
    return jsonify([row_to_dict(r) for r in rows])


@app.route("/api/applications", methods=["POST"])
@login_required
def create_application():
    """Step 2: save the analyzed job as a tracked application, owned by the
    logged-in user."""
    payload = request.get_json(force=True) or {}
    db = get_db()
    cur = db.execute(
        """
        INSERT INTO applications
        (user_id, company, job_title, job_link, job_description, resume_text, skills, match_score,
         suggestions, applied_date, interview_date, follow_up_date, status, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            g.user_id,
            payload.get("company", "Unknown"),
            payload.get("job_title", ""),
            payload.get("job_link", ""),
            payload.get("job_description", ""),
            payload.get("resume_text", ""),
            json.dumps(payload.get("skills", [])),
            payload.get("match_score", 0),
            json.dumps(payload.get("suggestions", [])),
            payload.get("applied_date") or date.today().isoformat(),
            payload.get("interview_date", ""),
            payload.get("follow_up_date", ""),
            payload.get("status", "Applied"),
            payload.get("notes", ""),
            datetime.utcnow().isoformat(),
        ),
    )
    db.commit()
    new_id = cur.lastrowid
    db.execute(
        "INSERT INTO timeline (application_id, note, created_at) VALUES (?, ?, ?)",
        (new_id, "Application tracked.", datetime.utcnow().isoformat()),
    )
    db.commit()
    new_row = db.execute(
        "SELECT * FROM applications WHERE id = ? AND user_id = ?", (new_id, g.user_id)
    ).fetchone()
    return jsonify(row_to_dict(new_row)), 201


def _get_owned_application(db, app_id, user_id):
    """Fetch an application only if it belongs to the current user -- prevents
    one user from reading/editing/deleting another user's data by guessing IDs."""
    return db.execute(
        "SELECT * FROM applications WHERE id = ? AND user_id = ?", (app_id, user_id)
    ).fetchone()


@app.route("/api/applications/<int:app_id>", methods=["PUT"])
@login_required
def update_application(app_id):
    """Edit dates, status, notes, or the job description / resume snapshot
    for a tracked application. A timeline entry is logged automatically
    whenever the status changes. Only works on applications you own."""
    payload = request.get_json(force=True) or {}
    db = get_db()
    existing = _get_owned_application(db, app_id, g.user_id)
    if not existing:
        return jsonify({"error": "not found"}), 404

    fields = [
        "company", "job_title", "job_link", "applied_date",
        "interview_date", "follow_up_date", "status", "notes",
        "job_description", "resume_text",
    ]
    updates = {f: payload[f] for f in fields if f in payload}

    if "match_score" in payload:
        updates["match_score"] = payload["match_score"]
    if "skills" in payload:
        updates["skills"] = json.dumps(payload["skills"])
    if "suggestions" in payload:
        updates["suggestions"] = json.dumps(payload["suggestions"])

    if updates:
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        db.execute(
            f"UPDATE applications SET {set_clause} WHERE id = ? AND user_id = ?",
            (*updates.values(), app_id, g.user_id),
        )
        if "status" in updates and updates["status"] != existing["status"]:
            db.execute(
                "INSERT INTO timeline (application_id, note, created_at) VALUES (?, ?, ?)",
                (app_id, f"Status changed to {updates['status']}.", datetime.utcnow().isoformat()),
            )
        db.commit()

    row = _get_owned_application(db, app_id, g.user_id)
    return jsonify(row_to_dict(row))


@app.route("/api/applications/<int:app_id>", methods=["DELETE"])
@login_required
def delete_application(app_id):
    db = get_db()
    existing = _get_owned_application(db, app_id, g.user_id)
    if not existing:
        return jsonify({"error": "not found"}), 404
    db.execute("DELETE FROM applications WHERE id = ? AND user_id = ?", (app_id, g.user_id))
    db.execute("DELETE FROM timeline WHERE application_id = ?", (app_id,))
    db.commit()
    return jsonify({"deleted": app_id})


@app.route("/api/applications/<int:app_id>/timeline", methods=["GET"])
@login_required
def get_timeline(app_id):
    db = get_db()
    if not _get_owned_application(db, app_id, g.user_id):
        return jsonify({"error": "not found"}), 404
    rows = db.execute(
        "SELECT * FROM timeline WHERE application_id = ? ORDER BY created_at ASC",
        (app_id,),
    ).fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/api/applications/<int:app_id>/timeline", methods=["POST"])
@login_required
def add_timeline_note(app_id):
    db = get_db()
    if not _get_owned_application(db, app_id, g.user_id):
        return jsonify({"error": "not found"}), 404
    payload = request.get_json(force=True) or {}
    note = (payload.get("note") or "").strip()
    if not note:
        return jsonify({"error": "note is required"}), 400
    db.execute(
        "INSERT INTO timeline (application_id, note, created_at) VALUES (?, ?, ?)",
        (app_id, note, datetime.utcnow().isoformat()),
    )
    db.commit()
    rows = db.execute(
        "SELECT * FROM timeline WHERE application_id = ? ORDER BY created_at ASC",
        (app_id,),
    ).fetchall()
    return jsonify([dict(r) for r in rows]), 201


@app.route("/api/reminders", methods=["GET"])
@login_required
def reminders():
    """Simple reminder engine: anything with a follow_up_date today or
    earlier (and not Rejected/Offer) is 'due'. Shown in-app; also emailed
    automatically once a day by the scheduler if notifications are set up.
    Scoped to the logged-in user."""
    db = get_db()
    today = date.today().isoformat()
    rows = db.execute(
        """
        SELECT * FROM applications
        WHERE user_id = ? AND follow_up_date != '' AND follow_up_date <= ?
        AND status NOT IN ('Rejected', 'Offer')
        ORDER BY follow_up_date ASC
        """,
        (g.user_id, today),
    ).fetchall()
    return jsonify([row_to_dict(r) for r in rows])


@app.route("/api/export/csv", methods=["GET"])
@login_required
def export_csv():
    """Export the logged-in user's tracked applications as a CSV file
    (opens fine in Excel too)."""
    db = get_db()
    rows = db.execute(
        "SELECT * FROM applications WHERE user_id = ? ORDER BY created_at DESC", (g.user_id,)
    ).fetchall()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Company", "Job Title", "Job Link", "Match Score", "Skills",
        "Applied Date", "Interview Date", "Follow-up Date", "Status", "Notes",
    ])
    for r in rows:
        d = row_to_dict(r)
        writer.writerow([
            d["company"], d["job_title"], d["job_link"], d["match_score"],
            "; ".join(d["skills"]), d["applied_date"], d["interview_date"],
            d["follow_up_date"], d["status"], d["notes"],
        ])

    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=applications.csv"},
    )


def row_to_dict(row) -> dict:
    d = dict(row)
    for key in ("skills", "suggestions"):
        try:
            d[key] = json.loads(d.get(key) or "[]")
        except json.JSONDecodeError:
            d[key] = []
    return d


init_db()
scheduler.start()

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True, use_reloader=False)
