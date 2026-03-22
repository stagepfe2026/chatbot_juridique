import type { AuditLog, AuditLogLevel, AuditLogStatus } from "./auditLogs.types";

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatAuditDate(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return { full: timestamp, shortDate: timestamp, shortTime: "" };
  }

  return {
    full: new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "long",
      timeStyle: "medium",
    }).format(date),
    shortDate: new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date),
    shortTime: new Intl.DateTimeFormat("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(date),
  };
}

export function statusLabel(status: AuditLogStatus) {
  if (status === "SUCCESS") return "Succes";
  if (status === "FAILED") return "Echec";
  return "Surveillance";
}

export function levelLabel(level: AuditLogLevel) {
  return level === "CRITICAL" ? "Critique" : "Info";
}

export function statusTone(status: AuditLogStatus) {
  if (status === "SUCCESS") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "FAILED") return "border-red-200 bg-red-50 text-red-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

export function levelTone(level: AuditLogLevel) {
  return level === "CRITICAL"
    ? "border-red-200 bg-red-50 text-red-700"
    : "border-slate-200 bg-slate-100 text-slate-600";
}

export function iconTone(status: AuditLogStatus, level: AuditLogLevel) {
  if (level === "CRITICAL") return "border-red-200 bg-red-50 text-red-600";
  if (status === "FAILED") return "border-red-200 bg-red-50 text-red-600";
  if (status === "WARNING") return "border-amber-200 bg-amber-50 text-amber-600";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export function buildActivitySeries(logs: AuditLog[]) {
  const dates = logs
    .map((log) => new Date(log.timestamp))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  const latest = dates.length > 0 ? dates[dates.length - 1] : new Date();
  const grouped = logs.reduce<Record<string, number>>((acc, log) => {
    const date = new Date(log.timestamp);
    if (Number.isNaN(date.getTime())) return acc;
    const key = toLocalDateKey(date);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(latest);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    const key = toLocalDateKey(date);

    return {
      label: new Intl.DateTimeFormat("fr-FR", {
        day: "numeric",
        month: "short",
      }).format(date),
      value: grouped[key] ?? 0,
    };
  });
}

function iconPaths(action: string) {
  switch (action) {
    case "LOGIN":
      return (
        <>
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
          <path d="M10 17l5-5-5-5" />
          <path d="M15 12H3" />
        </>
      );
    case "FAILED_LOGIN":
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M9 9l6 6" />
          <path d="M15 9l-6 6" />
        </>
      );
    case "LOGOUT":
      return (
        <>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="M16 17l5-5-5-5" />
          <path d="M21 12H9" />
        </>
      );
    case "DELETE_DOC":
      return (
        <>
          <path d="M3 6h18" />
          <path d="M8 6V4h8v2" />
          <path d="M6 6l1 14h10l1-14" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
        </>
      );
    case "UPLOAD":
      return (
        <>
          <path d="M12 16V4" />
          <path d="M7 9l5-5 5 5" />
          <path d="M5 20h14" />
        </>
      );
    case "DOWNLOAD_DOC":
      return (
        <>
          <path d="M12 4v12" />
          <path d="M7 11l5 5 5-5" />
          <path d="M5 20h14" />
        </>
      );
    case "PERMISSION_CHANGE":
    case "POLICY_UPDATE":
      return (
        <>
          <path d="M12 3l7 3v5c0 4.5-2.9 8.6-7 10-4.1-1.4-7-5.5-7-10V6l7-3z" />
        </>
      );
    case "UPDATE":
      return (
        <>
          <path d="M4 20h4l10-10-4-4L4 16v4z" />
          <path d="M13 7l4 4" />
        </>
      );
    default:
      return (
        <>
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <path d="M8 12h8" />
        </>
      );
  }
}

export function AuditActionIcon({
  action,
  className = "h-4 w-4",
}: {
  action: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {iconPaths(action)}
    </svg>
  );
}
