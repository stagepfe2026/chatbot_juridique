import { useEffect } from "react";

export type SnackbarVariant = "success" | "error" | "info";

export interface SnackbarProps {
  open: boolean;
  message: string;
  variant?: SnackbarVariant;
  durationMs?: number;
  onClose: () => void;
}

export default function Snackbar({ open, message, variant = "info", durationMs = 3800, onClose }: SnackbarProps) {
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(onClose, durationMs);
    return () => window.clearTimeout(id);
  }, [open, durationMs, onClose]);

  if (!open) return null;

  return (
    <div className={`jb-snackbar jb-snackbar--${variant}`} role="status" aria-live="polite">
      <div className="jb-snackbar-msg">{message}</div>
      <button type="button" className="jb-snackbar-close" onClick={onClose} aria-label="Fermer">
        ?
      </button>
    </div>
  );
}
