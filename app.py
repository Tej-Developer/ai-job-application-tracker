"""
AI Job Application Tracker - Backend (v1.1)
------------------------------------------
A single-file Flask app (kept intentionally low-code) that:
  1. Accepts a pasted job description + resume text (typed OR uploaded as PDF)
  2. Saves the uploaded resume so the user never has to re-upload it
  3. Calls Groq (free LLM API) to extract company, required skills,
     a resume match score, and improvement suggestions
  4. Stores applications (with dates & status) in SQLite
  5. Exposes a small REST API used by the static frontend
  6. Computes "due for follow-up" reminders

Run locally:
    pip install -r requirements.txt
    cp .env.example .env   # add your GROQ_API_KEY
    python app.py
"""

import os
import json
import sqlite3
from datetime import date, datetime

import requests
from flask import Flask, request, jsonify, g
from flask_cors import CORS
from dotenv import load_dotenv
from pypdf import PdfReader

load_dotenv()

DB_PATH = os.path.join(os.path.dirname(__file__), "tracker.db")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

app = Flask(__name__)
CORS(app)  # allow the Vercel frontend to call this API

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


def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS applications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company TEXT,
            job_title TEXT,
            job_link TEXT,
            job_description TEXT,
            skills TEXT,          -- JSON list stored as text
            match_score INTEGER,
            suggestions TEXT,     -- JSON list stored as text
            applied_date TEXT,
            interview_date TEXT,
            follow_up_date TEXT,
            status TEXT DEFAULT 'Applied',   -- Applied / Interview / Offer / Rejected
            notes TEXT,
            created_at TEXT
        )
        """
    )
    # Single-row table holding the user's most recently uploaded/pasted resume,
    # so they never have to re-upload it on their next visit.
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS resume (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            filename TEXT,
            resume_text TEXT,
            updated_at TEXT
        )
        """
    )
    conn.commit()
    conn.close()


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
        # normalize / guard against missing keys
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
# Routes
# ----------------------------------------------------------------------

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "time": datetime.utcnow().isoformat()})


@app.route("/api/analyze", methods=["POST"])
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
def get_resume():
    """Return the user's previously saved resume (if any) so the frontend
    can prefill it and the user never has to re-upload/retype it."""
    db = get_db()
    row = db.execute("SELECT * FROM resume WHERE id = 1").fetchone()
    if not row:
        return jsonify({"filename": "", "resume_text": "", "updated_at": ""})
    return jsonify(dict(row))


@app.route("/api/resume/upload", methods=["POST"])
def upload_resume():
    """Accept a PDF resume, extract its text with pypdf, and save it (overwriting
    any previous resume) so it's available on future visits without re-uploading."""
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
        INSERT INTO resume (id, filename, resume_text, updated_at)
        VALUES (1, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            filename = excluded.filename,
            resume_text = excluded.resume_text,
            updated_at = excluded.updated_at
        """,
        (file.filename, text, datetime.utcnow().isoformat()),
    )
    db.commit()
    return jsonify({"filename": file.filename, "resume_text": text})


@app.route("/api/applications", methods=["GET"])
def list_applications():
    db = get_db()
    rows = db.execute(
        "SELECT * FROM applications ORDER BY created_at DESC"
    ).fetchall()
    return jsonify([row_to_dict(r) for r in rows])


@app.route("/api/applications", methods=["POST"])
def create_application():
    """Step 2: save the analyzed job as a tracked application."""
    payload = request.get_json(force=True) or {}
    db = get_db()
    cur = db.execute(
        """
        INSERT INTO applications
        (company, job_title, job_link, job_description, skills, match_score,
         suggestions, applied_date, interview_date, follow_up_date, status, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            payload.get("company", "Unknown"),
            payload.get("job_title", ""),
            payload.get("job_link", ""),
            payload.get("job_description", ""),
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
    new_row = db.execute(
        "SELECT * FROM applications WHERE id = ?", (cur.lastrowid,)
    ).fetchone()
    return jsonify(row_to_dict(new_row)), 201


@app.route("/api/applications/<int:app_id>", methods=["PUT"])
def update_application(app_id):
    """Edit dates, status, or notes (e.g. mark Interview / Rejected / Offer)."""
    payload = request.get_json(force=True) or {}
    db = get_db()
    existing = db.execute(
        "SELECT * FROM applications WHERE id = ?", (app_id,)
    ).fetchone()
    if not existing:
        return jsonify({"error": "not found"}), 404

    fields = [
        "company", "job_title", "job_link", "applied_date",
        "interview_date", "follow_up_date", "status", "notes",
    ]
    updates = {f: payload[f] for f in fields if f in payload}
    if updates:
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        db.execute(
            f"UPDATE applications SET {set_clause} WHERE id = ?",
            (*updates.values(), app_id),
        )
        db.commit()

    row = db.execute("SELECT * FROM applications WHERE id = ?", (app_id,)).fetchone()
    return jsonify(row_to_dict(row))


@app.route("/api/applications/<int:app_id>", methods=["DELETE"])
def delete_application(app_id):
    db = get_db()
    db.execute("DELETE FROM applications WHERE id = ?", (app_id,))
    db.commit()
    return jsonify({"deleted": app_id})


@app.route("/api/reminders", methods=["GET"])
def reminders():
    """Simple reminder engine: anything with a follow_up_date today or
    earlier (and not Rejected/Offer) is 'due'."""
    db = get_db()
    today = date.today().isoformat()
    rows = db.execute(
        """
        SELECT * FROM applications
        WHERE follow_up_date != '' AND follow_up_date <= ?
        AND status NOT IN ('Rejected', 'Offer')
        ORDER BY follow_up_date ASC
        """,
        (today,),
    ).fetchall()
    return jsonify([row_to_dict(r) for r in rows])


def row_to_dict(row) -> dict:
    d = dict(row)
    for key in ("skills", "suggestions"):
        try:
            d[key] = json.loads(d.get(key) or "[]")
        except json.JSONDecodeError:
            d[key] = []
    return d


if __name__ == "__main__":
    init_db()
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)