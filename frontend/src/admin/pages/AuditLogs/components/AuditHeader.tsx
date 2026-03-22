import type { AuditExportFormat } from "../auditLogs.types";

interface AuditHeaderProps {
  totalLogs: number;
  onRefresh: () => void;
  onExport: () => void;
  selectedExportFormat?: AuditExportFormat | null;
}

function ToolbarIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export function AuditHeader({ totalLogs, onRefresh, onExport }: AuditHeaderProps) {
  return (
    <section className="rounded-2xl border border-white/70 bg-white/90 px-5 py-4 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Journal des activites</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-right">
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Volume</div>
            <div className="text-base font-semibold text-slate-900">{totalLogs} actions</div>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            <ToolbarIcon>
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </ToolbarIcon>
            Actualiser
          </button>

          <button
            type="button"
            onClick={onExport}
            className="inline-flex items-center gap-2 rounded-xl border border-red-700 bg-red-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-800"
          >
            <ToolbarIcon>
              <path d="M12 3v12" />
              <path d="M7 10l5 5 5-5" />
              <path d="M5 21h14" />
            </ToolbarIcon>
            Exporter
          </button>
        </div>
      </div>
    </section>
  );
}
