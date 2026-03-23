
import { useEffect, useMemo, useState } from "react";
import { listAdminClaims, replyToClaim } from "../../../services/claims.service";
import type { Claim, ClaimCategory, ClaimPriority, ClaimStatus } from "../../../models/claim.models";
import { publishSnackbar } from "../../../utils/snackbarBus";
import { buildWebSocketUrl } from "../../../services/realtime.service";

export default function ClaimsManagementPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [userFilter, setUserFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | ClaimCategory>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | ClaimStatus>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<"ALL" | ClaimPriority>("ALL");
  const [savingClaimId, setSavingClaimId] = useState<string | null>(null);
  async function loadClaims() {
    setLoading(true);
    try {
      const data = await listAdminClaims();
      setClaims(data.map((c) => ({ ...c, priority: c.priority ?? "NORMAL", pageContext: c.pageContext ?? "" })));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void loadClaims(); }, []);
  useEffect(() => {
    const socket = new WebSocket(buildWebSocketUrl("/ws/claims"));
    socket.onmessage = () => { void loadClaims(); };
    return () => socket.close();
  }, []);
  const rows = useMemo(() => {
    return claims.filter((claim) => {
      const okUser = userFilter.trim().length === 0 || claim.userEmail.toLowerCase().includes(userFilter.toLowerCase());
      const okCategory = categoryFilter === "ALL" || claim.category === categoryFilter;
      const okStatus = statusFilter === "ALL" || claim.status === statusFilter;
      const okPriority = priorityFilter === "ALL" || (claim.priority ?? "NORMAL") === priorityFilter;
      return okUser && okCategory && okStatus && okPriority;
    });
  }, [claims, userFilter, categoryFilter, statusFilter, priorityFilter]);
  async function onReply(claimId: string) {
    const message = (replyDrafts[claimId] ?? "").trim();
    if (message.length < 3) return publishSnackbar({ variant: "warning", message: "Reponse trop courte" });
    setSavingClaimId(claimId);
    try {
      await replyToClaim(claimId, { message });
      setReplyDrafts((prev) => ({ ...prev, [claimId]: "" }));
      await loadClaims();
      publishSnackbar({ variant: "success", message: "Reponse envoyee" });
    } finally {
      setSavingClaimId(null);
    }
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-xl border border-white/60 bg-white/90 p-4 shadow-sm">
        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-red-400">Support desk</div>
        <h1 className="mt-1 text-2xl font-black text-slate-900">Gestion des reclamations</h1>
        <div className="mt-3 grid gap-2 md:grid-cols-5">
          
          <input value={userFilter} onChange={(e) => setUserFilter(e.target.value)} placeholder="Utilisateur" className="h-10 rounded-lg border border-slate-200 px-3" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "ALL" | ClaimStatus)} className="h-10 rounded-lg border border-slate-200 px-3"><option value="ALL">Tous statuts</option><option value="SUBMITTED">En attente</option><option value="ANSWERED">Traitee</option></select>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as "ALL" | ClaimCategory)} className="h-10 rounded-lg border border-slate-200 px-3"><option value="ALL">Toutes categories</option><option value="ACCOUNT">Compte</option><option value="CHATBOT">Chatbot</option><option value="DOCUMENT">Documents</option><option value="OTHER">Autre</option></select>
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as "ALL" | ClaimPriority)} className="h-10 rounded-lg border border-slate-200 px-3"><option value="ALL">Toutes priorites</option><option value="LOW">Basse</option><option value="NORMAL">Normale</option><option value="HIGH">Haute</option><option value="URGENT">Urgente</option></select>
        </div>
      </section>
      <section className="rounded-xl border border-white/60 bg-white/90 p-4 shadow-sm">
        <div className="overflow-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2">Utilisateur</th><th className="px-3 py-2">Sujet</th><th className="px-3 py-2">Categorie</th><th className="px-3 py-2">Priorite</th><th className="px-3 py-2">Statut</th><th className="px-3 py-2">Message admin</th><th className="px-3 py-2">Repondre</th></tr></thead>
            <tbody>{loading ? <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-500">Chargement...</td></tr> : rows.length === 0 ? <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-500">Aucune reclamation</td></tr> : rows.map((claim) => <tr key={claim.id} className="border-t border-slate-100 align-top"><td className="px-3 py-2 text-slate-600">{claim.userEmail}</td><td className="px-3 py-2 text-slate-700"><div className="font-semibold text-slate-800">{claim.subject}</div><div className="text-xs text-slate-500">{new Date(claim.createdAt).toLocaleString("fr-FR")}</div><div className="text-xs text-slate-500">Page: {claim.pageContext || "-"}</div>{claim.attachments.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{claim.attachments.map((a, i) => <a key={`${claim.id}-a-${i}`} href={a.dataUrl} target="_blank" rel="noreferrer" className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">Capture {i + 1}</a>)}</div>}</td><td className="px-3 py-2 text-slate-600">{claim.category}</td><td className="px-3 py-2 text-slate-600">{claim.priority ?? "NORMAL"}</td><td className="px-3 py-2"><span className={claim.status === "ANSWERED" ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700" : "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700"}>{claim.status === "ANSWERED" ? "Traitee" : "En attente"}</span></td><td className="px-3 py-2 text-slate-600">{claim.adminReply || "Aucun message"}</td><td className="px-3 py-2"><textarea rows={2} value={replyDrafts[claim.id] ?? ""} onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [claim.id]: e.target.value }))} className="mb-2 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm" placeholder="Votre reponse" /><button type="button" onClick={() => { void onReply(claim.id); }} disabled={savingClaimId === claim.id} className="h-9 rounded-lg bg-red-600 px-3 text-xs font-bold text-white disabled:opacity-60">{savingClaimId === claim.id ? "Envoi..." : "Envoyer"}</button></td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

