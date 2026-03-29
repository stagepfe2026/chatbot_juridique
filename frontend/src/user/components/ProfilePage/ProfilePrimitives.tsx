import type { ReactNode } from "react";
import type { LoginHistoryEntry } from "../../../models/auth.models";

function formatDateTime(value: string | null | undefined, locale: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      {children}
    </svg>
  );
}

export function ModalShell({ open, title, description, onClose, children }: { open: boolean; title: string; description: string; onClose: () => void; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" className="relative z-10 max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.25)]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-[18px] font-semibold text-slate-950">{title}</h2>
            <p className="mt-1 text-[13px] text-slate-500">{description}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-slate-200 px-3 py-1 text-[12px] font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-700">Fermer</button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><div className="mb-2 text-[13px] font-medium text-slate-700">{label}</div>{children}</label>;
}

export function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block">
      <div className="mb-2 text-[13px] font-medium text-slate-700">{label}</div>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] text-slate-800 outline-none transition focus:border-red-300" />
    </label>
  );
}

export function InfoGlyph({ icon }: { icon: "mail" | "phone" | "pin" | "calendar" | "building" | "briefcase" | "user" }) {
  if (icon === "mail") return <Icon><path d="M4 6h16v12H4z" /><path d="m4 8 8 6 8-6" /></Icon>;
  if (icon === "phone") return <Icon><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.5 3a2 2 0 0 1-.6 1.8l-1.3 1.3a16 16 0 0 0 6.4 6.4l1.3-1.3a2 2 0 0 1 1.8-.6l3 .5A2 2 0 0 1 22 16.9Z" /></Icon>;
  if (icon === "pin") return <Icon><path d="M12 21s6-4.35 6-10a6 6 0 1 0-12 0c0 5.65 6 10 6 10Z" /><circle cx="12" cy="11" r="2.5" /></Icon>;
  if (icon === "calendar") return <Icon><path d="M7 2v4" /><path d="M17 2v4" /><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 10h18" /></Icon>;
  if (icon === "building") return <Icon><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h.01" /><path d="M12 7h.01" /><path d="M16 7h.01" /><path d="M8 11h.01" /><path d="M12 11h.01" /><path d="M16 11h.01" /><path d="M10 21v-4h4v4" /></Icon>;
  if (icon === "briefcase") return <Icon><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></Icon>;
  return <Icon><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></Icon>;
}

export function InfoItem({ icon, label, value }: { icon: "mail" | "phone" | "pin" | "calendar" | "building" | "briefcase" | "user"; label: string; value: string }) {
  return <div><div className="flex items-center gap-2 text-[13px] text-slate-500"><span className="text-slate-400"><InfoGlyph icon={icon} /></span><span>{label}</span></div><div className="mt-1.5 text-[14px] font-medium text-slate-900">{value}</div></div>;
}

export function ActivityRow({ color, label, value }: { color: "blue" | "green" | "orange"; label: string; value: string }) {
  const accent = color === "blue" ? "bg-blue-50 text-blue-600" : color === "green" ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-orange-600";
  return <div className="flex items-center justify-between border-b border-slate-100 pb-4 last:border-b-0 last:pb-0"><div className="flex items-center gap-3"><div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${accent}`}><Icon><rect x="6" y="4" width="12" height="16" rx="2" /><path d="M9 8h6" /><path d="M9 12h6" /></Icon></div><span className="text-[14px] text-slate-800">{label}</span></div><span className="text-[16px] font-semibold text-slate-950">{value}</span></div>;
}

export function ToggleRow({ label, helper, checked, onChange }: { label: string; helper: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <div className="flex items-center justify-between gap-3 py-1"><div><div className="text-[14px] font-medium text-slate-900">{label}</div><div className="text-[12px] text-slate-500">{helper}</div></div><button type="button" onClick={() => onChange(!checked)} className={`relative h-7 w-11 rounded-full transition ${checked ? "bg-slate-950" : "bg-slate-200"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${checked ? "left-5" : "left-1"}`} /></button></div>;
}

export function InfoStack({ label, value }: { label: string; value: string }) {
  return <div className="border-t border-slate-100 pt-5 first:border-t-0 first:pt-0"><div className="text-[13px] text-slate-500">{label}</div><div className="mt-1.5 text-[14px] font-semibold text-slate-950">{value}</div></div>;
}

export function StatusBadge({ tone }: { tone: "success" | "danger" }) {
  const classes = tone === "success" ? "text-emerald-500" : "text-red-500";
  return <span className={`inline-flex items-center ${classes}`} aria-hidden="true"><svg viewBox="0 0 16 16" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{tone === "success" ? <path d="m3.5 8 3 3 6-6" /> : <path d="M5 5l6 6M11 5l-6 6" />}</svg></span>;
}

export function SessionRow({ entry, locale }: { entry: LoginHistoryEntry; locale: string }) {
  const danger = entry.isSuspicious;
  return <div className={`flex items-center justify-between rounded-2xl border px-5 py-4 ${danger ? "border-red-100 bg-red-50/70" : "border-slate-100 bg-white"}`}><div className="flex items-center gap-4"><div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${danger ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-500"}`}><Icon><rect x="5" y="6" width="14" height="10" rx="2" /><path d="M8 20h8" /></Icon></div><div><div className="flex items-center gap-2 text-[14px] font-semibold text-slate-950"><span>{entry.device}</span>{entry.isCurrent ? <StatusBadge tone="success" /> : null}{entry.isSuspicious ? <StatusBadge tone="danger" /> : null}</div><div className="mt-1 text-[13px] text-slate-500">{entry.browser} • {entry.location}</div></div></div><div className="text-right text-[13px] text-slate-500">{formatDateTime(entry.lastSeenAt, locale)}</div></div>;
}
