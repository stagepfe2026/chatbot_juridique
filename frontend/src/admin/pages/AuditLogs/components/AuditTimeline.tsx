import type { AuditLog } from "../auditLogs.types";
import { AuditActionIcon, formatAuditDate, iconTone, statusLabel } from "../auditLogs.utils";

interface AuditTimelineProps {
  logs: AuditLog[];
}

export function AuditTimeline({ logs }: AuditTimelineProps) {
  return (
    <section className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-sm">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-900">Activite recente</h2>
        <p className="text-xs text-slate-500">Derniers evenements surveilles</p>
      </div>

      <div className="relative pl-3">
        <div className="absolute bottom-3 left-[18px] top-3 w-px bg-slate-200" aria-hidden="true" />
        <div className="space-y-4">
          {logs.map((log) => {
            const time = formatAuditDate(log.timestamp);
            return (
              <div key={log.id} className="relative flex gap-3">
                <div className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-xl border ${iconTone(log.status, log.level)}`}>
                  <AuditActionIcon action={log.action} className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1 pb-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-900">{log.action.replace(/_/g, " ")}</span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                      {statusLabel(log.status)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                    <span>{time.shortTime}</span>
                    <span>{log.user}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

