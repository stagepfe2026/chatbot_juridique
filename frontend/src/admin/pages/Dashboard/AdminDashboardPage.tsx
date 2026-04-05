import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listAuditLogs, listConversations, listDocuments } from "../../../services/admin.service";
import { listAdminClaims } from "../../../services/claims.service";
import type { AuditLog } from "../AuditLogs/auditLogs.types";
import { buildActivitySeries, formatAuditDate } from "../AuditLogs/auditLogs.utils";
import type { Conversation } from "../../../models/conversation.models";
import type { Document } from "../../../models/document.models";
import { claimStatusLabels, normalizeClaimStatus, type Claim } from "../../../models/claim.models";
import { formatClaimDate, priorityBadgeClass, statusBadgeClass } from "../../../claims/claimUi";

interface KpiCardProps {
  label: string;
  value: string | number;
  hint: string;
  tone: string;
}

function KpiCard({ label, value, hint, tone }: KpiCardProps) {
  return (
    <div className={`rounded-3xl border p-5 shadow-lg ${tone}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.22em] opacity-80">{label}</div>
      <div className="mt-3 text-3xl font-bold tracking-tight">{value}</div>
      <div className="mt-2 text-sm opacity-80">{hint}</div>
    </div>
  );
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-lg">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">{text}</div>;
}

function LineChart({ title, points, colors }: { title: string; points: { label: string; claims: number; conversations: number; audits: number }[]; colors: { claims: string; conversations: string; audits: string } }) {
  const width = 640;
  const height = 240;
  const padding = 28;
  const maxValue = Math.max(1, ...points.flatMap((point) => [point.claims, point.conversations, point.audits]));
  const xStep = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;

  function buildPath(values: number[]) {
    return values
      .map((value, index) => {
        const x = padding + index * xStep;
        const y = height - padding - (value / maxValue) * (height - padding * 2);
        return `${index === 0 ? "M" : "L"}${x} ${y}`;
      })
      .join(" ");
  }

  const claimsPath = buildPath(points.map((point) => point.claims));
  const conversationsPath = buildPath(points.map((point) => point.conversations));
  const auditsPath = buildPath(points.map((point) => point.audits));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        <span>{title}</span>
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors.claims }} />Reclamations</span>
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors.conversations }} />Conversations</span>
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors.audits }} />Audit logs</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full overflow-visible rounded-2xl bg-slate-50 p-3">
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = height - padding - ratio * (height - padding * 2);
          const label = Math.round(maxValue * ratio);
          return (
            <g key={ratio}>
              <line x1={padding} x2={width - padding} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="4 4" />
              <text x={8} y={y + 4} fontSize="11" fill="#94a3b8">{label}</text>
            </g>
          );
        })}
        {points.map((point, index) => {
          const x = padding + index * xStep;
          return <text key={point.label} x={x} y={height - 6} textAnchor="middle" fontSize="11" fill="#64748b">{point.label}</text>;
        })}
        <path d={claimsPath} fill="none" stroke={colors.claims} strokeWidth="3" strokeLinecap="round" />
        <path d={conversationsPath} fill="none" stroke={colors.conversations} strokeWidth="3" strokeLinecap="round" />
        <path d={auditsPath} fill="none" stroke={colors.audits} strokeWidth="3" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function DonutChart({ items }: { items: { label: string; value: number; color: string }[] }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center">
      <div className="mx-auto flex w-full max-w-[220px] items-center justify-center">
        <svg viewBox="0 0 160 160" className="h-40 w-40">
          <circle cx="80" cy="80" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="18" />
          {items.map((item) => {
            const segment = total > 0 ? (item.value / total) * circumference : 0;
            const circle = (
              <circle
                key={item.label}
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke={item.color}
                strokeWidth="18"
                strokeDasharray={`${segment} ${circumference - segment}`}
                strokeDashoffset={-offset}
                strokeLinecap="round"
                transform="rotate(-90 80 80)"
              />
            );
            offset += segment;
            return circle;
          })}
          <text x="80" y="74" textAnchor="middle" fontSize="14" fill="#64748b">Dossiers</text>
          <text x="80" y="95" textAnchor="middle" fontSize="26" fontWeight="700" fill="#0f172a">{total}</text>
        </svg>
      </div>
      <div className="grid gap-3">
        {items.map((item) => {
          const percentage = total > 0 ? Math.round((item.value / total) * 100) : 0;
          return (
            <div key={item.label} className="rounded-2xl border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  {item.label}
                </div>
                <div className="text-sm font-semibold text-slate-900">{item.value}</div>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full" style={{ width: `${percentage}%`, backgroundColor: item.color }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HorizontalBars({ items }: { items: { label: string; value: number; color: string; hint?: string }[] }) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl border border-slate-200 p-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <div>
              <div className="font-semibold text-slate-900">{item.label}</div>
              {item.hint ? <div className="text-slate-500">{item.hint}</div> : null}
            </div>
            <div className="font-semibold text-slate-900">{item.value}</div>
          </div>
          <div className="mt-3 h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full" style={{ width: `${(item.value / max) * 100}%`, backgroundColor: item.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function buildLast7DaysSeries(claims: Claim[], conversations: Conversation[], logs: AuditLog[]) {
  const auditSeries = buildActivitySeries(logs);
  const labels = auditSeries.map((point) => point.label);
  const dayKeys = auditSeries.map((_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  });

  function toKey(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  const claimCount = dayKeys.map((key) => claims.filter((claim) => toKey(claim.createdAt) === key).length);
  const conversationCount = dayKeys.map((key) => conversations.filter((conversation) => toKey(conversation.createdAt) === key).length);

  return labels.map((label, index) => ({
    label,
    claims: claimCount[index],
    conversations: conversationCount[index],
    audits: auditSeries[index]?.value ?? 0,
  }));
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);
      const [documentsData, conversationsData, claimsData, logsData] = await Promise.all([
        listDocuments(),
        listConversations(),
        listAdminClaims(),
        listAuditLogs(200),
      ]);
      setDocuments(documentsData);
      setConversations(conversationsData);
      setClaims(claimsData);
      setLogs(logsData);
    } finally {
      setLoading(false);
    }
  }

  const stats = useMemo(() => {
    const normalizedClaims = claims.map((claim) => ({ ...claim, displayStatus: normalizeClaimStatus(claim.status) }));
    const documentsIndexed = documents.filter((document) => document.documentStatus === "INDEXED").length;
    const documentsProcessing = documents.filter((document) => document.documentStatus === "PROCESSING").length;
    const documentsFailed = documents.filter((document) => document.documentStatus === "FAILED").length;
    const openClaims = normalizedClaims.filter((claim) => !["RESOLVED", "CLOSED"].includes(claim.displayStatus)).length;
    const urgentClaims = normalizedClaims.filter((claim) => claim.priority === "URGENT" && !["RESOLVED", "CLOSED"].includes(claim.displayStatus)).length;
    const overdueClaims = normalizedClaims.filter((claim) => claim.slaStatus === "LATE").length;
    const criticalLogs = logs.filter((log) => log.level === "CRITICAL").length;
    const failedLogs = logs.filter((log) => log.status === "FAILED").length;
    const avgDocumentChunks = documents.length > 0
      ? Math.round(documents.reduce((sum, document) => sum + Number(document.chunksCount ?? 0), 0) / documents.length)
      : 0;

    return {
      totalDocuments: documents.length,
      documentsIndexed,
      documentsProcessing,
      documentsFailed,
      totalConversations: conversations.length,
      totalClaims: claims.length,
      openClaims,
      urgentClaims,
      overdueClaims,
      criticalLogs,
      failedLogs,
      avgDocumentChunks,
      claimsByStatus: [
        { label: claimStatusLabels.SUBMITTED, value: normalizedClaims.filter((claim) => claim.displayStatus === "SUBMITTED").length, color: "#ef4444" },
        { label: claimStatusLabels.UNDER_REVIEW, value: normalizedClaims.filter((claim) => claim.displayStatus === "UNDER_REVIEW").length, color: "#0ea5e9" },
        { label: claimStatusLabels.PROCESSING, value: normalizedClaims.filter((claim) => claim.displayStatus === "PROCESSING").length, color: "#f59e0b" },
        { label: claimStatusLabels.RESOLVED, value: normalizedClaims.filter((claim) => claim.displayStatus === "RESOLVED").length, color: "#10b981" },
        { label: claimStatusLabels.CLOSED, value: normalizedClaims.filter((claim) => claim.displayStatus === "CLOSED").length, color: "#475569" },
      ],
      documentStatusBars: [
        { label: "Documents indexes", value: documentsIndexed, color: "#16a34a", hint: `${documents.length > 0 ? Math.round((documentsIndexed / documents.length) * 100) : 0}% du parc documentaire` },
        { label: "Documents en cours", value: documentsProcessing, color: "#f59e0b", hint: "Flux d'importation et d'indexation" },
        { label: "Documents en echec", value: documentsFailed, color: "#dc2626", hint: "Elements a relancer ou verifier" },
      ],
      auditStatusBars: [
        { label: "Succes", value: logs.filter((log) => log.status === "SUCCESS").length, color: "#16a34a" },
        { label: "Warnings", value: logs.filter((log) => log.status === "WARNING").length, color: "#f59e0b" },
        { label: "Echecs", value: failedLogs, color: "#dc2626" },
      ],
    };
  }, [claims, conversations, documents, logs]);

  const activitySeries = useMemo(() => buildLast7DaysSeries(claims, conversations, logs), [claims, conversations, logs]);
  const recentClaims = useMemo(() => claims.slice(0, 5), [claims]);
  const recentLogs = useMemo(() => logs.slice(0, 5), [logs]);

  return (
    <div className="grid gap-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-red-600">Pilotage ministeriel</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Dashboard administration</h1>
            <p className="mt-1 text-sm text-slate-500">Vue consolidee des reclamations, documents, conversations et evenements d'audit.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/admin/claims" className="inline-flex items-center justify-center rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700">Voir les reclamations</Link>
            <Link to="/admin/audit-logs" className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600">Consulter l'audit</Link>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Documents" value={stats.totalDocuments} hint={`${stats.documentsIndexed} indexes ? ${stats.documentsProcessing} en cours`} tone="border-slate-200 bg-white text-slate-900" />
        <KpiCard label="Conversations" value={stats.totalConversations} hint="Volume des echanges admin/utilisateur" tone="border-sky-200 bg-sky-50 text-sky-900" />
        <KpiCard label="Reclamations ouvertes" value={stats.openClaims} hint={`${stats.urgentClaims} urgentes ? ${stats.overdueClaims} hors delai`} tone="border-amber-200 bg-amber-50 text-amber-900" />
        <KpiCard label="Audit critique" value={stats.criticalLogs} hint={`${stats.failedLogs} echecs sur les ${logs.length} derniers logs`} tone="border-rose-200 bg-rose-50 text-rose-900" />
      </div>

      {loading ? <EmptyState text="Chargement du dashboard administrateur..." /> : null}

      {!loading ? (
        <>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_420px]">
            <SectionCard title="Activite des 7 derniers jours" subtitle="Suivi croise des reclamations, conversations et logs d'audit.">
              <LineChart title="Volume journalier" points={activitySeries} colors={{ claims: "#dc2626", conversations: "#0284c7", audits: "#7c3aed" }} />
            </SectionCard>

            <SectionCard title="Repartition des reclamations" subtitle="Distribution par statut de traitement.">
              <DonutChart items={stats.claimsByStatus} />
            </SectionCard>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <SectionCard title="Qualite documentaire" subtitle="Suivi de l'indexation et de la sante des imports.">
              <HorizontalBars items={stats.documentStatusBars} />
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <span className="font-semibold text-slate-900">Moyenne des chunks par document:</span> {stats.avgDocumentChunks}
              </div>
            </SectionCard>

            <SectionCard title="Etat des audits" subtitle="Lecture rapide de la stabilite et des signaux de risque.">
              <HorizontalBars items={stats.auditStatusBars} />
            </SectionCard>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <SectionCard title="Dossiers prioritaires" subtitle="Dernieres reclamations a forte visibilite pour l'administration.">
              {recentClaims.length === 0 ? (
                <EmptyState text="Aucune reclamation disponible." />
              ) : (
                <div className="grid gap-3">
                  {recentClaims.map((claim) => (
                    <Link key={claim.id} to="/admin/claims" className="rounded-2xl border border-slate-200 p-4 transition hover:border-red-200 hover:bg-red-50/40">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClass(claim.status)}`}>{claimStatusLabels[normalizeClaimStatus(claim.status)]}</span>
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${priorityBadgeClass(claim.priority ?? "NORMAL")}`}>{claim.priority ?? "NORMAL"}</span>
                        <span className="text-xs font-semibold text-slate-400">{claim.ticketNumber || claim.id}</span>
                      </div>
                      <div className="mt-3 text-sm font-semibold text-slate-900">{claim.subject}</div>
                      <div className="mt-1 text-sm text-slate-500">{claim.userEmail} ? {formatClaimDate(claim.createdAt)}</div>
                    </Link>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Derniers evenements d'audit" subtitle="Surveillance recente des operations sensibles.">
              {recentLogs.length === 0 ? (
                <EmptyState text="Aucun log d'audit disponible." />
              ) : (
                <div className="grid gap-3">
                  {recentLogs.map((log) => {
                    const formatted = formatAuditDate(log.timestamp);
                    return (
                      <Link key={log.id} to="/admin/audit-logs" className="rounded-2xl border border-slate-200 p-4 transition hover:border-red-200 hover:bg-red-50/40">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-slate-900">{log.action}</div>
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${log.level === "CRITICAL" ? "border-red-200 bg-red-50 text-red-700" : "border-slate-200 bg-slate-100 text-slate-600"}`}>{log.level}</span>
                        </div>
                        <div className="mt-1 text-sm text-slate-500">{log.user} ? {formatted.shortDate} {formatted.shortTime}</div>
                        <div className="mt-2 text-sm text-slate-700">{log.details.message}</div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </div>
        </>
      ) : null}
    </div>
  );
}
