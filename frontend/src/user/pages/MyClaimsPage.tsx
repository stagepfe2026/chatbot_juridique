import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { type Claim, type ClaimActivityLogEntry, type ClaimCategory, type ClaimPriority, type ClaimStatus } from "../../models/claim.models";
import { listMyClaims } from "../../services/claims.service";
import { formatClaimDate, priorityBadgeClass, statusBadgeClass } from "../../claims/claimUi";
import { publishSnackbar } from "../../utils/snackbarBus";
import { useI18n } from "../../i18n/I18nContext";

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
  const { t, claimCategoryLabel, claimPriorityLabel, claimStatusLabel } = useI18n();
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
      message: feedback === "CONFIRMED" ? t("claims.resolutionClosed") : t("claims.resolutionContinues"),
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
          claimCategoryLabel(claim.category),
        ].join(" "));
        if (!haystack.includes(normalizedSearch)) return false;
      }

      const createdAtTs = new Date(claim.createdAt).getTime();
      if (fromTs !== null && createdAtTs < fromTs) return false;
      if (toTs !== null && createdAtTs > toTs) return false;

      return true;
    });
  }, [category, createdFrom, createdTo, enrichedClaims, priority, search, status, claimCategoryLabel]);

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
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-red-600">{t("claims.userArea")}</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{t("claims.myClaims")}</h1>
            <p className="mt-1 text-sm text-slate-500">{t("claims.intro")}</p>
          </div>
          <Link to="/user/reclamations" className="inline-flex items-center justify-center rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700">
            {t("claims.newClaim")}
          </Link>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("claims.searchPlaceholder")} className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-50 xl:col-span-2" />
          <select value={status} onChange={(event) => setStatus(event.target.value as DetailedClaimStatus | "")} className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-50">
            <option value="">{t("common.allStatuses")}</option>
            <option value="SUBMITTED">{claimStatusLabel("SUBMITTED")}</option>
            <option value="UNDER_REVIEW">{claimStatusLabel("UNDER_REVIEW")}</option>
            <option value="PROCESSING">{claimStatusLabel("PROCESSING")}</option>
            <option value="RESOLVED">{claimStatusLabel("RESOLVED")}</option>
            <option value="CLOSED">{claimStatusLabel("CLOSED")}</option>
          </select>
          <select value={category} onChange={(event) => setCategory(event.target.value as ClaimCategory | "")} className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-50">
            <option value="">{t("common.allCategories")}</option>
            {(["ACCOUNT", "CHATBOT", "DOCUMENT", "OTHER"] as ClaimCategory[]).map((value) => (
              <option key={value} value={value}>{claimCategoryLabel(value)}</option>
            ))}
          </select>
          <select value={priority} onChange={(event) => setPriority(event.target.value as ClaimPriority | "")} className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-50">
            <option value="">{t("common.allPriorities")}</option>
            {(["LOW", "NORMAL", "HIGH", "URGENT"] as ClaimPriority[]).map((value) => (
              <option key={value} value={value}>{claimPriorityLabel(value)}</option>
            ))}
          </select>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <input type="date" value={createdFrom} onChange={(event) => setCreatedFrom(event.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-50" />
          <input type="date" value={createdTo} onChange={(event) => setCreatedTo(event.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-50" />
          <button type="button" onClick={() => { setSearch(""); setStatus(""); setCategory(""); setPriority(""); setCreatedFrom(""); setCreatedTo(""); }} className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-red-200 hover:text-red-600">
            {t("common.reset")}
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <StatCard label={t("claims.ticketsShown")} value={String(stats.total)} helper={t("claims.afterFilters")} />
          <StatCard label={t("claims.open")} value={String(stats.open)} helper={t("claims.openHelper")} />
          <StatCard label={t("claims.resolved")} value={String(stats.resolved)} helper={t("claims.resolvedHelper")} />
          <StatCard label={t("claims.closed")} value={String(stats.closed)} helper={t("claims.closedHelper")} />
        </div>

        <div className="mt-5 grid gap-4">
          {loading ? <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">{t("claims.loadingClaims")}</div> : null}
          {!loading && filteredClaims.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">{t("claims.noClaims")}</div> : null}
          {!loading && filteredClaims.map((claim) => (
            <article key={claim.id} className="rounded-3xl border border-slate-200 bg-white p-5 transition hover:border-red-200 hover:shadow-lg">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    <span>{claim.ticketNumber}</span>
                    <span className="h-1 w-1 rounded-full bg-slate-300" />
                    <span>{t("claims.createdOn")} {formatClaimDate(claim.createdAt)}</span>
                  </div>
                  <h2 className="mt-2 text-lg font-semibold text-slate-900">{claim.subject}</h2>
                  <p className="mt-1 text-sm text-slate-500">{claimCategoryLabel(claim.category)} | {t("claims.priority")} {claimPriorityLabel(claim.priority ?? "NORMAL")}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClass(claim.displayStatus)}`}>{claimStatusLabel(claim.displayStatus)}</span>
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${priorityBadgeClass(claim.priority ?? "NORMAL")}`}>{claimPriorityLabel(claim.priority ?? "NORMAL")}</span>
                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">{claim.messageTotal} {t("claims.exchanges")}</span>
                  </div>
                </div>

                <div className="grid gap-2 text-sm text-slate-500 lg:text-right">
                  <div>{t("claims.lastUpdated")}: {formatClaimDate(claim.updatedAt)}</div>
                  <div>{claim.assignedAgent?.name ? `${t("claims.assignedTo")} ${claim.assignedAgent.name}` : t("claims.pendingAssignment")}</div>
                  <div>{claim.dueAt ? `${t("claims.dueDate")}: ${formatClaimDate(claim.dueAt)}` : t("claims.dueCalculating")}</div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{t("claims.latestReply")}</div>
                  <p className="mt-2 leading-6">{claim.summaryReply}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{t("claims.actionHistory")}</div>
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
                  <div className="text-sm font-semibold text-emerald-800">{t("claims.confirmResolution")}</div>
                  <p className="mt-1 text-sm text-emerald-700">{t("claims.resolutionText")}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => onResolutionFeedback(claim.id, "CONFIRMED")} className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700">
                      {t("claims.problemResolved")}
                    </button>
                    <button type="button" onClick={() => onResolutionFeedback(claim.id, "REOPENED")} className="inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:border-emerald-300">
                      {t("claims.continueProcessing")}
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <Link to={`/user/reclamations/${claim.id}`} className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-red-200 hover:text-red-600">
                  {t("common.viewRecord")}
                </Link>
                {claim.pageContext ? (
                  <a href={claim.pageContext} className="inline-flex items-center justify-center rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white no-underline transition hover:bg-red-700">
                    {t("common.openAffectedPage")}
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <aside className="grid gap-4">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{t("claims.workflow")}</p>
          <div className="mt-4 grid gap-3 text-sm text-slate-600">
            <WorkflowRow label={claimStatusLabel("SUBMITTED")} helper={t("claims.workflowSubmitted")} />
            <WorkflowRow label={claimStatusLabel("UNDER_REVIEW")} helper={t("claims.workflowReview")} />
            <WorkflowRow label={claimStatusLabel("PROCESSING")} helper={t("claims.workflowProcessing")} />
            <WorkflowRow label={claimStatusLabel("RESOLVED")} helper={t("claims.workflowResolved")} />
            <WorkflowRow label={claimStatusLabel("CLOSED")} helper={t("claims.workflowClosed")} />
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{t("claims.recentActions")}</p>
          <div className="mt-4 grid gap-4">
            {recentActions.length === 0 ? <p className="text-sm text-slate-500">{t("claims.recentHistoryEmpty")}</p> : null}
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
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"><div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</div><div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div><div className="mt-1 text-xs text-slate-500">{helper}</div></div>;
}

function WorkflowRow({ label, helper }: { label: string; helper: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"><div className="font-semibold text-slate-800">{label}</div><div className="mt-1 text-xs text-slate-500">{helper}</div></div>;
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

  return { ...claim, priority, assignedAgent: claim.assignedAgent ?? (displayStatus !== "SUBMITTED" ? { id: `agent-${claim.id}`, name: "Service reclamations" } : null), dueAt, displayStatus, ticketNumber, messageTotal: claim.messageCount ?? (claim.adminReply ? 2 : 1), summaryReply: claim.lastAdminReplyPreview ?? claim.adminReply ?? "Aucune reponse administrative pour le moment.", history };
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
  if (claim.activityLog?.length) return claim.activityLog;

  const entries: ClaimActivityLogEntry[] = [{ id: `${claim.id}-created`, description: "Reclamation creee", actorName: "Utilisateur", createdAt: claim.createdAt }];
  if (["UNDER_REVIEW", "PROCESSING", "RESOLVED", "CLOSED"].includes(displayStatus)) entries.push({ id: `${claim.id}-review`, description: "Prise en charge pour analyse", actorName: "Service reclamations", createdAt: addHours(claim.createdAt, 2) });
  if (["PROCESSING", "RESOLVED", "CLOSED"].includes(displayStatus)) entries.push({ id: `${claim.id}-processing`, description: "Dossier en traitement", actorName: claim.adminReplyBy || "Agent instructeur", createdAt: addHours(claim.createdAt, 8) });
  if (["RESOLVED", "CLOSED"].includes(displayStatus)) entries.push({ id: `${claim.id}-reply`, description: claim.adminReply ? "Reponse administrative transmise" : "Resolution communiquee", actorName: claim.adminReplyBy || "Administration", createdAt: claim.adminReplyAt || claim.updatedAt });
  if (feedback === "CONFIRMED" || displayStatus === "CLOSED") entries.push({ id: `${claim.id}-closed`, description: "Cloture du ticket", actorName: feedback === "CONFIRMED" ? "Utilisateur" : "Administration", createdAt: addHours(claim.updatedAt, 4) });
  if (feedback === "REOPENED") entries.push({ id: `${claim.id}-reopened`, description: "Utilisateur a demande la poursuite du traitement", actorName: "Utilisateur", createdAt: addHours(claim.updatedAt, 4) });

  return entries.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

function addHours(value: string, hours: number) {
  const date = new Date(value);
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

function normalizeText(value: string) {
  return value.toLocaleLowerCase("fr-FR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}


