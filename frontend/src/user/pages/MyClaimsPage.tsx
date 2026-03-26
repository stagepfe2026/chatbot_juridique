import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  claimCategoryLabels,
  claimPriorityLabels,
  claimSlaLabels,
  claimStatusLabels,
  type ClaimListItem,
  type ClaimStatus,
} from "../../models/claim.models";
import { listMyClaims } from "../../services/claims.service";
import { formatClaimDate, priorityBadgeClass, slaBadgeClass, statusBadgeClass } from "../../claims/claimUi";

export default function MyClaimsPage() {
  const [claims, setClaims] = useState<ClaimListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<ClaimStatus | "">("");
  const [search, setSearch] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");

  useEffect(() => {
    void loadClaims();
  }, [status, search, createdFrom, createdTo]);

  async function loadClaims() {
    try {
      setLoading(true);
      const data = await listMyClaims({ status, search, createdFrom, createdTo });
      setClaims(data);
    } finally {
      setLoading(false);
    }
  }

  const timelineClaims = useMemo(() => claims.slice(0, 4), [claims]);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_360px]">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-red-600">Espace utilisateur</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Mes reclamations</h1>
            <p className="mt-1 text-sm text-slate-500">Suivez vos demandes, les reponses de l'administration et l'avancement du traitement.</p>
          </div>
          <Link to="/user/reclamations" className="inline-flex items-center justify-center rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 ">
            Nouvelle reclamation
          </Link>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher par sujet ou mot-cle"
            className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-50 md:col-span-2"
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as ClaimStatus | "")}
            className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-50"
          >
            <option value="">Tous les statuts</option>
            <option value="PENDING">{claimStatusLabels.PENDING}</option>
            <option value="IN_PROGRESS">{claimStatusLabels.IN_PROGRESS}</option>
            <option value="RESOLVED">{claimStatusLabels.RESOLVED}</option>
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input type="date" value={createdFrom} onChange={(event) => setCreatedFrom(event.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-50" />
            <input type="date" value={createdTo} onChange={(event) => setCreatedTo(event.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-50" />
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          {loading ? <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">Chargement des reclamations...</div> : null}
          {!loading && claims.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">Aucune reclamation ne correspond aux filtres actifs.</div> : null}
          {!loading && claims.map((claim) => (
            <Link
              key={claim.id}
              to={`/user/reclamations/${claim.id}`}
              className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 transition hover:border-red-200 hover:shadow-sm"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClass(claim.status)}`}>{claimStatusLabels[claim.status]}</span>
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${priorityBadgeClass(claim.priority)}`}>{claimPriorityLabels[claim.priority]}</span>
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${slaBadgeClass(claim.slaStatus)}`}>{claimSlaLabels[claim.slaStatus]}</span>
                  </div>
                  <h2 className="mt-3 text-lg font-semibold text-slate-900">{claim.subject}</h2>
                  <p className="mt-1 text-sm text-slate-500">{claimCategoryLabels[claim.category]} � Creee le {formatClaimDate(claim.createdAt)}</p>
                </div>
                <div className="text-sm text-slate-500 lg:text-right">
                  <div>{claim.messageCount} message(s)</div>
                  <div>Limite SLA: {formatClaimDate(claim.dueAt)}</div>
                </div>
              </div>
              <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  {claim.lastAdminReplyPreview || "Aucune reponse administrative pour le moment."}
                </div>
                <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm text-slate-500">
                  {claim.assignedAgent ? `Agent assigne: ${claim.assignedAgent.name}` : "Affectation en attente"}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <aside className="grid gap-4">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Timeline recente</p>
          <div className="mt-4 grid gap-4">
            {timelineClaims.length === 0 ? <p className="text-sm text-slate-500">Votre historique apparaitra ici.</p> : null}
            {timelineClaims.map((claim) => (
              <div key={claim.id} className="relative pl-5 text-sm text-slate-600 before:absolute before:left-0 before:top-1 before:h-2.5 before:w-2.5 before:rounded-full before:bg-red-500">
                <div className="font-semibold text-slate-800">{claim.subject}</div>
                <div>{claimStatusLabels[claim.status]} � {formatClaimDate(claim.updatedAt)}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
          <h2 className="text-lg font-semibold">Historique des reponses</h2>
          <p className="mt-2 text-sm text-slate-300">Chaque fiche reclamation contient les messages admin, les changements de statut et le journal des actions.</p>
        </section>
      </aside>
    </div>
  );
}
