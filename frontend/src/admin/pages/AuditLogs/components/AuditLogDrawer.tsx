import type { AuditLog } from "../auditLogs.types";
import { AuditActionIcon, formatAuditDate, iconTone, levelLabel, statusLabel } from "../auditLogs.utils";

interface AuditLogDrawerProps {
  log: AuditLog | null;
  open: boolean;
  onClose: () => void;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="max-w-[60%] text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}

export function AuditLogDrawer({ log, open, onClose }: AuditLogDrawerProps) {
  if (!open || !log) return null;

  const timestamp = formatAuditDate(log.timestamp);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[1px]" onClick={onClose} aria-hidden="true" />

      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col border-l border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.16)]">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-red-600">Inspection</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Details du log</h2>
            <p className="mt-1 text-sm text-slate-500">Consultation sans perte de contexte</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
            aria-label="Fermer le panneau"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6L6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <section className={`rounded-2xl border p-4 ${iconTone(log.status, log.level)}`}>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-current/10 bg-white/60">
                <AuditActionIcon action={log.action} className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold uppercase tracking-wide">{log.action.replace(/_/g, " ")}</div>
                <div className="mt-1 text-sm">
                  {statusLabel(log.status)} | Niveau {levelLabel(log.level)}
                </div>
              </div>
            </div>
          </section>

          <Section title="Utilisateur">
            <Row label="Identifiant" value={log.user} />
            <Row label="Adresse IP" value={log.ip} />
            {log.details.userAgent ? <Row label="Navigateur" value={log.details.userAgent} /> : null}
          </Section>

          <Section title="Evenement">
            <Row label="Ressource" value={log.resource} />
            <Row label="Date complete" value={timestamp.full} />
            {log.details.endpoint ? (
              <Row
                label="Endpoint API"
                value={<span className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-mono text-xs">{log.details.endpoint}</span>}
              />
            ) : null}
          </Section>

          <Section title="Payload JSON">
            <pre className="overflow-x-auto rounded-2xl bg-slate-950 px-4 py-4 text-xs leading-6 text-emerald-300">
              {JSON.stringify(
                {
                  action: log.action,
                  status: log.status,
                  level: log.level,
                  details: log.details,
                },
                null,
                2,
              )}
            </pre>
          </Section>

          <Section title="Resume d'analyse">
            <p className="text-sm leading-6 text-slate-700">{log.details.message}</p>
            {log.level === "CRITICAL" ? (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                Cet evenement doit etre verifie par l'equipe d'administration.
              </div>
            ) : null}
          </Section>
        </div>
      </aside>
    </>
  );
}

