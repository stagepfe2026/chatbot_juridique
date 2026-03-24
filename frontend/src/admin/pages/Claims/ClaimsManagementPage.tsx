
import { useCallback, useEffect, useMemo, useState } from "react";
import { listAdminClaims, replyToClaim } from "../../../services/claims.service";
import type { Claim, ClaimCategory, ClaimPriority, ClaimStatus } from "../../../models/claim.models";
import { publishSnackbar } from "../../../utils/snackbarBus";
import { buildWebSocketUrl } from "../../../services/realtime.service";

const categoryMap: Record<ClaimCategory, string> = { ACCOUNT: "Compte", CHATBOT: "Chatbot", DOCUMENT: "Documents", OTHER: "Autre" };
const priorityMap: Record<ClaimPriority, string> = { LOW: "Basse", NORMAL: "Normale", HIGH: "Haute", URGENT: "Urgente" };

function statusLabel(value: ClaimStatus): string {
  return value === "ANSWERED" ? "Traitee" : "En attente";
}

export default function ClaimsManagementPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadClaims = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listAdminClaims();
      setClaims(data.map((c) => ({ ...c, priority: c.priority ?? "NORMAL", pageContext: c.pageContext ?? "" })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadClaims();
  }, [loadClaims]);

  useEffect(() => {
    const socket = new WebSocket(buildWebSocketUrl("/ws/claims"));
    socket.onmessage = () => void loadClaims();
    return () => socket.close();
  }, [loadClaims]);

  const selectedClaim = useMemo(() => claims.find((claim) => claim.id === selectedId) ?? null, [claims, selectedId]);

  async function onReply(claimId: string) {
    const message = (replyDrafts[claimId] ?? "").trim();
    if (message.length < 3) {
      return publishSnackbar({ variant: "warning", message: "Reponse trop courte" });
    }

    setSavingId(claimId);
    try {
      await replyToClaim(claimId, { message });
      setReplyDrafts((prev) => ({ ...prev, [claimId]: "" }));
      setSelectedId(null);
      await loadClaims();
      publishSnackbar({ variant: "success", message: "Reponse envoyee" });
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-xl border border-white/70 bg-white/90 p-4 shadow-sm">
        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-red-400">Support desk</div>
        <h1 className="mt-1 text-2xl font-black text-slate-900">Gestion des reclamations</h1>
      </section>

      <section className="rounded-xl border border-white/70 bg-white/90 p-4 shadow-sm">
        <div className="overflow-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Utilisateur</th>
                <th className="px-3 py-2">Priorite</th>
                <th className="px-3 py-2">Categorie</th>
                <th className="px-3 py-2">Statut</th>
                <th className="px-3 py-2 text-right">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">Chargement...</td></tr> : null}
              {!loading && claims.length === 0 ? <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">Aucune reclamation</td></tr> : null}
              {!loading && claims.map((claim) => (
                <tr key={claim.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-700">{claim.userEmail}</td>
                  <td className="px-3 py-2 text-slate-600">{priorityMap[claim.priority ?? "NORMAL"]}</td>
                  <td className="px-3 py-2 text-slate-600">{categoryMap[claim.category]}</td>
                  <td className="px-3 py-2">
                    <span className={claim.status === "ANSWERED" ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700" : "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700"}>{statusLabel(claim.status)}</span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" onClick={() => setSelectedId(claim.id)} className="h-9 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-bold text-red-700 transition hover:border-red-300 hover:bg-red-100">Details</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selectedClaim ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/45 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl border border-white/80 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-red-400">Details reclamation</div>
                <h2 className="mt-1 text-xl font-black text-slate-900">{selectedClaim.subject}</h2>
              </div>
              <button type="button" onClick={() => setSelectedId(null)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">Fermer</button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700"><span className="font-bold text-slate-900">Utilisateur:</span> {selectedClaim.userEmail}</div>
              <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700"><span className="font-bold text-slate-900">Date:</span> {new Date(selectedClaim.createdAt).toLocaleString("fr-FR")}</div>
              <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700"><span className="font-bold text-slate-900">Categorie:</span> {categoryMap[selectedClaim.category]}</div>
              <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700"><span className="font-bold text-slate-900">Priorite:</span> {priorityMap[selectedClaim.priority ?? "NORMAL"]}</div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Description</div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{selectedClaim.description}</p>
              <p className="mt-2 text-xs text-slate-500">Page/Lien: {selectedClaim.pageContext || "-"}</p>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Captures d'ecran</div>
              {selectedClaim.attachments.length === 0 ? <p className="mt-2 text-sm text-slate-500">Aucune capture.</p> : (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {selectedClaim.attachments.map((file, index) => (
                    <a key={selectedClaim.id + "-img-" + index} href={file.dataUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                      <img src={file.dataUrl} alt={"Capture " + (index + 1)} className="h-44 w-full object-cover" />
                    </a>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Message utilisateur</div>
              <textarea rows={4} value={replyDrafts[selectedClaim.id] ?? ""} onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [selectedClaim.id]: e.target.value }))} className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-red-300 focus:ring-2 focus:ring-red-100" placeholder="Ecrire votre message..." />
              <div className="mt-3 flex justify-end">
                <button type="button" onClick={() => { void onReply(selectedClaim.id); }} disabled={savingId === selectedClaim.id} className="h-10 rounded-xl bg-red-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60">{savingId === selectedClaim.id ? "Envoi..." : "Envoyer"}</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
