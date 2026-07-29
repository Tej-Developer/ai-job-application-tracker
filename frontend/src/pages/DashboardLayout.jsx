import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { LayoutGrid, FilePlus2, Settings as SettingsIcon, ChevronDown, LogOut, UserRound } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const TABS = [
  { to: "/app", label: "Applications", icon: LayoutGrid, end: true },
  { to: "/app/new", label: "New application", icon: FilePlus2, end: false },
  { to: "/app/settings", label: "Settings", icon: SettingsIcon, end: false },
];

function tabClasses({ isActive }) {
  return `inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
    isActive ? "bg-ink text-white" : "text-muted hover:bg-paper hover:text-ink"
  }`;
}

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-paper pb-16 md:pb-0">
      <nav className="sticky top-0 z-40 bg-white border-b border-line">
        <div className="max-w-[1180px] mx-auto px-7 h-16 flex items-center justify-between gap-5">
          <span className="font-display font-bold text-xl shrink-0">
            Trackr<span className="text-amber-deep">.</span>
          </span>

          <div className="hidden md:flex gap-1 flex-1 justify-center">
            {TABS.map((tab) => (
              <NavLink key={tab.to} to={tab.to} end={tab.end} className={tabClasses}>
                <tab.icon size={15} />
                {tab.label}
              </NavLink>
            ))}
          </div>

          <div className="relative shrink-0" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 text-sm text-muted hover:text-ink transition-colors"
            >
              <span className="w-8 h-8 rounded-full bg-slate-soft text-slate flex items-center justify-center font-semibold text-sm font-mono">
                {(user?.username || user?.email || "?").charAt(0).toUpperCase()}
              </span>
              <span className="hidden sm:inline font-mono text-sm">{user?.username || user?.email}</span>
              <ChevronDown size={15} className={`transition-transform ${menuOpen ? "rotate-180" : ""}`} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-line rounded-xl shadow-soft py-1.5 animate-fade-up">
                <button
                  onClick={() => { setMenuOpen(false); navigate("/app/profile"); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink hover:bg-paper transition-colors"
                >
                  <UserRound size={15} /> Profile
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-rust hover:bg-rust-soft transition-colors"
                >
                  <LogOut size={15} /> Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile bottom tab bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-line flex justify-around py-2">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1 text-xs font-medium ${isActive ? "text-ink" : "text-muted"}`
            }
          >
            <tab.icon size={18} />
            {tab.label.split(" ")[0]}
          </NavLink>
        ))}
      </div>

      <main className="max-w-[1180px] mx-auto px-7 py-8">
        <Outlet />
      </main>
    </div>
  );
}
