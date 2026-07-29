import { useEffect, useRef, useState } from "react";
import { FileUp, Loader2, Sparkles } from "lucide-react";
import { api } from "../../lib/api";
import { useToast } from "../../context/ToastContext";

export default function NewApplication() {
  const [jobLink, setJobLink] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [resumeNote, setResumeNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [result, setResult] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const fileInputRef = useRef(null);
  const toast = useToast();

  useEffect(() => {
    api
      .get("/api/resume")
      .then((saved) => {
        if (saved.resume_text) {
          setResumeText(saved.resume_text);
          setResumeNote(
            `Using saved resume: ${saved.filename || "pasted text"} (uploaded ${new Date(saved.updated_at).toLocaleDateString()}).`,
          );
        }
      })
      .catch(() => { });
  }, []);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const data = await api.postForm("/api/resume/upload", formData);
      setResumeText(data.resume_text);
      setResumeNote("");
      toast.success(`"${data.filename}" saved — it'll be here next time too.`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleAnalyze = async () => {
    const errors = {};
    if (!jobDescription.trim()) errors.jobDescription = true;
    if (!resumeText.trim()) errors.resumeText = true;
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      toast.error("Job description and resume are both required.");
      return;
    }
    setFieldErrors({});
    setAnalyzing(true);
    try {
      const data = await api.post("/api/analyze", {
        job_description: jobDescription,
        resume_text: resumeText,
        job_link: jobLink,
      });
      setResult(data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleTrack = async () => {
    if (!result) return;
    setTracking(true);
    try {
      await api.post("/api/applications", {
        company: result.company,
        job_title: result.job_title,
        job_link: result.job_link,
        job_description: jobDescription,
        resume_text: resumeText,
        skills: result.skills,
        match_score: result.match_score,
        suggestions: result.suggestions,
        applied_date: new Date().toISOString().slice(0, 10),
        status: "Applied",
      });
      toast.success(`Tracking your application to ${result.company}.`);
      setJobLink("");
      setJobDescription("");
      setResult(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setTracking(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-500";
    if (score >= 40) return "text-orange-500";
    return "text-red-500";
  };

  return (
    <div className="">
      <div className="bg-white border border-line rounded-xl p-6">
        <h2 className="font-display font-bold text-lg mb-1">
          Paste a job + your resume
        </h2>
        <p className="text-sm text-muted mb-5">
          Trackr will extract the company and role, score your resume against
          it, and suggest improvements.
        </p>

        <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1.5 mt-1">
          Job link{" "}
          <span className="normal-case font-normal text-muted/70">
            (optional)
          </span>
        </label>
        <input
          type="text"
          value={jobLink}
          onChange={(e) => setJobLink(e.target.value)}
          placeholder="https://company.com/careers/role"
          className="w-full px-3.5 py-2.5 border border-line rounded-lg text-sm bg-[#FBFCFD] focus:outline-none focus:ring-2 focus:ring-ink"
        />

        <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1.5 mt-4">
          Job description <span className="text-rust">*</span>
        </label>
        <textarea
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          placeholder="Paste the full job description text here..."
          className={`w-full min-h-[110px] px-3.5 py-2.5 border rounded-lg text-sm bg-[#FBFCFD] focus:outline-none focus:ring-2 focus:ring-ink ${fieldErrors.jobDescription ? "border-rust" : "border-line"
            }`}
        />

        <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1.5 mt-4">
          Your resume <span className="text-rust">*</span>
        </label>
        <div className="flex items-center gap-3 mb-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 border border-line rounded-lg px-3.5 py-2 text-sm font-medium text-ink hover:border-ink transition-colors disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <FileUp size={15} />
            )}
            Upload PDF resume
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleUpload}
          />
        </div>
        <textarea
          value={resumeText}
          onChange={(e) => setResumeText(e.target.value)}
          placeholder="Upload a PDF above, or paste your resume text here..."
          className={`w-full min-h-[110px] px-3.5 py-2.5 border rounded-lg text-sm font-mono bg-[#FBFCFD] focus:outline-none focus:ring-2 focus:ring-ink ${fieldErrors.resumeText ? "border-rust" : "border-line"
            }`}
        />
        {resumeNote && (
          <p className="text-xs text-muted mt-1.5">{resumeNote}</p>
        )}

        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="mt-5 flex items-center gap-2 rounded-lg bg-amber text-[#241505] font-semibold text-sm px-5 py-2.5 hover:bg-amber-deep hover:text-white transition-colors disabled:opacity-60"
        >
          {analyzing ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Sparkles size={16} />
          )}
          {analyzing ? "Analyzing…" : "Analyze with AI"}
        </button>

        {result && (
          <div className="mt-6 pt-6 border-t border-line animate-fade-up">
            <div className="flex items-baseline gap-2 mb-1">
              <strong className="text-base">
                {result.company || "Unknown company"}
              </strong>
              {result.job_title && (
                <span className="text-muted text-sm">{result.job_title}</span>
              )}
            </div>
            <div className="flex items-baseline gap-2 font-mono text-2xl font-semibold text-ink">
              <span className={getScoreColor(result.match_score ?? 0)}>{result.match_score ?? 0}%</span>
              <span className="text-xs text-muted font-body font-normal">
                resume match
              </span>
            </div>
            {result.skills?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {result.skills.map((s) => (
                  <span
                    key={s}
                    className="bg-slate-soft text-slate px-2.5 py-1 rounded-full text-xs font-medium"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
            {result.suggestions?.length > 0 && (
              <ul className="list-disc pl-5 mt-3 text-sm text-[#3a3d43] space-y-1.5">
                {result.suggestions.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            )}
            <button
              onClick={handleTrack}
              disabled={tracking}
              className="mt-4 rounded-lg bg-slate-soft text-slate font-semibold text-sm px-5 py-2.5 hover:bg-[#d3deeb] transition-colors disabled:opacity-60"
            >
              {tracking ? "Tracking…" : "Track this application"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
