import type { AuditExportFormat } from "../auditLogs.types";

interface AuditExportDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (format: AuditExportFormat) => void;
}

const formats: { id: AuditExportFormat; title: string; description: string; badge: string }[] = [
  {
    id: "pdf",
    title: "PDF",
    description: "Format officiel, lisible et archivable pour diffusion institutionnelle.",
    badge: "Obligatoire",
  },
  {
    id: "excel",
    title: "Excel",
    description: "Ideal pour l'analyse, le tri, les filtres et le partage operationnel.",
    badge: "Analyse",
  },
  {
    id: "json",
    title: "JSON",
    description: "Format technique pour integration, debug et traitements avances.",
    badge: "Technique",
  },
];

export function AuditExportDialog({ open, onClose, onSelect }: AuditExportDialogProps) {
  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[1px]" onClick={onClose} aria-hidden="true" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.16)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-red-600">Export d'audit</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Choisir un format d'export</h2>
              <p className="mt-1 text-sm text-slate-500">Selectionnez le type de document a telecharger pour le journal d'activite.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
              aria-label="Fermer"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 6L6 18" />
                <path d="M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {formats.map((format) => (
              <button
                key={format.id}
                type="button"
                onClick={() => onSelect(format.id)}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-red-200 hover:bg-red-50/40"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-lg font-bold text-slate-950">{format.title}</div>
                  <span className="rounded-full border border-red-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-600">
                    {format.badge}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{format.description}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
