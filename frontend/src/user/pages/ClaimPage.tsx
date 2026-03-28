import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link } from "react-router-dom";
import { createClaim, listMyClaims, markMyClaimsRepliesAsRead } from "../../services/claims.service";
import { publishSnackbar } from "../../utils/snackbarBus";
import {
  claimCategoryLabels,
  claimPriorityLabels,
  claimStatusLabels,
  type Claim,
  type ClaimActivityLogEntry,
  type ClaimAttachment,
  type ClaimCategory,
  type ClaimPriority,
  type ClaimStatus,
} from "../../models/claim.models";
import { formatClaimDate, priorityBadgeClass, statusBadgeClass } from "../../claims/claimUi";

const categories: Array<{ value: ClaimCategory; label: string }> = [
  { value: "ACCOUNT", label: "Compte" },
  { value: "CHATBOT", label: "Chatbot" },
  { value: "DOCUMENT", label: "Documents" },
  { value: "OTHER", label: "Autre" },
];

const CHAT_CLAIM_DRAFT_KEY = "chat-claim-draft";
const FEEDBACK_STORAGE_KEY = "my-claims-resolution-feedback";

const priorities: Array<{ value: ClaimPriority; label: string }> = [
  { value: "LOW", label: "Basse" },
  { value: "NORMAL", label: "Normale" },
  { value: "HIGH", label: "Haute" },
  { value: "URGENT", label: "Urgente" },
];

type DetailedClaimStatus = Exclude<ClaimStatus, "ANSWERED">;
type ResolutionFeedback = "CONFIRMED" | "REOPENED";

