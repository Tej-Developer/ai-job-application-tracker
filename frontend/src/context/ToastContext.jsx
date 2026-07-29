import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";

const ToastContext = createContext(null);

let idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (message, type = "info", duration = 3500) => {
      const id = ++idCounter;
      setToasts((t) => [...t, { id, message, type }]);
      if (duration) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss]
  );

  const toast = {
    success: (msg, duration) => push(msg, "success", duration),
    error: (msg, duration) => push(msg, "error", duration),
    info: (msg, duration) => push(msg, "info", duration),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[min(360px,90vw)]">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-toast-in flex items-start gap-2.5 rounded-lg border px-4 py-3 shadow-soft text-sm font-medium
              ${t.type === "success" ? "bg-green-soft border-green/30 text-green" : ""}
              ${t.type === "error" ? "bg-rust-soft border-rust/30 text-rust" : ""}
              ${t.type === "info" ? "bg-white border-line text-ink" : ""}
            `}
          >
            {t.type === "success" && <CheckCircle2 size={18} className="shrink-0 mt-0.5" />}
            {t.type === "error" && <XCircle size={18} className="shrink-0 mt-0.5" />}
            {t.type === "info" && <Info size={18} className="shrink-0 mt-0.5" />}
            <span className="flex-1">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="shrink-0 opacity-60 hover:opacity-100">
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
