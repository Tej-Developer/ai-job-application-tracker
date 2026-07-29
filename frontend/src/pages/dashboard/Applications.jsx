import { useEffect, useState, useCallback } from "react";
import { Search, Download, Trash2, ExternalLink, X, Send } from "lucide-react";
import { api, downloadCsv } from "../../lib/api";
import { useToast } from "../../context/ToastContext";
import StatusPill from "../../components/StatusPill";

const STATUSES = ["Applied", "Interview", "Offer", "Rejected"];

const getScoreColor = (score) => {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-500";
  if (score >= 40) return "text-orange-500";
  return "text-red-500";
};

function StatCard({ label, value, warn }) {
  return (
    <div
      className={`rounded-xl border p-4 ${warn ? "bg-amber-soft border-amber/40" : "bg-white border-line"}`}
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">
        {label}
      </div>
      <div
        className={`font-mono text-2xl font-semibold ${warn ? "text-amber-deep" : "text-ink"}`}
      >
        {value}
      </div>
    </div>
  );
}

export default function Applications() {
  const [apps, setApps] = useState([]);
  const [dueCount, setDueCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [activeApp, setActiveApp] = useState(null); // application shown in the detail drawer
  const toast = useToast();

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    try {
      const data = await api.get(`/api/applications?${params.toString()}`);
      setApps(data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadReminders = useCallback(async () => {
    try {
      const due = await api.get("/api/reminders");
      setDueCount(due.length);
    } catch {
      /* non-critical */
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  useEffect(() => {
    loadReminders();
  }, [loadReminders]);

  const total = apps.length;
  const interviews = apps.filter((a) => a.status === "Interview").length;
  const avgScore = total
    ? Math.round(apps.reduce((s, a) => s + (a.match_score || 0), 0) / total)
    : 0;

  const updateField = async (id, field, value) => {
    try {
      await api.put(`/api/applications/${id}`, { [field]: value });
      load();
      loadReminders();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this application? This can't be undone.")) return;
    try {
      await api.delete(`/api/applications/${id}`);
      toast.success("Application deleted.");
      if (activeApp?.id === id) setActiveApp(null);
      load();
      loadReminders();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleExport = async () => {
    try {
      await downloadCsv();
      toast.success("CSV downloaded.");
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {dueCount > 0 && (
        <div className="bg-amber-soft border border-amber/40 text-[#7a4c0e] rounded-xl px-4 py-3 text-sm">
          <strong className="block mb-0.5">
            Follow-up reminders ({dueCount})
          </strong>
          Head to any flagged application below to check in with the recruiter.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Tracked" value={total} />
        <StatCard label="Interviews" value={interviews} />
        <StatCard label="Avg match" value={`${avgScore}%`} />
        <StatCard label="Follow-ups due" value={dueCount} warn />
      </div>

      <div className="bg-white border border-line rounded-xl p-5">
        <div className="flex flex-wrap gap-3 items-center mb-4">
          <div className="relative flex-1 min-w-[180px]">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="search"
              placeholder="Search by company or role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 border border-line rounded-lg text-sm bg-[#FBFCFD] focus:outline-none focus:ring-2 focus:ring-ink"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 border border-line rounded-lg text-sm bg-[#FBFCFD] focus:outline-none focus:ring-2 focus:ring-ink"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 border border-line rounded-lg px-3.5 py-2.5 text-sm font-medium text-muted hover:text-ink hover:border-ink transition-colors"
          >
            <Download size={15} /> Export CSV
          </button>
        </div>

        {loading ? (
          <div className="text-center text-muted text-sm py-14">
            Loading applications…
          </div>
        ) : apps.length === 0 ? (
          <div className="text-center text-muted text-sm py-14">
            No applications tracked yet — head to "New application" to get
            started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted border-b-2 border-line font-mono">
                  <th className="py-2.5 px-2">Company</th>
                  <th className="py-2.5 px-2">Role</th>
                  <th className="py-2.5 px-2">Score</th>
                  <th className="py-2.5 px-2">Applied</th>
                  <th className="py-2.5 px-2">Follow-up</th>
                  <th className="py-2.5 px-2">Status</th>
                  <th className="py-2.5 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {apps.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-line hover:bg-[#FAFBFC] transition-colors"
                  >
                    <td className="py-3 px-2 font-medium">{a.company}</td>
                    <td className="py-3 px-2 text-muted">
                      {a.job_title || "—"}
                    </td>
                    <td className={`py-3 px-2 font-mono ${ getScoreColor(a.match_score ?? 0) }`}>
                      {a.match_score ?? 0}%
                    </td>
                    <td className="py-3 px-2">
                      <input
                        type="date"
                        defaultValue={a.applied_date}
                        onChange={(e) =>
                          updateField(a.id, "applied_date", e.target.value)
                        }
                        className="border border-line rounded px-1.5 py-1 text-xs font-mono"
                      />
                    </td>
                    <td className="py-3 px-2">
                      <input
                        type="date"
                        defaultValue={a.follow_up_date}
                        onChange={(e) =>
                          updateField(a.id, "follow_up_date", e.target.value)
                        }
                        className="border border-line rounded px-1.5 py-1 text-xs font-mono"
                      />
                    </td>
                    <td className="py-3 px-2">
                      <select
                        value={a.status}
                        onChange={(e) =>
                          updateField(a.id, "status", e.target.value)
                        }
                        className="border-none bg-transparent"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <div className="mt-1">
                        <StatusPill status={a.status} />
                      </div>
                    </td>
                    <td className="py-3 px-2 whitespace-nowrap">
                      <button
                        onClick={() => setActiveApp(a)}
                        className="text-xs font-semibold text-slate hover:underline mr-3"
                      >
                        Details
                      </button>
                      <button
                        onClick={() => handleDelete(a.id)}
                        className="text-rust/70 hover:text-rust"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {activeApp && (
        <DetailDrawer
          application={activeApp}
          onClose={() => setActiveApp(null)}
          onSaved={() => {
            load();
          }}
        />
      )}
    </div>
  );
}

function DetailDrawer({ application, onClose, onSaved }) {
  const [jobDescription, setJobDescription] = useState(
    application.job_description || "",
  );
  const [resumeText, setResumeText] = useState(application.resume_text || "");
  const [timeline, setTimeline] = useState([]);
  const [noteInput, setNoteInput] = useState("");
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api
      .get(`/api/applications/${application.id}/timeline`)
      .then(setTimeline)
      .catch(() => { });
  }, [application.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/api/applications/${application.id}`, {
        job_description: jobDescription,
        resume_text: resumeText,
      });
      toast.success("Changes saved.");
      onSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const addNote = async () => {
    if (!noteInput.trim()) return;
    try {
      const updated = await api.post(
        `/api/applications/${application.id}/timeline`,
        { note: noteInput.trim() },
      );
      setTimeline(updated);
      setNoteInput("");
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="mt-0 fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="relative w-full max-w-xl bg-white h-full shadow-2xl overflow-y-auto animate-fade-up">
        <div className="sticky top-0 bg-white border-b border-line px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="font-display font-bold text-lg">
              {application.company}
            </h2>
            <p className="text-sm text-muted">
              {application.job_title || "Role not specified"}
            </p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {application.job_link && (
            <a
              href={application.job_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-slate hover:underline"
            >
              View original listing <ExternalLink size={13} />
            </a>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">
              Job description
            </label>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              className="w-full min-h-[130px] px-3 py-2.5 border border-line rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ink"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">
              Resume snapshot used
            </label>
            <textarea
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              className="w-full min-h-[130px] px-3 py-2.5 border border-line rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ink"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full sm:w-auto rounded-lg bg-slate-soft text-slate font-semibold text-sm px-5 py-2.5 hover:bg-[#d3deeb] transition-colors disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">
              Notes timeline
            </label>
            <ul className="max-h-48 overflow-y-auto thin-scroll space-y-2 mb-3">
              {timeline.length === 0 && (
                <li className="text-sm text-muted">No notes yet.</li>
              )}
              {timeline.map((ev) => (
                <li
                  key={ev.id}
                  className="text-sm border-b border-dashed border-line pb-2"
                >
                  <span className="block text-xs font-mono text-muted mb-0.5">
                    {new Date(ev.created_at).toLocaleString()}
                  </span>
                  {ev.note}
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <input
                type="text"
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addNote()}
                placeholder="Add a note (e.g. 'recruiter replied')..."
                className="flex-1 px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ink"
              />
              <button
                onClick={addNote}
                className="rounded-lg bg-slate-soft text-slate px-3.5 py-2 hover:bg-[#d3deeb] transition-colors"
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