type EnrichedClaim = Claim & {
  displayStatus: DetailedClaimStatus;
  ticketNumber: string;
  messageTotal: number;
  summaryReply: string;
  history: ClaimActivityLogEntry[];
};

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
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DetailedClaimStatus | "">("");
  const [categoryFilter, setCategoryFilter] = useState<ClaimCategory | "">("");
  const [priorityFilter, setPriorityFilter] = useState<ClaimPriority | "">("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [resolutionFeedback, setResolutionFeedback] = useState<Record<string, ResolutionFeedback>>(() => readFeedbackState());
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);

  const completion = useMemo(() => {
    let value = 20;
    if (subject.trim().length >= 3) value += 20;
    if (description.trim().length >= 10) value += 30;
    if (pageContext.trim().length > 0) value += 20;
    if (attachments.length > 0) value += 10;
    return Math.min(value, 100);
  }, [subject, description, pageContext, attachments.length]);

  const unreadCount = useMemo(
    () => claims.filter((claim) => claim.status === "ANSWERED" && !claim.isReplyReadByUser).length,
    [claims],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(CHAT_CLAIM_DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as {
        category?: ClaimCategory;
        priority?: ClaimPriority;
        subject?: string;
        description?: string;
        pageContext?: string;
      };
      setCategory(draft.category ?? "CHATBOT");
      setPriority(draft.priority ?? "NORMAL");
      setSubject(draft.subject ?? "");
      setDescription(draft.description ?? "");
      setPageContext(draft.pageContext ?? "/user/chat");
      setTab("NEW");
      window.localStorage.removeItem(CHAT_CLAIM_DRAFT_KEY);
    } catch {
      window.localStorage.removeItem(CHAT_CLAIM_DRAFT_KEY);
    }
  }, []);

  useEffect(() => {
    void loadClaims();
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("claims-unread-changed", { detail: unreadCount }));
  }, [unreadCount]);

  async function loadClaims() {
    const data = await listMyClaims();
    setClaims(data.map((claim) => ({ ...claim, priority: claim.priority ?? "NORMAL", pageContext: claim.pageContext ?? "" })));
  }

  async function onFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.currentTarget.value = "";
    if (files.length === 0) return;
    const accepted = files.filter((file) => file.type.startsWith("image/") && file.size <= 3 * 1024 * 1024).slice(0, 4);
    const prepared = await Promise.all(
      accepted.map(async (file) => ({
        name: file.name,
        mimeType: file.type,
        size: file.size,
        dataUrl: await toDataUrl(file),
      })),
    );
    setAttachments(prepared);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
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
      await loadClaims();
      await markMyClaimsRepliesAsRead();
      setTab("LIST");
    } finally {
      setSending(false);
    }
  }

  function onResolutionFeedback(claimId: string, feedback: ResolutionFeedback) {
    const next = { ...resolutionFeedback, [claimId]: feedback };
    setResolutionFeedback(next);
    writeFeedbackState(next);
    publishSnackbar({
      variant: feedback === "CONFIRMED" ? "success" : "info",
      message: feedback === "CONFIRMED" ? "Le ticket a ete marque comme ferme." : "Le ticket reste en traitement.",
    });
  }

  const enrichedClaims = useMemo<EnrichedClaim[]>(() => {
    return claims
      .map((claim, index) => enrichClaim(claim, index, resolutionFeedback[claim.id]))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [claims, resolutionFeedback]);

  const filteredClaims = useMemo(() => {
    const normalizedSearch = normalizeText(search);
    const fromTs = createdFrom ? new Date(`${createdFrom}T00:00:00`).getTime() : null;
    const toTs = createdTo ? new Date(`${createdTo}T23:59:59`).getTime() : null;

    return enrichedClaims.filter((claim) => {
      if (statusFilter && claim.displayStatus !== statusFilter) return false;
      if (categoryFilter && claim.category !== categoryFilter) return false;
      if (priorityFilter && (claim.priority ?? "NORMAL") !== priorityFilter) return false;

      if (normalizedSearch) {
        const haystack = normalizeText([
          claim.subject,
          claim.description,
          claim.summaryReply,
          claim.ticketNumber,
          claimCategoryLabels[claim.category],
        ].join(" "));
        if (!haystack.includes(normalizedSearch)) return false;
      }

      const createdAtTs = new Date(claim.createdAt).getTime();
      if (fromTs !== null && createdAtTs < fromTs) return false;
      if (toTs !== null && createdAtTs > toTs) return false;
      return true;
    });
  }, [categoryFilter, createdFrom, createdTo, enrichedClaims, priorityFilter, search, statusFilter]);

  const stats = useMemo(() => ({
    total: filteredClaims.length,
    open: filteredClaims.filter((claim) => ["SUBMITTED", "UNDER_REVIEW", "PROCESSING"].includes(claim.displayStatus)).length,
    resolved: filteredClaims.filter((claim) => claim.displayStatus === "RESOLVED").length,
    closed: filteredClaims.filter((claim) => claim.displayStatus === "CLOSED").length,
  }), [filteredClaims]);

  const recentActions = useMemo(() => {
    return filteredClaims
      .flatMap((claim) => claim.history.map((entry) => ({ ...entry, ticketNumber: claim.ticketNumber, subject: claim.subject })))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6);
  }, [filteredClaims]);

  const selectedClaim = useMemo(
    () => filteredClaims.find((claim) => claim.id === selectedClaimId) ?? null,
    [filteredClaims, selectedClaimId],
  );

  return (
    <div className="relative left-1/2 w-screen max-w-none -translate-x-1/2 space-y-6 px-4">
      <section className=" px-5 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Espace reclamations</p>
            <h1 className="mt-1 text-xl font-semibold text-slate-950">Reclamations {unreadCount > 0 ? `(${unreadCount})` : ""}</h1>
          </div>
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button type="button" onClick={() => setTab("NEW")} className={tab === "NEW" ? "rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white transition" : "rounded-lg px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-white hover:text-slate-900"}>Nouvelle reclamation</button>
            <button type="button" onClick={() => setTab("LIST")} className={tab === "LIST" ? "rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white transition" : "rounded-lg px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-white hover:text-slate-900"}>Mes reclamations {unreadCount > 0 ? `(${unreadCount})` : ""}</button>
          </div>
        </div>
      </section>

      {tab === "NEW" ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
          <form onSubmit={onSubmit} className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-3 md:grid-cols-2">
              <select value={category} onChange={(e) => setCategory(e.target.value as ClaimCategory)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none transition focus:border-slate-400">{categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
              <select value={priority} onChange={(e) => setPriority(e.target.value as ClaimPriority)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none transition focus:border-slate-400">{priorities.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select>
            </div>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Sujet" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none transition focus:border-slate-400" />
            <textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description detaillee" className="min-h-[140px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-700 outline-none transition focus:border-slate-400" />
            <div className="grid gap-3 md:grid-cols-2">
              <input value={pageContext} onChange={(e) => setPageContext(e.target.value)} placeholder="Lien ou page concernee" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none transition focus:border-slate-400" />
              <input value={new Date().toLocaleString("fr-FR")} readOnly className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] text-slate-500" />
            </div>
            <input type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={onFilesChange} className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-[13px] text-slate-600" />
            <p className="text-xs text-slate-500">Formats acceptes: PNG, JPG, WEBP. Taille max: 3 MB.</p>
            {attachments.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {attachments.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <img src={file.dataUrl} alt={file.name} className="h-28 w-full object-cover" />
                    <div className="space-y-1 px-3 py-2">
                      <div className="truncate text-xs font-semibold text-slate-800">{file.name}</div>
                      <div className="text-[11px] text-slate-500">{Math.round(file.size / 1024)} KB</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3"><div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-700"><span>Completude du dossier</span><span>{completion}%</span></div><div className="h-2 rounded-full bg-slate-200"><div className="h-2 rounded-full bg-red-600" style={{ width: `${completion}%` }} /></div><p className="mt-2 text-xs text-slate-500">Ajoutez plus de details pour accelerer le traitement.</p></div>
            <div className="flex justify-end"><button type="submit" disabled={sending} className="h-10 rounded-xl bg-slate-900 px-4 text-[13px] font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60">{sending ? "Envoi..." : "Envoyer la reclamation"}</button></div>
          </form>
          <aside className="grid gap-3">
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Bonnes pratiques</div><div className="mt-3 grid gap-2 text-[13px] text-slate-600"><div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">Choisissez la categorie la plus proche du sujet traite.</div><div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">Decrivez clairement le contexte et les etapes deja realisees.</div><div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">Utilisez la priorite urgente uniquement en cas de blocage reel.</div></div></div>
          </aside>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Mot-cle, sujet ou ticket" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none transition focus:border-slate-400 xl:col-span-2" />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as DetailedClaimStatus | "")} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none transition focus:border-slate-400">
                <option value="">Tous les statuts</option>
                <option value="SUBMITTED">{claimStatusLabels.SUBMITTED}</option>
                <option value="UNDER_REVIEW">{claimStatusLabels.UNDER_REVIEW}</option>
                <option value="PROCESSING">{claimStatusLabels.PROCESSING}</option>
                <option value="RESOLVED">{claimStatusLabels.RESOLVED}</option>
                <option value="CLOSED">{claimStatusLabels.CLOSED}</option>
              </select>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as ClaimCategory | "")} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none transition focus:border-slate-400">
                <option value="">Toutes les categories</option>
                {Object.entries(claimCategoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as ClaimPriority | "")} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none transition focus:border-slate-400">
                <option value="">Toutes les priorites</option>
                {Object.entries(claimPriorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
              <input type="date" value={createdFrom} onChange={(e) => setCreatedFrom(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none transition focus:border-slate-400" />
              <input type="date" value={createdTo} onChange={(e) => setCreatedTo(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none transition focus:border-slate-400" />
              <button type="button" onClick={() => { setSearch(""); setStatusFilter(""); setCategoryFilter(""); setPriorityFilter(""); setCreatedFrom(""); setCreatedTo(""); }} className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50">Reinitialiser</button>
            </div>

            <div className="mt-4 grid gap-2 md:grid-cols-4">
              <StatCard label="Tickets" value={String(stats.total)} helper="Apres filtrage" />
              <StatCard label="Ouverts" value={String(stats.open)} helper="Soumise a en traitement" />
              <StatCard label="Resolus" value={String(stats.resolved)} helper="Attente confirmation" />
              <StatCard label="Fermes" value={String(stats.closed)} helper="Dossiers clotures" />
            </div>

            <div className="mt-4 grid gap-3">
              {filteredClaims.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">Aucune reclamation ne correspond aux filtres actifs.</div> : null}
              {filteredClaims.map((claim) => (
                <article key={claim.id} className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        <span>{claim.ticketNumber}</span>
                        <span className="h-1 w-1 rounded-full bg-slate-300" />
                        <span>{claimCategoryLabels[claim.category]}</span>
                      </div>
                      <h2 className="mt-1 text-[15px] font-semibold text-slate-900">{claim.subject}</h2>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${statusBadgeClass(claim.displayStatus)}`}>{claimStatusLabels[claim.displayStatus]}</span>
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${priorityBadgeClass(claim.priority ?? "NORMAL")}`}>{claimPriorityLabels[claim.priority ?? "NORMAL"]}</span>
                      </div>
                      <p className="mt-2 text-[12px] text-slate-500">Mise a jour le {formatClaimDate(claim.updatedAt)}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedClaimId(claim.id)}
                        className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Details
                      </button>
                      <Link to={`/user/reclamations/${claim.id}`} className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-slate-800">Voir dossier</Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <aside className="grid gap-3">
            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Workflow</p>
              <div className="mt-3 grid gap-2 text-[13px] text-slate-600">
                <WorkflowRow label={claimStatusLabels.SUBMITTED} helper="Ticket cree et enregistre" />
                <WorkflowRow label={claimStatusLabels.UNDER_REVIEW} helper="Analyse initiale du dossier" />
                <WorkflowRow label={claimStatusLabels.PROCESSING} helper="Traitement par le service" />
                <WorkflowRow label={claimStatusLabels.RESOLVED} helper="Reponse fournie" />
                <WorkflowRow label={claimStatusLabels.CLOSED} helper="Demande cloturee" />
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Actions recentes</p>
              <div className="mt-3 grid gap-3">
                {recentActions.length === 0 ? <p className="text-[12px] text-slate-500">Votre historique apparaitra ici.</p> : null}
                {recentActions.slice(0, 4).map((entry) => (
                  <div key={entry.id} className="relative pl-4 text-[12px] text-slate-600 before:absolute before:left-0 before:top-1 before:h-1.5 before:w-1.5 before:rounded-full before:bg-slate-500">
                    <div className="font-semibold text-slate-800">{entry.description}</div>
                    <div>{entry.ticketNumber}</div>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      )}

      {tab === "LIST" && selectedClaim ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30 backdrop-blur-[2px]">
          <div className="flex h-full w-full max-w-3xl flex-col overflow-y-auto border-l border-slate-200 bg-white px-5 py-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#DA3D20]">Inspection</div>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">Details de la reclamation</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedClaimId(null)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
              >
                <span className="text-lg">?</span>
              </button>
            </div>

            <div className="mt-6 grid gap-4">
              <section className="rounded-[24px] bg-slate-50 px-4 py-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{selectedClaim.ticketNumber}</div>
                <div className="mt-1 text-lg font-semibold text-slate-950">{selectedClaim.subject}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${statusBadgeClass(selectedClaim.displayStatus)}`}>{claimStatusLabels[selectedClaim.displayStatus]}</span>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${priorityBadgeClass(selectedClaim.priority ?? "NORMAL")}`}>{claimPriorityLabels[selectedClaim.priority ?? "NORMAL"]}</span>
                </div>
                <p className="mt-3 text-[13px] leading-5 text-slate-600">{selectedClaim.description}</p>
              </section>

              <section className="rounded-[24px] bg-slate-50 px-4 py-4">
                <div className="text-sm font-semibold text-slate-950">Informations generales</div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <InfoRow label="Categorie" value={claimCategoryLabels[selectedClaim.category]} />
                  <InfoRow label="Date de creation" value={formatClaimDate(selectedClaim.createdAt)} />
                  <InfoRow label="Derniere mise a jour" value={formatClaimDate(selectedClaim.updatedAt)} />
                  <InfoRow label="Agent charge" value={selectedClaim.assignedAgent?.name || "Affectation en attente"} />
                  <InfoRow label="Echeance" value={selectedClaim.dueAt ? formatClaimDate(selectedClaim.dueAt) : "Echeance en calcul"} />
                  <InfoRow label="Nombre d'echanges" value={`${selectedClaim.messageTotal}`} />
                </div>
              </section>

              <section className="rounded-[24px] bg-slate-50 px-4 py-4">
                <div className="text-sm font-semibold text-slate-950">Derniere reponse</div>
                <p className="mt-3 text-[13px] leading-6 text-slate-600">{selectedClaim.summaryReply}</p>
              </section>

              <section className="rounded-[24px] bg-slate-50 px-4 py-4">
                <div className="text-sm font-semibold text-slate-950">Historique des actions</div>
                <div className="mt-3 grid gap-3">
                  {selectedClaim.history.map((entry) => (
                    <div key={entry.id} className="relative pl-4 text-[12px] text-slate-600 before:absolute before:left-0 before:top-1.5 before:h-1.5 before:w-1.5 before:rounded-full before:bg-slate-500">
                      <div className="font-semibold text-slate-800">{entry.description}</div>
                      <div>{entry.actorName} | {formatClaimDate(entry.createdAt)}</div>
                    </div>
                  ))}
                </div>
              </section>

              {selectedClaim.displayStatus === "RESOLVED" ? (
                <section className="rounded-[24px] bg-slate-50 px-4 py-4">
                  <div className="text-sm font-semibold text-slate-950">Confirmation utilisateur</div>
                  <p className="mt-2 text-[12px] text-slate-600">Confirmez si le probleme est resolu ou demandez la poursuite du traitement.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => onResolutionFeedback(selectedClaim.id, "CONFIRMED")} className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-slate-800">Probleme resolu</button>
                    <button type="button" onClick={() => onResolutionFeedback(selectedClaim.id, "REOPENED")} className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50">Poursuivre le traitement</button>
                  </div>
                </section>
              ) : null}

              <section className="rounded-[24px] bg-slate-50 px-4 py-4">
                <div className="text-sm font-semibold text-slate-950">Actions</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link to={`/user/reclamations/${selectedClaim.id}`} className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50">Voir le dossier complet</Link>
                  {selectedClaim.pageContext ? <a href={selectedClaim.pageContext} className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-3 py-1.5 text-[12px] font-semibold text-white no-underline transition hover:bg-slate-800">Ouvrir la page concernee</a> : null}
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
function StatCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-900">{value}</div>
      <div className="mt-1 text-[11px] text-slate-500">{helper}</div>
    </div>
  );
}
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className="mt-1 text-[13px] font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function WorkflowRow({ label, helper }: { label: string; helper: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
      <div className="font-semibold text-slate-800">{label}</div>
      <div className="mt-1 text-[11px] text-slate-500">{helper}</div>
    </div>
  );
}

function readFeedbackState(): Record<string, ResolutionFeedback> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(FEEDBACK_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ResolutionFeedback>) : {};
  } catch {
    return {};
  }
}

function writeFeedbackState(state: Record<string, ResolutionFeedback>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(state));
}

function enrichClaim(claim: Claim, index: number, feedback?: ResolutionFeedback): EnrichedClaim {
  const priority = claim.priority ?? "NORMAL";
  const displayStatus = toDetailedStatus(claim.status, feedback);
  const ticketNumber = buildTicketNumber(claim, index);
  const dueAt = claim.dueAt ?? addHours(claim.createdAt, priority === "URGENT" ? 12 : priority === "HIGH" ? 24 : 48);
  const history = buildHistory(claim, displayStatus, feedback);

  return {
    ...claim,
    priority,
    assignedAgent: claim.assignedAgent ?? (displayStatus !== "SUBMITTED" ? { id: `agent-${claim.id}`, name: "Service reclamations" } : null),
    dueAt,
    displayStatus,
    ticketNumber,
    messageTotal: claim.messageCount ?? (claim.adminReply ? 2 : 1),
    summaryReply: claim.lastAdminReplyPreview ?? claim.adminReply ?? "Aucune reponse administrative pour le moment.",
    history,
  };
}

function toDetailedStatus(status: ClaimStatus, feedback?: ResolutionFeedback): DetailedClaimStatus {
  if (feedback == "CONFIRMED") return "CLOSED";
  if (feedback == "REOPENED") return "PROCESSING";
  if (status === "ANSWERED") return "RESOLVED";
  return status === "CLOSED" || status === "RESOLVED" || status === "PROCESSING" || status === "UNDER_REVIEW" ? status : "SUBMITTED";
}

function buildTicketNumber(claim: Claim, index: number) {
  const year = new Date(claim.createdAt).getFullYear();
  const serialBase = `${claim.id}${claim.createdAt}`.split("").reduce((total, char) => total + char.charCodeAt(0), 0);
  const serial = String((serialBase + index + 1) % 10000).padStart(4, "0");
  return `REC-${year}-${serial}`;
}

function buildHistory(claim: Claim, displayStatus: DetailedClaimStatus, feedback?: ResolutionFeedback): ClaimActivityLogEntry[] {
  if (claim.activityLog?.length) return claim.activityLog;

  const entries: ClaimActivityLogEntry[] = [
    { id: `${claim.id}-created`, description: "Reclamation creee", actorName: "Utilisateur", createdAt: claim.createdAt },
  ];

  if (["UNDER_REVIEW", "PROCESSING", "RESOLVED", "CLOSED"].includes(displayStatus)) {
    entries.push({ id: `${claim.id}-review`, description: "Prise en charge pour analyse", actorName: "Service reclamations", createdAt: addHours(claim.createdAt, 2) });
  }
  if (["PROCESSING", "RESOLVED", "CLOSED"].includes(displayStatus)) {
    entries.push({ id: `${claim.id}-processing`, description: "Dossier en traitement", actorName: claim.adminReplyBy || "Agent instructeur", createdAt: addHours(claim.createdAt, 8) });
  }
  if (["RESOLVED", "CLOSED"].includes(displayStatus)) {
    entries.push({ id: `${claim.id}-reply`, description: claim.adminReply ? "Reponse administrative transmise" : "Resolution communiquee", actorName: claim.adminReplyBy || "Administration", createdAt: claim.adminReplyAt || claim.updatedAt });
  }
  if (feedback === "CONFIRMED" || displayStatus === "CLOSED") {
    entries.push({ id: `${claim.id}-closed`, description: "Cloture du ticket", actorName: feedback === "CONFIRMED" ? "Utilisateur" : "Administration", createdAt: addHours(claim.updatedAt, 4) });
  }
  if (feedback === "REOPENED") {
    entries.push({ id: `${claim.id}-reopened`, description: "Utilisateur a demande la poursuite du traitement", actorName: "Utilisateur", createdAt: addHours(claim.updatedAt, 4) });
  }

  return entries.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

function addHours(value: string, hours: number) {
  const date = new Date(value);
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

function normalizeText(value: string) {
  return value.toLocaleLowerCase("fr-FR").normalize("NFD").replace(/[̀-ͯ]/g, "");
}




