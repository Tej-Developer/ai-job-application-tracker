import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const toast = useToast();

  const [username, setUsername] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (user?.username) setUsername(user.username);
  }, [user]);

  const handleUsernameSave = async () => {
    if (username === user?.username) return;
    setSavingUsername(true);
    try {
      await updateProfile({ username });
      toast.success("Username updated.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingUsername(false);
    }
  };

  const handlePasswordSave = async () => {
    if (!currentPassword || !newPassword) {
      toast.error("Enter your current and new password.");
      return;
    }
    setSavingPassword(true);
    try {
      await updateProfile({
        current_password: currentPassword,
        new_password: newPassword,
      });
      toast.success("Password changed.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-line rounded-xl p-6">
        <h2 className="font-display font-bold text-lg mb-1">Your profile</h2>
        <p className="text-sm text-muted mb-5">Email and account details.</p>

        <div className="flex items-center gap-4 mb-5">
          <span className="w-14 h-14 rounded-full bg-slate-soft text-slate flex items-center justify-center font-display font-bold text-xl">
            {(user?.username || user?.email || "?").charAt(0).toUpperCase()}
          </span>
          <div>
            <div className="font-semibold">{user?.username}</div>
            <div className="text-sm text-muted font-mono">{user?.email}</div>
          </div>
        </div>

        <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">
          Username
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="flex-1 px-3.5 py-2.5 border border-line rounded-lg text-sm bg-[#FBFCFD] focus:outline-none focus:ring-2 focus:ring-ink"
          />
          <button
            onClick={handleUsernameSave}
            disabled={savingUsername || username === user?.username}
            className="rounded-lg bg-slate-soft text-slate font-semibold text-sm px-4 py-2.5 hover:bg-[#d3deeb] transition-colors disabled:opacity-50"
          >
            {savingUsername ? "Saving…" : "Save"}
          </button>
        </div>
        <p className="text-xs text-muted mt-1.5">
          3-20 characters: letters, numbers, and underscores only.
        </p>
      </div>

      <div className="bg-white border border-line rounded-xl p-6">
        <h2 className="font-display font-bold text-lg mb-1">Change password</h2>
        <p className="text-sm text-muted mb-5">
          You'll need your current password to set a new one.
        </p>

        <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">
          Current password
        </label>
        <div className="relative mb-4">
          <input
            type={showCurrent ? "text" : "password"}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full px-3.5 py-2.5 pr-11 border border-line rounded-lg text-sm bg-[#FBFCFD] focus:outline-none focus:ring-2 focus:ring-ink"
          />
          <button
            type="button"
            onClick={() => setShowCurrent((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
          >
            {showCurrent ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>

        <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">
          New password
        </label>
        <div className="relative mb-4">
          <input
            type={showNew ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 6 characters"
            className="w-full px-3.5 py-2.5 pr-11 border border-line rounded-lg text-sm bg-[#FBFCFD] focus:outline-none focus:ring-2 focus:ring-ink"
          />
          <button
            type="button"
            onClick={() => setShowNew((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
          >
            {showNew ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>

        <button
          onClick={handlePasswordSave}
          disabled={savingPassword}
          className="rounded-lg bg-ink text-white font-semibold text-sm px-5 py-2.5 hover:bg-[#0d1826] transition-colors disabled:opacity-60"
        >
          {savingPassword ? "Updating…" : "Update password"}
        </button>
      </div>
    </div>
  );
}
