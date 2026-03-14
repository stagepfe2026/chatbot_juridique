export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText = "Confirmer",
  cancelText = "Annuler",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="jb-modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="jb-modal">
        <div className="jb-alert">
          <div className="jb-alert-title">{title}</div>
          <div className="jb-alert-msg">{message}</div>
          <div className="jb-alert-actions">
            <button type="button" className="jb-btn jb-btn--ghost" onClick={onCancel}>
              {cancelText}
            </button>
            <button type="button" className="jb-btn jb-btn--danger" onClick={onConfirm}>
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
