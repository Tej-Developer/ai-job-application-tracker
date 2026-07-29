import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Percent,
  FileText,
  BellRing,
  Sigma,
  Search,
  ListChecks,
  Download,
  Lock,
  Pencil,
} from "lucide-react";

const BOARD_ROWS = [
  { company: "Acme Corp", role: "Backend Engineer", score: "87%", status: "ON TIME", tone: "slate" },
  { company: "Globex", role: "Data Analyst", score: "64%", status: "BOARDING", tone: "amber" },
  { company: "Initech", role: "PM Intern", score: "—", status: "CANCELLED", tone: "rust" },
  { company: "Umbrella Corp", role: "ML Engineer", score: "92%", status: "ARRIVED", tone: "green" },
];

const STATUS_STYLES = {
  slate: "bg-slate/20 text-[#9FB6D6]",
  amber: "bg-amber/20 text-amber",
  green: "bg-green/20 text-[#6FCB9A]",
  rust: "bg-rust/20 text-[#E29387]",
};

const STEPS = [
  { n: "01", title: "Paste the job", desc: "Drop in the job description and your resume (or use the one already saved to your account)." },
  { n: "02", title: "AI extracts & scores", desc: "Groq reads the listing, pulls out the company, role, and required skills, and scores your resume against it." },
  { n: "03", title: "Get suggestions", desc: "Trackr suggests specific, actionable edits to improve your match before you apply." },
  { n: "04", title: "Track it", desc: "Save the application with applied, interview, and follow-up dates — searchable anytime." },
  { n: "05", title: "Get reminded", desc: "Trackr emails you when a follow-up is due, plus a weekly digest of where things stand." },
];

const FEATURES = [
  { icon: Percent, title: "AI match score & suggestions", desc: "See how well your resume fits each job, and what to change to fit it better." },
  { icon: FileText, title: "Upload your resume once", desc: "Upload a PDF and Trackr saves it to your account — no re-uploading for every job." },
  { icon: BellRing, title: "Automatic follow-up emails", desc: "When a follow-up date arrives, Trackr emails you — you don't have to remember to check." },
  { icon: Sigma, title: "Weekly digest", desc: "Every Monday, get a summary: total applications, average match score, and interviews ahead." },
  { icon: Search, title: "Search & filter", desc: "Find any application instantly by company, role, or status — even past 100 entries." },
  { icon: ListChecks, title: "Notes timeline", desc: "Log recruiter calls, interview rounds, and status changes as they happen, in order." },
  { icon: Download, title: "Export anytime", desc: "Download your full pipeline as a CSV — opens directly in Excel or Google Sheets." },
  { icon: Lock, title: "Private to your account", desc: "Every resume, application, and note is scoped to your login — nobody else can see it." },
  { icon: Pencil, title: "Edit anytime", desc: "Update the job description or resume snapshot on any tracked application after the fact." },
];

function Logo() {
  return (
    <span className="font-display font-bold text-xl tracking-tight">
      Trackr<span className="text-amber-deep">.</span>
    </span>
  );
}

function BtnPrimary({ children, to, className = "" }) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center justify-center gap-2 rounded-lg bg-ink text-white font-semibold text-sm px-5 py-3 transition-all hover:bg-[#0d1826] hover:-translate-y-0.5 hover:shadow-soft ${className}`}
    >
      {children}
    </Link>
  );
}

function BtnAmber({ children, to, className = "" }) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center justify-center gap-2 rounded-lg bg-amber text-[#241505] font-semibold text-sm px-5 py-3 transition-all hover:bg-amber-deep hover:text-white hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(201,127,30,0.35)] ${className}`}
    >
      {children}
    </Link>
  );
}

