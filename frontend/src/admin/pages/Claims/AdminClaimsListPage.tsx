import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  claimCategoryLabels,
  claimPriorityLabels,
  claimStatusLabels,
  type ClaimCategory,
  type ClaimListItem,
  type ClaimPriority,
  type ClaimStatus,
} from "../../../models/claim.models";
import { listAdminClaims } from "../../../services/claims.service";
import { formatClaimDate, priorityBadgeClass, slaBadgeClass, statusBadgeClass } from "../../../claims/claimUi";

export default function AdminClaimsListPage() {
  const [claims, setClaims] = useState<ClaimListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<ClaimStatus | "">("");
  const [category, setCategory] = useState<ClaimCategory | "">("");
  const [priority, setPriority] = useState<ClaimPriority | "">("");
  const [search, setSearch] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");

  useEffect(() => {
    void loadClaims();
  }, [status, category, priority, search, createdFrom, createdTo]);

  async function loadClaims() {
    try {
      setLoading(true);
      const data = await listAdminClaims({ status, category, priority, search, createdFrom, createdTo });
      setClaims(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-red-600">Support desk</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Gestion des reclamations</h1>
            <p className="mt-1 text-sm text-slate-500">Vue principale inspiree d'un support center avec filtres, priorites et acces detaille.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Recherche libre" className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-50 xl:col-span-2" />
          <select value={status} onChange={(event) => setStatus(event.target.value as ClaimStatus | "")} className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-50">
            <option value="">Tous statuts</option>
            <option value="SUBMITTED">{claimStatusLabels.SUBMITTED}</option>
            <option value="UNDER_REVIEW">{claimStatusLabels.UNDER_REVIEW}</option>
            <option value="PROCESSING">{claimStatusLabels.PROCESSING}</option>
            <option value="RESOLVED">{claimStatusLabels.RESOLVED}</option>
            <option value="CLOSED">{claimStatusLabels.CLOSED}</option>
          </select>
          <select value={category} onChange={(event) => setCategory(event.target.value as ClaimCategory | "")} className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-50">
            <option value="">Toutes categories</option>
            <option value="ACCOUNT">{claimCategoryLabels.ACCOUNT}</option>
            <option value="CHATBOT">{claimCategoryLabels.CHATBOT}</option>
            <option value="DOCUMENT">{claimCategoryLabels.DOCUMENT}</option>
            <option value="OTHER">{claimCategoryLabels.OTHER}</option>
          </select>
          <select value={priority} onChange={(event) => setPriority(event.target.value as ClaimPriority | "")} className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-50">
            <option value="">Toutes priorites</option>
            <option value="NORMAL">{claimPriorityLabels.NORMAL}</option>
            <option value="HIGH">{claimPriorityLabels.HIGH}</option>
            <option value="URGENT">{claimPriorityLabels.URGENT}</option>
          </select>
          <div className="grid grid-cols-2 gap-3 xl:col-span-2">
            <input type="date" value={createdFrom} onChange={(event) => setCreatedFrom(event.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-50" />
            <input type="date" value={createdTo} onChange={(event) => setCreatedTo(event.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-50" />
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Liste principale</h2>
            <p className="text-sm text-slate-500">{claims.length} reclamation(s) correspondant aux filtres actifs</p>
          </div>
        </div>

        {loading ? <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">Chargement des reclamations...</div> : null}
        {!loading && claims.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">Aucune reclamation ne correspond aux filtres selectionnes.</div> : null}

        {!loading ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-600">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-3">ID</th>
                  <th className="px-3 py-3">Utilisateur</th>
                  <th className="px-3 py-3">Sujet</th>
                  <th className="px-3 py-3">Categorie</th>
                  <th className="px-3 py-3">Statut</th>
                  <th className="px-3 py-3">Priorite</th>
                  <th className="px-3 py-3">SLA</th>
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3">Messages</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((claim) => (
                  <tr key={claim.id} className="border-b border-slate-100 transition hover:bg-slate-50">
                    <td className="px-3 py-4 font-semibold text-slate-900">
                      <Link to={`/admin/claims/${claim.id}`} className="text-red-600">#{claim.id.slice(-6).toUpperCase()}</Link>
                    </td>
                    <td className="px-3 py-4">{claim.userEmail}</td>
                    <td className="px-3 py-4">
                      <div className="font-semibold text-slate-900">{claim.subject}</div>
                      <div className="text-xs text-slate-400">{claim.assignedAgent?.name || "Non assigne"}</div>
                    </td>
                    <td className="px-3 py-4">{claimCategoryLabels[claim.category]}</td>
                    <td className="px-3 py-4"><span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClass(claim.status)}`}>{claimStatusLabels[claim.status]}</span></td>
                    <td className="px-3 py-4"><span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${priorityBadgeClass(claim.priority ?? "NORMAL")}`}>{claimPriorityLabels[claim.priority ?? "NORMAL"]}</span></td>
                    <td className="px-3 py-4">{claim.slaStatus ? <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${slaBadgeClass(claim.slaStatus)}`}>{claim.slaStatus}</span> : <span className="text-slate-400">-</span>}</td>
                    <td className="px-3 py-4">{formatClaimDate(claim.createdAt)}</td>
                    <td className="px-3 py-4">{claim.messageCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
