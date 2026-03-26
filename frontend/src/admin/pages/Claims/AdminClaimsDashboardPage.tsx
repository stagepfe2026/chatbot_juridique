import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { claimStatusLabels, type ClaimListItem, type ClaimStats } from "../../../models/claim.models";
import { getAdminClaimStats, listAdminClaims } from "../../../services/claims.service";
import { formatClaimDate, formatRelativeHours, priorityBadgeClass, slaBadgeClass, statusBadgeClass } from "../../../claims/claimUi";

function KpiCard({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${tone}`}>
      <div className="text-sm font-medium">{label}</div>
      <div className="mt-3 text-3xl font-bold tracking-tight">{value}</div>
    </div>
  );
}

export default function AdminClaimsDashboardPage() {
  const [stats, setStats] = useState<ClaimStats | null>(null);
  const [recentClaims, setRecentClaims] = useState<ClaimListItem[]>([]);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    const [statsData, claimsData] = await Promise.all([
      getAdminClaimStats(),
      listAdminClaims({}),
    ]);
    setStats(statsData);
    setRecentClaims(claimsData.slice(0, 5));
  }

  const distribution = useMemo(() => {
    if (!stats) return [];
    return [
      { label: claimStatusLabels.PENDING, value: stats.pending },
      { label: claimStatusLabels.IN_PROGRESS, value: stats.inProgress },
      { label: claimStatusLabels.RESOLVED, value: stats.resolved },
    ];
  }, [stats]);

  return (
    <div className="grid gap-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-red-600">Pilotage support</p>
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">Dashboard des reclamations</h1>
            <p className="mt-1 text-sm text-slate-500">Vue d'ensemble pour suivre le volume, les SLA et la charge de traitement.</p>
          </div>
          <Link to="/admin/claims" className="inline-flex items-center justify-center rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700">
            Ouvrir la gestion detaillee
          </Link>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Total reclamations" value={stats?.total ?? "-"} tone="border-slate-200 bg-white text-slate-900" />
        <KpiCard label="En attente" value={stats?.pending ?? "-"} tone="border-rose-200 bg-rose-50 text-rose-700" />
        <KpiCard label="En cours" value={stats?.inProgress ?? "-"} tone="border-amber-200 bg-amber-50 text-amber-700" />
        <KpiCard label="Resolues" value={stats?.resolved ?? "-"} tone="border-emerald-200 bg-emerald-50 text-emerald-700" />
        <KpiCard label="Temps moyen 1re reponse" value={formatRelativeHours(stats?.averageFirstResponseHours ?? 0)} tone="border-slate-200 bg-slate-950 text-white" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_380px]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Dernieres reclamations</h2>
            <Link to="/admin/claims" className="text-sm font-semibold text-red-600">Tout voir</Link>
          </div>
          <div className="mt-4 grid gap-3">
            {recentClaims.map((claim) => (
              <Link key={claim.id} to={`/admin/claims/${claim.id}`} className="grid gap-3 rounded-2xl border border-slate-200 p-4 transition hover:border-red-200 hover:bg-red-50/40">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClass(claim.status)}`}>{claimStatusLabels[claim.status]}</span>
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${priorityBadgeClass(claim.priority)}`}>{claim.priority}</span>
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${slaBadgeClass(claim.slaStatus)}`}>{claim.slaStatus}</span>
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">{claim.subject}</div>
                  <div className="text-sm text-slate-500">{claim.userEmail} • {formatClaimDate(claim.createdAt)}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Indicateurs SLA</h2>
          <div className="mt-4 grid gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Tickets urgents ouverts</div>
              <div className="mt-2 text-2xl font-bold text-slate-900">{stats?.urgentOpen ?? 0}</div>
            </div>
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <div className="text-sm text-rose-600">Tickets hors delai</div>
              <div className="mt-2 text-2xl font-bold text-rose-700">{stats?.overdue ?? 0}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-800">Repartition</div>
              <div className="mt-3 grid gap-3">
                {distribution.map((item) => (
                  <div key={item.label} className="flex items-center justify-between text-sm text-slate-600">
                    <span>{item.label}</span>
                    <span className="font-semibold text-slate-900">{item.value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-xs text-slate-400">Derniere activite: {formatClaimDate(stats?.lastUpdatedAt || stats?.createdAt || null)}</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
