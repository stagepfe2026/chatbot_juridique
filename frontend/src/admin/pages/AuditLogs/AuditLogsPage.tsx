import { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { listAuditLogs } from "../../../services/admin.service";
import type { AuditExportFormat, AuditLog, AuditLogLevel, AuditLogStatus } from "./auditLogs.types";
import { buildActivitySeries, formatAuditDate, levelLabel, statusLabel } from "./auditLogs.utils";
import { AuditActivityChart } from "./components/AuditActivityChart";
import { AuditExportDialog } from "./components/AuditExportDialog";
import { AuditFilters } from "./components/AuditFilters";
import { AuditHeader } from "./components/AuditHeader";
import { AuditLogCard } from "./components/AuditLogCard";
import { AuditLogDrawer } from "./components/AuditLogDrawer";
import { AuditStats } from "./components/AuditStats";
import { AuditTimeline } from "./components/AuditTimeline";

const PAGE_SIZE = 6;

function toLocalDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildExportRows(logs: AuditLog[]) {
  return logs.map((log) => ({
    Date: formatAuditDate(log.timestamp).full,
    Utilisateur: log.user,
    Action: log.action,
    Ressource: log.resource,
    Statut: statusLabel(log.status),
    Niveau: levelLabel(log.level),
    IP: log.ip,
    Message: log.details.message,
    Endpoint: log.details.endpoint ?? "-",
  }));
}

function downloadJson(logs: AuditLog[]) {
  const payload = JSON.stringify(logs, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `audit-logs-${new Date().toISOString()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadExcel(logs: AuditLog[]) {
  const rows = buildExportRows(logs);
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Audit Logs");
  XLSX.writeFile(workbook, `audit-logs-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function downloadPdf(logs: AuditLog[]) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const exportDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(new Date());

  doc.setFillColor(185, 28, 28);
  doc.rect(0, 0, 297, 20, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text("Ministere - Journal des activites", 14, 12);

  doc.setTextColor(31, 41, 55);
  doc.setFontSize(10);
  doc.text(`Date d'export: ${exportDate}`, 14, 28);
  doc.text(`Nombre total de lignes: ${logs.length}`, 14, 34);
  doc.text("Document d'audit exporte pour archivage et consultation officielle.", 14, 40);

  autoTable(doc, {
    startY: 46,
    head: [["Date", "Utilisateur", "Action", "Ressource", "Statut", "Niveau", "IP"]],
    body: logs.map((log) => [
      formatAuditDate(log.timestamp).full,
      log.user,
      log.action,
      log.resource,
      statusLabel(log.status),
      levelLabel(log.level),
      log.ip,
    ]),
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [51, 65, 85],
    },
    headStyles: {
      fillColor: [185, 28, 28],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 14, right: 14 },
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 190;
  doc.setFontSize(9);
  doc.text("Validation: ____________________", 14, Math.min(finalY + 14, 195));
  doc.save(`audit-logs-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedAction, setSelectedAction] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<AuditLogStatus | "">("");
  const [selectedLevel, setSelectedLevel] = useState<AuditLogLevel | "">("");
  const [selectedDate, setSelectedDate] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

  useEffect(() => {
    void loadAuditLogs();
  }, []);

  async function loadAuditLogs() {
    try {
      setLoading(true);
      setError(null);
      const data = await listAuditLogs();
      setLogs(data);
    } catch (err: unknown) {
      const message =
        typeof err === "object" && err !== null && "message" in err
          ? String((err as { message?: unknown }).message ?? "Erreur de chargement des logs.")
          : "Erreur de chargement des logs.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const users = useMemo(() => Array.from(new Set(logs.map((log) => log.user))).sort((a, b) => a.localeCompare(b, "fr")), [logs]);
  const actions = useMemo(() => Array.from(new Set(logs.map((log) => log.action))).sort((a, b) => a.localeCompare(b, "fr")), [logs]);

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();

    return logs.filter((log) => {
      if (selectedUser && log.user !== selectedUser) return false;
      if (selectedAction && log.action !== selectedAction) return false;
      if (selectedStatus && log.status !== selectedStatus) return false;
      if (selectedLevel && log.level !== selectedLevel) return false;
      if (selectedDate) {
        const logDate = toLocalDateInputValue(new Date(log.timestamp));
        if (logDate !== selectedDate) return false;
      }
      if (!query) return true;

      const haystack = [
        log.user,
        log.action,
        log.resource,
        log.ip,
        log.details.message,
        log.details.endpoint ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [logs, search, selectedUser, selectedAction, selectedStatus, selectedLevel, selectedDate]);

  const visibleLogs = filteredLogs.slice(0, visibleCount);

  const stats = useMemo(
    () => ({
      total: filteredLogs.length,
      success: filteredLogs.filter((log) => log.status === "SUCCESS").length,
      failed: filteredLogs.filter((log) => log.status === "FAILED").length,
      critical: filteredLogs.filter((log) => log.level === "CRITICAL").length,
    }),
    [filteredLogs],
  );

  const timelineLogs = useMemo(
    () =>
      [...filteredLogs]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 6),
    [filteredLogs],
  );

  const activitySeries = useMemo(() => buildActivitySeries(logs), [logs]);

  function resetFilters() {
    setSearch("");
    setSelectedUser("");
    setSelectedAction("");
    setSelectedStatus("");
    setSelectedLevel("");
    setSelectedDate("");
    setVisibleCount(PAGE_SIZE);
  }

  async function refreshView() {
    resetFilters();
    setSelectedLog(null);
    await loadAuditLogs();
  }

  function handleExportSelection(format: AuditExportFormat) {
    if (format === "pdf") {
      downloadPdf(filteredLogs);
    } else if (format === "excel") {
      downloadExcel(filteredLogs);
    } else {
      downloadJson(filteredLogs);
    }
    setIsExportDialogOpen(false);
  }

  return (
    <div className="grid gap-5">
      <AuditHeader totalLogs={logs.length} onRefresh={() => void refreshView()} onExport={() => setIsExportDialogOpen(true)} />

      <AuditStats total={stats.total} success={stats.success} failed={stats.failed} critical={stats.critical} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_420px]">
        <AuditActivityChart points={activitySeries} />
        <AuditTimeline logs={timelineLogs} />
      </div>

      <AuditFilters
        search={search}
        user={selectedUser}
        action={selectedAction}
        status={selectedStatus}
        level={selectedLevel}
        date={selectedDate}
        users={users}
        actions={actions}
        onSearchChange={(value) => {
          setSearch(value);
          setVisibleCount(PAGE_SIZE);
        }}
        onUserChange={(value) => {
          setSelectedUser(value);
          setVisibleCount(PAGE_SIZE);
        }}
        onActionChange={(value) => {
          setSelectedAction(value);
          setVisibleCount(PAGE_SIZE);
        }}
        onStatusChange={(value) => {
          setSelectedStatus(value);
          setVisibleCount(PAGE_SIZE);
        }}
        onLevelChange={(value) => {
          setSelectedLevel(value);
          setVisibleCount(PAGE_SIZE);
        }}
        onDateChange={(value) => {
          setSelectedDate(value);
          setVisibleCount(PAGE_SIZE);
        }}
        onReset={resetFilters}
      />

      {loading ? <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">Chargement des logs d'audit...</div> : null}
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div> : null}

      {!loading ? (
        <section className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-slate-950">Liste des activites</h2>
              <p className="text-sm text-slate-500">{filteredLogs.length} log(s) correspondant aux filtres actifs</p>
            </div>
            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
              Donnees reelles issues de MongoDB
            </div>
          </div>

          {visibleLogs.length > 0 ? (
            <div className="space-y-3">
              {visibleLogs.map((log) => (
                <AuditLogCard key={log.id} log={log} onOpen={setSelectedLog} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
              Aucun log ne correspond aux filtres selectionnes.
            </div>
          )}

          {visibleCount < filteredLogs.length ? (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Charger plus
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      <AuditLogDrawer log={selectedLog} open={selectedLog !== null} onClose={() => setSelectedLog(null)} />
      <AuditExportDialog
        open={isExportDialogOpen}
        onClose={() => setIsExportDialogOpen(false)}
        onSelect={handleExportSelection}
      />
    </div>
  );
}