function BtnGhost({ children, to, className = "" }) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border border-line text-ink font-semibold text-sm px-5 py-3 transition-colors hover:border-ink ${className}`}
    >
      {children}
    </Link>
  );
}

export default function Landing() {
  const [clock, setClock] = useState("");

  useEffect(() => {
    const update = () => setClock(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-paper">
      {/* ---------------- Nav ---------------- */}
      <nav className="sticky top-0 z-50 bg-paper/85 backdrop-blur border-b border-line">
        <div className="max-w-[1120px] mx-auto px-7 py-4 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-7 text-sm text-muted">
            <a href="#how-it-works" className="hidden sm:inline hover:text-ink transition-colors">How it works</a>
            <a href="#features" className="hidden sm:inline hover:text-ink transition-colors">Features</a>
            <div className="flex items-center gap-2.5">
              <BtnGhost to="/login" className="px-4 py-2 text-sm">Log in</BtnGhost>
              <BtnPrimary to="/register" className="px-4 py-2 text-sm">Get started</BtnPrimary>
            </div>
          </div>
        </div>
      </nav>

      {/* ---------------- Hero ---------------- */}
      <section className="max-w-[1120px] mx-auto px-7 pt-16 md:pt-24 pb-10 grid md:grid-cols-2 gap-11 items-center">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs font-semibold tracking-widest uppercase text-amber-deep">
            <span className="w-[18px] h-[2px] bg-amber-deep inline-block" />
            AI job application tracker
          </div>
          <h1 className="font-display font-bold text-[2.4rem] sm:text-[3.1rem] md:text-[3.6rem] leading-[1.04] tracking-tight mt-4 mb-4 max-w-[16ch]">
            Track every application like a flight board.
          </h1>
          <p className="text-lg text-muted leading-relaxed max-w-[46ch] mb-7">
            Paste a job, get an AI match score against your resume, and let Trackr tell you exactly when to follow up. Built for students applying to 100+ companies at once.
          </p>
          <div className="flex flex-wrap items-center gap-3.5 mb-3">
            <BtnAmber to="/register">Get started free</BtnAmber>
            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-line text-ink font-semibold text-sm px-5 py-3 transition-colors hover:border-ink"
            >
              See how it works
            </a>
          </div>
          <p className="text-sm text-muted mt-3">No credit card. Your data is private to your account.</p>
        </div>

        {/* Signature element: the departure board */}
        <div className="bg-board rounded-2xl p-5 pb-6 shadow-board relative overflow-hidden">
          <div className="flex justify-between font-mono text-xs tracking-widest uppercase text-[#8CA0B3] pb-3.5 border-b border-white/10 mb-1.5">
            <span>Your applications</span>
            <span>{clock}</span>
          </div>
          <div className="grid grid-cols-[2.1fr_2.4fr_0.8fr_1.2fr] gap-2.5 font-mono text-[0.68rem] tracking-wider uppercase text-[#6C8199] pt-1 pb-2 px-1.5">
            <span>Company</span><span>Role</span><span>Match</span><span>Status</span>
          </div>
          {BOARD_ROWS.map((row, i) => (
            <div
              key={row.company}
              className="grid grid-cols-[2.1fr_2.4fr_0.8fr_1.2fr] gap-2.5 items-center py-3 px-1.5 font-mono text-sm border-b border-white/5 last:border-none opacity-0 animate-flip-in origin-top"
              style={{ animationDelay: `${0.05 + i * 0.13}s` }}
            >
              <span className="font-semibold text-white truncate">{row.company}</span>
              <span className="text-[#B7C4D1] truncate">{row.role}</span>
              <span className={row.score === "—" ? "text-[#5E7186]" : "text-amber font-semibold"}>{row.score}</span>
              <span className={`inline-flex w-fit px-2.5 py-1 rounded-full text-[0.68rem] font-semibold tracking-wide ${STATUS_STYLES[row.tone]}`}>
                {row.status}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- Problem ---------------- */}
      <section className="bg-white border-y border-line py-16">
        <div className="max-w-[1120px] mx-auto px-7 grid md:grid-cols-3 gap-8">
          <div>
            <span className="font-mono text-rust font-semibold text-sm block mb-2.5">01</span>
            <h3 className="font-semibold text-lg mb-2">Applications blur together</h3>
            <p className="text-muted text-sm leading-relaxed">After the 40th company, spreadsheets stop getting updated and applications quietly disappear.</p>
          </div>
          <div>
            <span className="font-mono text-rust font-semibold text-sm block mb-2.5">02</span>
            <h3 className="font-semibold text-lg mb-2">Follow-ups get missed</h3>
            <p className="text-muted text-sm leading-relaxed">The window to check in with a recruiter is short — and easy to miss without a reminder.</p>
          </div>
          <div>
            <span className="font-mono text-rust font-semibold text-sm block mb-2.5">03</span>
            <h3 className="font-semibold text-lg mb-2">Resumes go out untailored</h3>
            <p className="text-muted text-sm leading-relaxed">The same resume gets sent everywhere, instead of adjusted for what each job is actually asking for.</p>
          </div>
        </div>
      </section>

      {/* ---------------- How it works ---------------- */}
      <section id="how-it-works" className="py-20">
        <div className="max-w-[1120px] mx-auto px-7">
          <div className="max-w-[640px] mb-11">
            <div className="font-mono text-xs font-semibold tracking-widest uppercase text-amber-deep mb-3.5 flex items-center gap-2">
              <span className="w-[18px] h-[2px] bg-amber-deep inline-block" />How it works
            </div>
            <h2 className="font-display font-bold text-3xl md:text-4xl tracking-tight mb-3">From job link to tracked application in one pass.</h2>
            <p className="text-muted">Every step below runs automatically once you paste a job — no spreadsheet required.</p>
          </div>
          <div className="grid md:grid-cols-5 gap-8 md:gap-0">
            {STEPS.map((step, i) => (
              <div key={step.n} className="relative pr-4">
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-[17px] left-[calc(100%-10px)] w-full h-px bg-line" />
                )}
                <div className="font-mono font-semibold text-xs text-white bg-ink w-[34px] h-[34px] rounded-full flex items-center justify-center mb-4">
                  {step.n}
                </div>
                <h3 className="font-semibold mb-2">{step.title}</h3>
                <p className="text-muted text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Features ---------------- */}
      <section id="features" className="py-20">
        <div className="max-w-[1120px] mx-auto px-7">
          <div className="max-w-[640px] mb-11">
            <div className="font-mono text-xs font-semibold tracking-widest uppercase text-amber-deep mb-3.5 flex items-center gap-2">
              <span className="w-[18px] h-[2px] bg-amber-deep inline-block" />Everything in one place
            </div>
            <h2 className="font-display font-bold text-3xl md:text-4xl tracking-tight">Built for the parts of a job search that fall through the cracks.</h2>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-5">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="bg-white border border-line rounded-xl p-6 transition-all hover:-translate-y-1 hover:shadow-soft hover:border-[#c7cfd6]"
              >
                <div className="w-10 h-10 rounded-lg bg-ink text-amber flex items-center justify-center mb-4">
                  <Icon size={18} />
                </div>
                <h3 className="font-semibold mb-2">{title}</h3>
                <p className="text-muted text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Final CTA ---------------- */}
      <div className="max-w-[1120px] mx-auto px-7 pb-20">
        <div className="bg-board text-white rounded-[20px] p-11 md:p-14 text-center relative overflow-hidden">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(600px 240px at 50% 0%, rgba(232,162,61,0.18), transparent 70%)" }}
          />
          <h2 className="font-display font-bold text-2xl md:text-3xl mb-3.5 relative">Stop losing track of your applications.</h2>
          <p className="text-[#B7C4D1] mb-7 relative">It takes less time to set up than it does to update one spreadsheet row.</p>
          <div className="relative">
            <BtnAmber to="/register">Get started free</BtnAmber>
          </div>
        </div>
      </div>

      <footer className="max-w-[1120px] mx-auto px-7 py-8 flex flex-wrap justify-between items-center gap-3 text-sm text-muted">
        <Logo />
        <div>© 2026 Trackr. Built with Flask, Groq, and React.</div>
      </footer>
    </div>
  );
}
