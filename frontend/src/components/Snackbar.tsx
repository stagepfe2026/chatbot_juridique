import { useEffect } from "react";

export type SnackbarVariant = "success" | "error" | "info";

export interface SnackbarProps {
  open: boolean;
  message: string;
  variant?: SnackbarVariant;
  durationMs?: number;
  onClose: () => void;
}

const variants: Record<SnackbarVariant, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-red-200 bg-red-50 text-red-700",
  info: "border-sky-200 bg-sky-50 text-sky-800",
};

export default function Snackbar({ open, message, variant = "info", durationMs = 3800, onClose }: SnackbarProps) {
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(onClose, durationMs);
    return () => window.clearTimeout(id);
  }, [open, durationMs, onClose]);

  if (!open) return null;

  return (
    <div className={`fixed bottom-5 right-5 z-[90] flex min-w-[280px] max-w-md items-center gap-3 rounded-2xl border px-4 py-3 shadow-[0_18px_36px_rgba(15,23,42,0.18)] ${variants[variant]}`} role="status" aria-live="polite">
      <div className="flex-1 text-sm font-semibold">{message}</div>
      <button type="button" className="grid h-8 w-8 place-items-center rounded-xl border border-current/10 bg-white/60 text-lg leading-none" onClick={onClose} aria-label="Fermer">
        ×
      </button>
    </div>
  );
}
