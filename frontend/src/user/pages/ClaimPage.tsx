
import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { createClaim, listMyClaims, markMyClaimsRepliesAsRead } from "../../services/claims.service";
import { publishSnackbar } from "../../utils/snackbarBus";
import type { Claim, ClaimAttachment, ClaimCategory, ClaimPriority, ClaimStatus } from "../../models/claim.models";

const categories: Array<{ value: ClaimCategory; label: string }> = [
  { value: "ACCOUNT", label: "Compte" },
  { value: "CHATBOT", label: "Chatbot" },
  { value: "DOCUMENT", label: "Documents" },
  { value: "OTHER", label: "Autre" },
];

const priorities: Array<{ value: ClaimPriority; label: string }> = [
  { value: "LOW", label: "Basse" },
  { value: "NORMAL", label: "Normale" },
  { value: "HIGH", label: "Haute" },
  { value: "URGENT", label: "Urgente" },
];

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Erreur lecture fichier"));
    reader.readAsDataURL(file);
  });
}

export default function ClaimPage() {
  const [tab, setTab] = useState<"NEW" | "LIST">("NEW");
  const [category, setCategory] = useState<ClaimCategory>("CHATBOT");
  const [priority, setPriority] = useState<ClaimPriority>("NORMAL");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [pageContext, setPageContext] = useState("");
  const [attachments, setAttachments] = useState<ClaimAttachment[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [statusFilter, setStatusFilter] = useState<"ALL" | ClaimStatus>("ALL");
  const [sending, setSending] = useState(false);
  const completion = useMemo(() => {
    let value = 20;
    if (subject.trim().length >= 3) value += 20;
    if (description.trim().length >= 10) value += 30;
    if (pageContext.trim().length > 0) value += 20;
    if (attachments.length > 0) value += 10;
    return Math.min(value, 100);
  }, [subject, description, pageContext, attachments.length]);

  useEffect(() => {
    if (tab !== "LIST") return;
    (async () => {
      const data = await listMyClaims();
      setClaims(data.map((c) => ({ ...c, priority: c.priority ?? "NORMAL", pageContext: c.pageContext ?? "" })));
      await markMyClaimsRepliesAsRead();
    })();
  }, [tab]);

  async function onFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.currentTarget.value = "";
    if (files.length === 0) return;
    const accepted = files.filter((f) => f.type.startsWith("image/") && f.size <= 3 * 1024 * 1024).slice(0, 4);
    const prepared = await Promise.all(
      accepted.map(async (file) => ({
        name: file.name,
        mimeType: file.type,
        size: file.size,
        dataUrl: await toDataUrl(file),
      }))
    );
    setAttachments(prepared);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (subject.trim().length < 3 || description.trim().length < 10) {
      publishSnackbar({ variant: "warning", message: "Veuillez completer les champs" });
      return;
    }
    try {
      setSending(true);
      await createClaim({ category, priority, subject, description, pageContext, attachments });
      setSubject("");
      setDescription("");
      setPageContext("");
      setAttachments([]);
      publishSnackbar({ variant: "success", message: "Reclamation envoyee" });
      setTab("LIST");
    } finally {
      setSending(false);
    }
  }


  useEffect(() => {
    (async () => {
      const data = await listMyClaims();
      setClaims(data.map((c) => ({ ...c, priority: c.priority ?? "NORMAL", pageContext: c.pageContext ?? "" })));
    })();
  }, []);

  const rows = claims.filter((c) => statusFilter === "ALL" || c.status === statusFilter);

  useEffect(() => {
    const unread = claims.filter((c) => c.status === "ANSWERED" && !c.isReplyReadByUser).length;
    window.dispatchEvent(new CustomEvent("claims-unread-changed", { detail: unread }));
  }, [claims]);

  return (
    <div className="mx-auto grid max-w-6xl gap-4">
      <section className="rounded-xl border border-white/70 bg-white/95 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-red-400">Support utilisateur</div>
            <h1 className="text-2xl font-black text-slate-900">Reclamations {claims.filter((c) => c.status === "ANSWERED" && !c.isReplyReadByUser).length > 0 ? `(${claims.filter((c) => c.status === "ANSWERED" && !c.isReplyReadByUser).length})` : ""}</h1>
            <p className="text-sm text-slate-500">Dossier clair et suivi des reponses</p>
          </div>
          <div className="inline-flex rounded-xl bg-slate-100 p-1">
            <button type="button" onClick={() => setTab("NEW")} className={tab === "NEW" ? "rounded-lg border border-red-600 bg-red-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition" : "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-red-200 hover:text-red-600"}>Nouvelle reclamation</button>
            <button type="button" onClick={() => setTab("LIST")} className={tab === "LIST" ? "rounded-lg border border-red-600 bg-red-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition" : "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-red-200 hover:text-red-600"}>Mes reclamations {claims.filter((c) => c.status === "ANSWERED" && !c.isReplyReadByUser).length > 0 ? `(${claims.filter((c) => c.status === "ANSWERED" && !c.isReplyReadByUser).length})` : ""}</button>
          </div>
        </div>
      </section>
      {tab === "NEW" ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
          <form onSubmit={onSubmit} className="grid gap-3 rounded-xl border border-white/60 bg-white/90 p-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-2">
              <select value={category} onChange={(e) => setCategory(e.target.value as ClaimCategory)} className="h-10 rounded-lg border border-slate-200 px-3">{categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
              <select value={priority} onChange={(e) => setPriority(e.target.value as ClaimPriority)} className="h-10 rounded-lg border border-slate-200 px-3">{priorities.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select>
            </div>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Sujet" className="h-10 rounded-lg border border-slate-200 px-3" />
            <textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description detaillee" className="rounded-lg border border-slate-200 px-3 py-2" />
            <div className="grid gap-3 md:grid-cols-2">
              <input value={pageContext} onChange={(e) => setPageContext(e.target.value)} placeholder="Lien ou page concernee" className="h-10 rounded-lg border border-slate-200 px-3" />
              <input value={new Date().toLocaleString("fr-FR")} readOnly className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-slate-500" />
            </div>
            <input type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={onFilesChange} className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm" />
            <p className="text-xs text-slate-500">Formats acceptes: PNG, JPG, WEBP. Taille max: 3 MB.</p>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-700"><span>Completude du dossier</span><span>{completion}%</span></div><div className="h-2 rounded-full bg-slate-200"><div className="h-2 rounded-full bg-red-600" style={{ width: `${completion}%` }} /></div><p className="mt-2 text-xs text-slate-500">Ajoutez plus de details pour accelerer le traitement.</p></div>
            <div className="flex justify-end"><button type="submit" disabled={sending} className="h-10 rounded-xl bg-red-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60">{sending ? "Envoi..." : "Envoyer la reclamation"}</button></div>
          </form>
          <aside className="grid gap-4">
            <div className="rounded-xl border border-white/70 bg-white/95 p-4 shadow-sm"><div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Conseils</div><div className="mt-3 grid gap-2 text-sm text-slate-600"><div className="rounded-lg bg-slate-50 p-2">Choisissez la bonne categorie</div><div className="rounded-lg bg-slate-50 p-2">Ajoutez des etapes claires</div><div className="rounded-lg bg-slate-50 p-2">Priorite urgente pour blocage critique</div></div></div>
            <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-red-900 shadow-sm"><div className="text-[11px] font-bold uppercase tracking-[0.2em] text-red-400">Bonnes pratiques</div><p className="mt-2 text-sm text-red-800">Sujet, description et page concernee rendent le traitement plus rapide.</p></div>
          </aside>
        </div>
      ) : (
        <section className="rounded-xl border border-white/70 bg-white/95 p-4 shadow-sm">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "ALL" | ClaimStatus)} className="mb-3 h-10 rounded-lg border border-slate-200 px-3"><option value="ALL">Tous statuts</option><option value="SUBMITTED">En attente</option><option value="ANSWERED">Traitee</option></select>
          <div className="overflow-auto rounded-xl border border-slate-200 bg-white"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2">Sujet</th><th className="px-3 py-2">Categorie</th><th className="px-3 py-2">Priorite</th><th className="px-3 py-2">Statut</th><th className="px-3 py-2">Message admin</th></tr></thead><tbody>{rows.length === 0 ? <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">Aucune reclamation</td></tr> : rows.map((claim) => <tr key={claim.id} className="border-t border-slate-100"><td className="px-3 py-2 font-semibold text-slate-800">{claim.subject}</td><td className="px-3 py-2 text-slate-600">{claim.category}</td><td className="px-3 py-2 text-slate-600">{claim.priority ?? "NORMAL"}</td><td className="px-3 py-2"><span className={claim.status === "ANSWERED" ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700" : "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700"}>{statusLabel(claim.status)}</span></td><td className="px-3 py-2 text-slate-600">{claim.adminReply || "Aucun message"}</td></tr>)}</tbody></table></div>
        </section>
      )}
    </div>
  );
}

function statusLabel(status: ClaimStatus): string {
  return status === "ANSWERED" ? "Traitee" : "En attente";
}







