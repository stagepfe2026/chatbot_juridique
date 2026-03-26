import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  claimCategoryLabels,
  claimPriorityLabels,
  claimStatusLabels,
  type Claim,
  type ClaimStatus,
} from "../../../models/claim.models";
import { assignAdminClaim, getAdminClaim, replyToAdminClaim, updateAdminClaimStatus } from "../../../services/claims.service";
import { publishSnackbar } from "../../../utils/snackbarBus";
import { formatClaimDate, priorityBadgeClass, slaBadgeClass, statusBadgeClass } from "../../../claims/claimUi";

export default function AdminClaimDetailPage() {
  const { claimId = "" } = useParams();
  const [claim, setClaim] = useState<Claim | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [assigneeName, setAssigneeName] = useState("");
  const [assigneeEmail, setAssigneeEmail] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);

  useEffect(() => {
    void loadClaim();
  }, [claimId]);

  async function loadClaim() {
    try {
      setLoading(true);
      const data = await getAdminClaim(claimId);
      setClaim(data);
      setAssigneeName(data.assignedAgent?.name || "");
      setAssigneeEmail(data.assignedAgent?.email || "");
    } finally {
      setLoading(false);
    }
  }

  async function handleReply(event: FormEvent) {
    event.preventDefault();
    if (!reply.trim()) return;
    try {
      setSubmittingReply(true);
      const updated = await replyToAdminClaim(claimId, { message: reply.trim() });
      setClaim(updated);
      setReply("");
      publishSnackbar({ variant: "success", message: "Reponse admin envoyee." });
    } finally {
      setSubmittingReply(false);
    }
  }

  async function handleStatusChange(nextStatus: ClaimStatus) {
    const updated = await updateAdminClaimStatus(claimId, { status: nextStatus });
    setClaim(updated);
    publishSnackbar({ variant: "success", message: "Statut mis a jour." });
  }

  async function handleAssign() {
    if (!assigneeName.trim() || !assigneeEmail.trim()) return;
    const updated = await assignAdminClaim(claimId, { name: assigneeName.trim(), email: assigneeEmail.trim() });
    setClaim(updated);
    publishSnackbar({ variant: "success", message: "Affectation enregistree." });
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_380px]">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link to="/admin/claims" className="text-sm font-semibold text-red-600">Retour a la liste</Link>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Traitement de la reclamation</h1>
            {claim ? <p className="mt-1 text-sm text-slate-500">#{claim.id.slice(-6).toUpperCase()} • {claim.subject}</p> : null}
          </div>
          {claim ? (
            <div className="flex flex-wrap gap-2">
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClass(claim.status)}`}>{claimStatusLabels[claim.status]}</span>
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${priorityBadgeClass(claim.priority)}`}>{claimPriorityLabels[claim.priority]}</span>
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${slaBadgeClass(claim.slaStatus)}`}>{claim.slaStatus}</span>
            </div>
          ) : null}
        </div>

        {loading ? <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">Chargement du ticket...</div> : null}

        {claim ? (
          <div className="mt-5 grid gap-5">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <div className="font-semibold text-slate-900">Description initiale</div>
              <p className="mt-2 whitespace-pre-wrap leading-6">{claim.description}</p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Conversation</h2>
                <div className="text-sm text-slate-500">{claim.messages.length} message(s)</div>
              </div>
              <div className="mt-4 grid gap-4">
                {claim.messages.map((message) => (
                  <div key={message.id} className={`max-w-[88%] rounded-3xl px-4 py-3 text-sm leading-6 ${message.authorType === "ADMIN" ? "justify-self-end bg-red-600 text-white" : "justify-self-start border border-slate-200 bg-slate-50 text-slate-700"}`}>
                    <div className="text-xs font-semibold uppercase tracking-wide opacity-75">{message.authorName}</div>
                    <div className="mt-2 whitespace-pre-wrap">{message.message}</div>
                    <div className="mt-2 text-[11px] opacity-75">{formatClaimDate(message.createdAt)}</div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleReply} className="mt-5 grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <label className="grid gap-2 text-sm">
                  <span className="font-semibold text-slate-700">Repondre a l'utilisateur</span>
                  <textarea
                    rows={5}
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    placeholder="Donnez une reponse claire, actionnable et tracee."
                    className="rounded-2xl border border-slate-200 px-3 py-3 outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-50"
                  />
                </label>
                <div className="flex justify-end">
                  <button type="submit" disabled={submittingReply} className="inline-flex h-11 items-center justify-center rounded-xl bg-red-600 px-5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60">
                    {submittingReply ? "Envoi..." : "Envoyer la reponse"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </section>

      <aside className="grid gap-4">
        {claim ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Metadonnees</h2>
            <div className="mt-4 grid gap-4 text-sm text-slate-600">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Utilisateur</div>
                <div className="mt-1 font-semibold text-slate-900">{claim.userEmail}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Categorie</div>
                <div className="mt-1 font-semibold text-slate-900">{claimCategoryLabels[claim.category]}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Date</div>
                <div className="mt-1 font-semibold text-slate-900">{formatClaimDate(claim.createdAt)}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">SLA limite</div>
                <div className="mt-1 font-semibold text-slate-900">{formatClaimDate(claim.dueAt)}</div>
              </div>
              <div className="grid gap-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Changer statut</div>
                <div className="grid grid-cols-3 gap-2">
                  {(["PENDING", "IN_PROGRESS", "RESOLVED"] as ClaimStatus[]).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => void handleStatusChange(status)}
                      className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${claim.status === status ? "border-red-600 bg-red-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
                    >
                      {claimStatusLabels[status]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Affectation</div>
                <input value={assigneeName} onChange={(event) => setAssigneeName(event.target.value)} placeholder="Nom de l'agent" className="h-10 rounded-xl border border-slate-200 px-3 outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-50" />
                <input value={assigneeEmail} onChange={(event) => setAssigneeEmail(event.target.value)} placeholder="Email de l'agent" className="h-10 rounded-xl border border-slate-200 px-3 outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-50" />
                <button type="button" onClick={() => void handleAssign()} className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
                  Enregistrer l'affectation
                </button>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Journal d'actions</div>
                <div className="mt-3 grid gap-3 text-sm text-slate-600">
                  {claim.activityLog.map((entry) => (
                    <div key={entry.id} className="relative pl-5 before:absolute before:left-0 before:top-1 before:h-2.5 before:w-2.5 before:rounded-full before:bg-red-500">
                      <div className="font-semibold text-slate-800">{entry.description}</div>
                      <div>{entry.actorName} • {formatClaimDate(entry.createdAt)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </aside>
    </div>
  );
}
