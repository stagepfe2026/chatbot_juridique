import type { AuditLogLevel, AuditLogStatus } from "../auditLogs.types";

interface AuditFiltersProps {
  search: string;
  user: string;
  action: string;
  status: AuditLogStatus | "";
  level: AuditLogLevel | "";
  date: string;
  users: string[];
  actions: string[];
  onSearchChange: (value: string) => void;
  onUserChange: (value: string) => void;
  onActionChange: (value: string) => void;
  onStatusChange: (value: AuditLogStatus | "") => void;
  onLevelChange: (value: AuditLogLevel | "") => void;
  onDateChange: (value: string) => void;
  onReset: () => void;
}

const fieldClassName =
  "h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-red-300 focus:ring-2 focus:ring-red-100";

export function AuditFilters({
  search,
  user,
  action,
  status,
  level,
  date,
  users,
  actions,
  onSearchChange,
  onUserChange,
  onActionChange,
  onStatusChange,
  onLevelChange,
  onDateChange,
  onReset,
}: AuditFiltersProps) {
  return (
    <section className="rounded-2xl border border-white/70 bg-white/50 p-4 shadow-lg">
      <div className="mb-3 flex items-center justify-between gap-3">
       
       
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <input
          className={`${fieldClassName} xl:col-span-2`}
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Recherche texte, ressource, IP..."
        />

        <select className={fieldClassName} value={user} onChange={(event) => onUserChange(event.target.value)}>
          <option value="">Tous les utilisateurs</option>
          {users.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </select>

        <select className={fieldClassName} value={action} onChange={(event) => onActionChange(event.target.value)}>
          <option value="">Tous les types</option>
          {actions.map((entry) => (
            <option key={entry} value={entry}>
              {entry.replace(/_/g, " ")}
            </option>
          ))}
        </select>

        <select className={fieldClassName} value={status} onChange={(event) => onStatusChange(event.target.value as AuditLogStatus | "")}>
          <option value="">Tous les statuts</option>
          <option value="SUCCESS">Succes</option>
          <option value="FAILED">Echec</option>
          <option value="WARNING">Surveillance</option>
        </select>

        <select className={fieldClassName} value={level} onChange={(event) => onLevelChange(event.target.value as AuditLogLevel | "")}>
          <option value="">Tous les niveaux</option>
          <option value="INFO">Info</option>
          <option value="CRITICAL">Critique</option>
        </select>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-[220px_auto]">
        <input
          className={fieldClassName}
          type="date"
          value={date}
          onChange={(event) => onDateChange(event.target.value)}
        />
     
      </div>
      
    </section>
  );
}
