import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  claimCategoryLabels,
  claimPriorityLabels,
  claimSlaLabels,
  claimStatusLabels,
  type Claim,
} from "../../models/claim.models";
import { getMyClaim } from "../../services/claims.service";
import { formatClaimDate, priorityBadgeClass, slaBadgeClass, statusBadgeClass } from "../../claims/claimUi";

export default function ClaimDetailPage() {
  const { claimId = "" } = useParams();
  const [claim, setClaim] = useState<Claim | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadClaim();
  }, [claimId]);

  async function loadClaim() {
    try {
      setLoading(true);
      const data = await getMyClaim(claimId);
      setClaim(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_360px]">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link to="/user/reclamations/mes-demandes" className="text-sm font-semibold text-red-600">Retour a mes reclamations</Link>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Detail de la reclamation</h1>
            {claim ? <p className="mt-1 text-sm text-slate-500">{claim.subject}</p> : null}
          </div>
          {claim ? (
            <div className="flex flex-wrap gap-2">
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClass(claim.status)}`}>{claimStatusLabels[claim.status]}</span>
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${priorityBadgeClass(claim.priority)}`}>{claimPriorityLabels[claim.priority]}</span>
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${slaBadgeClass(claim.slaStatus)}`}>{claimSlaLabels[claim.slaStatus]}</span>
            </div>
          ) : null}
        </div>

        {loading ? <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">Chargement de la reclamation...</div> : null}

        {claim ? (
          <div className="mt-5 grid gap-5">
            <div className="grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 lg:grid-cols-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Categorie</div>
                <div className="mt-2 font-semibold text-slate-800">{claimCategoryLabels[claim.category]}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Date de creation</div>
                <div className="mt-2 font-semibold text-slate-800">{formatClaimDate(claim.createdAt)}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Agent</div>
                <div className="mt-2 font-semibold text-slate-800">{claim.assignedAgent?.name || "Non assigne"}</div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-semibold text-slate-900">Description initiale</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{claim.description}</p>
              <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-500">
                {claim.pageLink ? <a href={claim.pageLink} target="_blank" rel="noreferrer" className="font-semibold text-red-600">Page concernee</a> : null}
                {claim.attachment ? (
                  <a
                    href={`data:${claim.attachment.mimeType};base64,${claim.attachment.contentBase64}`}
                    download={claim.attachment.filename}
                    className="font-semibold text-red-600"
                  >
                    Telecharger la piece jointe
                  </a>
                ) : null}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-semibold text-slate-900">Conversation</h2>
              <div className="mt-4 grid gap-4">
                {claim.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`max-w-[90%] rounded-3xl px-4 py-3 text-sm leading-6 ${
                      message.authorType === "ADMIN"
                        ? "justify-self-start border border-slate-200 bg-slate-50 text-slate-700"
                        : "justify-self-end bg-red-600 text-white"
                    }`}
                  >
                    <div className="text-xs font-semibold uppercase tracking-wide opacity-75">{message.authorName}</div>
                    <div className="mt-2 whitespace-pre-wrap">{message.message}</div>
                    <div className="mt-2 text-[11px] opacity-75">{formatClaimDate(message.createdAt)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <aside className="grid gap-4">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Historique d'actions</p>
          <div className="mt-4 grid gap-4 text-sm text-slate-600">
            {claim?.activityLog.map((entry) => (
              <div key={entry.id} className="relative pl-5 before:absolute before:left-0 before:top-1 before:h-2.5 before:w-2.5 before:rounded-full before:bg-red-500">
                <div className="font-semibold text-slate-800">{entry.description}</div>
                <div>{entry.actorName} • {formatClaimDate(entry.createdAt)}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
          <h2 className="text-lg font-semibold">Traite selon un workflow clair</h2>
          <p className="mt-2 text-sm text-slate-300">Statut, SLA, reponses admin et actions internes sont visibles depuis cette fiche.</p>
        </section>
      </aside>
    </div>
  );
}
