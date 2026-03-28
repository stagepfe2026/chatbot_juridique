import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  claimCategoryLabels,
  claimPriorityLabels,
  claimStatusLabels,
  type Claim,
  type ClaimActivityLogEntry,
  type ClaimCategory,
  type ClaimPriority,
  type ClaimStatus,
} from "../../models/claim.models";
import { listMyClaims } from "../../services/claims.service";
import { formatClaimDate, priorityBadgeClass, statusBadgeClass } from "../../claims/claimUi";
import { publishSnackbar } from "../../utils/snackbarBus";

type DetailedClaimStatus = Exclude<ClaimStatus, "ANSWERED">;
type ResolutionFeedback = "CONFIRMED" | "REOPENED";

type EnrichedClaim = Claim & {
  displayStatus: DetailedClaimStatus;
  ticketNumber: string;
  messageTotal: number;
  summaryReply: string;
  history: ClaimActivityLogEntry[];
};

const FEEDBACK_STORAGE_KEY = "my-claims-resolution-feedback";

export default function MyClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<DetailedClaimStatus | "">("");
  const [category, setCategory] = useState<ClaimCategory | "">("");
  const [priority, setPriority] = useState<ClaimPriority | "">("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [resolutionFeedback, setResolutionFeedback] = useState<Record<string, ResolutionFeedback>>(() => readFeedbackState());

  useEffect(() => {
    void loadClaims();
  }, []);

  async function loadClaims() {
    try {
      setLoading(true);
      const data = await listMyClaims();
      setClaims(data);
    } finally {
      setLoading(false);
    }
  }

  function onResolutionFeedback(claimId: string, feedback: ResolutionFeedback) {
    const next = { ...resolutionFeedback, [claimId]: feedback };
    setResolutionFeedback(next);
    writeFeedbackState(next);
    publishSnackbar({
      variant: feedback === "CONFIRMED" ? "success" : "info",
      message: feedback === "CONFIRMED" ? "Le ticket a ete marque comme ferme." : "Le ticket a ete maintenu en traitement.",
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
      if (status && claim.displayStatus !== status) return false;
      if (category && claim.category !== category) return false;
      if (priority && (claim.priority ?? "NORMAL") !== priority) return false;

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
  }, [category, createdFrom, createdTo, enrichedClaims, priority, search, status]);

  const stats = useMemo(() => {
    return {
      total: filteredClaims.length,
      open: filteredClaims.filter((claim) => ["SUBMITTED", "UNDER_REVIEW", "PROCESSING"].includes(claim.displayStatus)).length,
      resolved: filteredClaims.filter((claim) => claim.displayStatus === "RESOLVED").length,
      closed: filteredClaims.filter((claim) => claim.displayStatus === "CLOSED").length,
    };
  }, [filteredClaims]);

  const recentActions = useMemo(() => {
    return filteredClaims
      .flatMap((claim) => claim.history.map((entry) => ({ ...entry, claimId: claim.id, subject: claim.subject, ticketNumber: claim.ticketNumber })))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8);
  }, [filteredClaims]);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_360px]">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-red-600">Espace utilisateur</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Mes reclamations</h1>
            <p className="mt-1 text-sm text-slate-500">Chaque dossier dispose d'un numero de ticket, d'un suivi de statut detaille et d'un historique des actions.</p>
          </div>
          <Link to="/user/reclamations" className="inline-flex items-center justify-center rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700">
            Nouvelle reclamation
          </Link>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Mot-cle, sujet ou numero de ticket"
            className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-50 xl:col-span-2"
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as DetailedClaimStatus | "")}
            className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-50"
          >
            <option value="">Tous les statuts</option>
            <option value="SUBMITTED">{claimStatusLabels.SUBMITTED}</option>
            <option value="UNDER_REVIEW">{claimStatusLabels.UNDER_REVIEW}</option>
            <option value="PROCESSING">{claimStatusLabels.PROCESSING}</option>
            <option value="RESOLVED">{claimStatusLabels.RESOLVED}</option>
            <option value="CLOSED">{claimStatusLabels.CLOSED}</option>
          </select>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as ClaimCategory | "")}
            className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-50"
          >
            <option value="">Toutes les categories</option>
            {Object.entries(claimCategoryLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value as ClaimPriority | "")}
            className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-50"
          >
            <option value="">Toutes les priorites</option>
            {Object.entries(claimPriorityLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <input type="date" value={createdFrom} onChange={(event) => setCreatedFrom(event.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-50" />
          <input type="date" value={createdTo} onChange={(event) => setCreatedTo(event.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-50" />
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setStatus("");
              setCategory("");
              setPriority("");
              setCreatedFrom("");
              setCreatedTo("");
            }}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-red-200 hover:text-red-600"
          >
            Reinitialiser
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <StatCard label="Tickets affiches" value={String(stats.total)} helper="Apres filtres actifs" />
          <StatCard label="Ouverts" value={String(stats.open)} helper="Soumise, analyse, traitement" />
          <StatCard label="Resolus" value={String(stats.resolved)} helper="En attente de confirmation" />
          <StatCard label="Fermes" value={String(stats.closed)} helper="Traitement cloture" />
        </div>

        <div className="mt-5 grid gap-4">
          {loading ? <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">Chargement des reclamations...</div> : null}
          {!loading && filteredClaims.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">Aucune reclamation ne correspond aux filtres actifs.</div> : null}
          {!loading && filteredClaims.map((claim) => (
            <article key={claim.id} className="rounded-3xl border border-slate-200 bg-white p-5 transition hover:border-red-200 hover:shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    <span>{claim.ticketNumber}</span>
                    <span className="h-1 w-1 rounded-full bg-slate-300" />
                    <span>Cree le {formatClaimDate(claim.createdAt)}</span>
                  </div>
                  <h2 className="mt-2 text-lg font-semibold text-slate-900">{claim.subject}</h2>
                  <p className="mt-1 text-sm text-slate-500">{claimCategoryLabels[claim.category]} | Priorite {claimPriorityLabels[claim.priority ?? "NORMAL"]}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClass(claim.displayStatus)}`}>{claimStatusLabels[claim.displayStatus]}</span>
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${priorityBadgeClass(claim.priority ?? "NORMAL")}`}>{claimPriorityLabels[claim.priority ?? "NORMAL"]}</span>
                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">{claim.messageTotal} echange(s)</span>
                  </div>
                </div>

                <div className="grid gap-2 text-sm text-slate-500 lg:text-right">
                  <div>Derniere mise a jour: {formatClaimDate(claim.updatedAt)}</div>
                  <div>{claim.assignedAgent?.name ? `Charge par ${claim.assignedAgent.name}` : "Affectation en attente"}</div>
                  <div>{claim.dueAt ? `Echeance: ${formatClaimDate(claim.dueAt)}` : "Echeance en calcul"}</div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Derniere reponse / synthese</div>
                  <p className="mt-2 leading-6">{claim.summaryReply}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Historique des actions</div>
                  <div className="mt-3 grid gap-3">
                    {claim.history.slice(0, 4).map((entry) => (
                      <div key={entry.id} className="relative pl-5 text-sm text-slate-600 before:absolute before:left-0 before:top-1.5 before:h-2 before:w-2 before:rounded-full before:bg-red-500">
                        <div className="font-semibold text-slate-800">{entry.description}</div>
                        <div>{entry.actorName} | {formatClaimDate(entry.createdAt)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {claim.displayStatus === "RESOLVED" ? (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                  <div className="text-sm font-semibold text-emerald-800">Confirmer la resolution</div>
                  <p className="mt-1 text-sm text-emerald-700">Le service a apporte une reponse. Vous pouvez confirmer que le probleme est resolu ou demander la poursuite du traitement.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onResolutionFeedback(claim.id, "CONFIRMED")}
                      className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                    >
                      Probleme resolu
                    </button>
                    <button
                      type="button"
                      onClick={() => onResolutionFeedback(claim.id, "REOPENED")}
                      className="inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:border-emerald-300"
                    >
                      Poursuivre le traitement
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <Link to={`/user/reclamations/${claim.id}`} className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-red-200 hover:text-red-600">
                  Voir le dossier
                </Link>
                {claim.pageContext ? (
                  <a href={claim.pageContext} className="inline-flex items-center justify-center rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white no-underline transition hover:bg-red-700">
                    Ouvrir la page concernee
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <aside className="grid gap-4">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Workflow</p>
          <div className="mt-4 grid gap-3 text-sm text-slate-600">
            <WorkflowRow label={claimStatusLabels.SUBMITTED} helper="Ticket cree et enregistre" />
            <WorkflowRow label={claimStatusLabels.UNDER_REVIEW} helper="Analyse initiale du dossier" />
            <WorkflowRow label={claimStatusLabels.PROCESSING} helper="Traitement par le service" />
            <WorkflowRow label={claimStatusLabels.RESOLVED} helper="Reponse fournie, attente de confirmation" />
            <WorkflowRow label={claimStatusLabels.CLOSED} helper="Demande cloturee" />
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Actions recentes</p>
          <div className="mt-4 grid gap-4">
            {recentActions.length === 0 ? <p className="text-sm text-slate-500">Votre historique apparaitra ici.</p> : null}
            {recentActions.map((entry) => (
              <div key={entry.id} className="relative pl-5 text-sm text-slate-600 before:absolute before:left-0 before:top-1 before:h-2.5 before:w-2.5 before:rounded-full before:bg-red-500">
                <div className="font-semibold text-slate-800">{entry.description}</div>
                <div className="text-xs uppercase tracking-[0.14em] text-slate-400">{entry.ticketNumber}</div>
                <div>{entry.subject} | {formatClaimDate(entry.createdAt)}</div>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

function StatCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{helper}</div>
    </div>
  );
}

function WorkflowRow({ label, helper }: { label: string; helper: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="font-semibold text-slate-800">{label}</div>
      <div className="mt-1 text-xs text-slate-500">{helper}</div>
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
  if (feedback === "CONFIRMED") return "CLOSED";
  if (feedback === "REOPENED") return "PROCESSING";
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
  if (claim.activityLog?.length) {
    return claim.activityLog;
  }

  const entries: ClaimActivityLogEntry[] = [
    {
      id: `${claim.id}-created`,
      description: "Reclamation creee",
      actorName: "Utilisateur",
      createdAt: claim.createdAt,
    },
  ];

  if (["UNDER_REVIEW", "PROCESSING", "RESOLVED", "CLOSED"].includes(displayStatus)) {
    entries.push({
      id: `${claim.id}-review`,
      description: "Prise en charge pour analyse",
      actorName: "Service reclamations",
      createdAt: addHours(claim.createdAt, 2),
    });
  }

  if (["PROCESSING", "RESOLVED", "CLOSED"].includes(displayStatus)) {
    entries.push({
      id: `${claim.id}-processing`,
      description: "Dossier en traitement",
      actorName: claim.adminReplyBy || "Agent instructeur",
      createdAt: addHours(claim.createdAt, 8),
    });
  }

  if (["RESOLVED", "CLOSED"].includes(displayStatus)) {
    entries.push({
      id: `${claim.id}-reply`,
      description: claim.adminReply ? "Reponse administrative transmise" : "Resolution communiquee",
      actorName: claim.adminReplyBy || "Administration",
      createdAt: claim.adminReplyAt || claim.updatedAt,
    });
  }

  if (feedback === "CONFIRMED" || displayStatus === "CLOSED") {
    entries.push({
      id: `${claim.id}-closed`,
      description: "Cloture du ticket",
      actorName: feedback === "CONFIRMED" ? "Utilisateur" : "Administration",
      createdAt: addHours(claim.updatedAt, 4),
    });
  }

  if (feedback === "REOPENED") {
    entries.push({
      id: `${claim.id}-reopened`,
      description: "Utilisateur a demande la poursuite du traitement",
      actorName: "Utilisateur",
      createdAt: addHours(claim.updatedAt, 4),
    });
  }

  return entries.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

function addHours(value: string, hours: number) {
  const date = new Date(value);
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

function normalizeText(value: string) {
  return value
    .toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}
