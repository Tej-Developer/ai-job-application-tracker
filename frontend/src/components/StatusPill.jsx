const STYLES = {
  Applied: "bg-slate-soft text-slate",
  Interview: "bg-amber-soft text-amber-deep",
  Offer: "bg-green-soft text-green",
  Rejected: "bg-rust-soft text-rust",
};

export default function StatusPill({ status }) {
  return (
    <span
      className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold font-mono tracking-wide ${
        STYLES[status] || "bg-slate-soft text-slate"
      }`}
    >
      {status}
    </span>
  );
}
