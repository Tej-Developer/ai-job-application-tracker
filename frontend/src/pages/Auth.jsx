import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

export default function Auth({ mode: initialMode }) {
  const [mode, setMode] = useState(initialMode || "login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login, register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const isLogin = mode === "login";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
        toast.success("Welcome back.");
      } else {
        await register(email, username, password);
        toast.success("Account created — welcome to Trackr.");
      }
      navigate("/app");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      {/* Back to landing — the missing piece from the previous version */}
      <div className="p-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink transition-colors font-medium"
        >
          <ArrowLeft size={16} />
          Back to Trackr
        </Link>
      </div>

      <div className="flex-1 flex items-start justify-center px-5 pb-16">
        <div className="w-full max-w-[400px] bg-white border border-line rounded-2xl shadow-soft p-8 mt-6 animate-fade-up">
          <h1 className="font-display font-bold text-2xl text-center mb-1">
            Trackr<span className="text-amber-deep">.</span>
          </h1>
          <p className="text-center text-muted text-sm mb-7">
            {isLogin ? "Sign in to track your job applications privately." : "Create an account to start tracking."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-line rounded-lg bg-[#FBFCFD] text-sm focus:outline-none focus:ring-2 focus:ring-ink focus:border-ink transition-shadow"
              />
            </div>

            {!isLogin && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">
                  Username <span className="normal-case text-muted/70 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  autoComplete="username"
                  placeholder="Auto-generated from your email if left blank"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-line rounded-lg bg-[#FBFCFD] text-sm focus:outline-none focus:ring-2 focus:ring-ink focus:border-ink transition-shadow placeholder:text-xs"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  placeholder={isLogin ? undefined : "At least 6 characters"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 pr-11 border border-line rounded-lg bg-[#FBFCFD] text-sm focus:outline-none focus:ring-2 focus:ring-ink focus:border-ink transition-shadow"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-rust text-sm bg-rust-soft border border-rust/20 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-amber text-[#241505] font-semibold text-sm py-3 transition-all hover:bg-amber-deep hover:text-white disabled:opacity-60"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {isLogin ? "Log in" : "Create account"}
            </button>
          </form>

          <div className="text-center text-sm text-muted mt-6">
            {isLogin ? (
              <>
                Don't have an account?{" "}
                <button
                  onClick={() => { setMode("register"); setError(""); }}
                  className="text-amber-deep font-semibold hover:underline"
                >
                  Create one
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  onClick={() => { setMode("login"); setError(""); }}
                  className="text-amber-deep font-semibold hover:underline"
                >
                  Log in
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
