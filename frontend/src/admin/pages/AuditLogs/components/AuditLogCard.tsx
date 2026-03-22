import type { AuditLog } from "../auditLogs.types";
import { AuditActionIcon, formatAuditDate, iconTone, levelLabel, levelTone, statusLabel, statusTone } from "../auditLogs.utils";

interface AuditLogCardProps {
  log: AuditLog;
  onOpen: (log: AuditLog) => void;
}

export function AuditLogCard({ log, onOpen }: AuditLogCardProps) {
  const timestamp = formatAuditDate(log.timestamp);

  return (
    <button
      type="button"
      onClick={() => onOpen(log)}
      className="grid w-full gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_28px_rgba(15,23,42,0.07)] lg:grid-cols-[56px_1fr_auto]"
    >
      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${iconTone(log.status, log.level)}`}>
        <AuditActionIcon action={log.action} className="h-5 w-5" />
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-950">{log.action.replace(/_/g, " ")}</h3>
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusTone(log.status)}`}>
            {statusLabel(log.status)}
          </span>
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${levelTone(log.level)}`}>
            {levelLabel(log.level)}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
          <span className="font-medium text-slate-800">{log.user}</span>
          <span className="text-slate-300">|</span>
          <span className="truncate">{log.resource}</span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          <span>{timestamp.shortDate}</span>
          <span>{timestamp.shortTime}</span>
          <span>IP {log.ip}</span>
        </div>

        <div className="mt-3 inline-flex max-w-full rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
          <span className="truncate">{log.details.message}</span>
        </div>
      </div>

      <div className="flex items-start justify-end">
        <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700">
          Details
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </span>
      </div>
    </button>
  );
}

