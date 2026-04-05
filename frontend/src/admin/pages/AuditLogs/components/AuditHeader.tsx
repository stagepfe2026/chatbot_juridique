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

export function AuditHeader({ onRefresh, onExport }: AuditHeaderProps) {
  return (
    <section>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="mt-1 py-3 text-2xl font-bold tracking-tight text-red-700 capitalize">Journal des activites</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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


