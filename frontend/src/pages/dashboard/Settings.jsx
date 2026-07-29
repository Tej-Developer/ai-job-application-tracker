import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useToast } from "../../context/ToastContext";

export default function Settings() {
  const [email, setEmail] = useState("");
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [digestEnabled, setDigestEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api
      .get("/api/settings")
      .then((s) => {
        setEmail(s.notification_email || "");
        setRemindersEnabled(!!s.reminders_enabled);
        setDigestEnabled(!!s.digest_enabled);
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post("/api/settings", {
        notification_email: email,
        reminders_enabled: remindersEnabled,
        digest_enabled: digestEnabled,
      });
      toast.success("Preferences saved.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex justify-center items-center">
      <div className="max-w-xl">
        <div className="bg-white border border-line rounded-xl p-6">
          <h2 className="font-display font-bold text-lg mb-1">
            Email reminders & weekly digest
          </h2>
          <p className="text-sm text-muted mb-5">
            Trackr can automatically email you when a follow-up is due, and send
            a weekly summary every Monday.
          </p>

          <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">
            Your email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full px-3.5 py-2.5 border border-line rounded-lg text-sm bg-[#FBFCFD] focus:outline-none focus:ring-2 focus:ring-ink"
          />

          <label className="flex items-center gap-2.5 mt-4 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={remindersEnabled}
              onChange={(e) => setRemindersEnabled(e.target.checked)}
              className="w-4 h-4 accent-ink"
            />
            Email me when a follow-up is due
          </label>

          <label className="flex items-center gap-2.5 mt-3 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={digestEnabled}
              onChange={(e) => setDigestEnabled(e.target.checked)}
              className="w-4 h-4 accent-ink"
            />
            Email me a weekly digest (Mondays)
          </label>

          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-6 rounded-lg bg-slate-soft text-slate font-semibold text-sm px-5 py-2.5 hover:bg-[#d3deeb] transition-colors disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save preferences"}
          </button>
        </div>
      </div>
    </div>
  );
}
