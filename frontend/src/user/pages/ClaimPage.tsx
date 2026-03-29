import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import {
  createClaim,
  listMyClaims,
  markMyClaimsRepliesAsRead,
} from "../../services/claims.service";
import { publishSnackbar } from "../../utils/snackbarBus";
import {
  type Claim,
  type ClaimActivityLogEntry,
  type ClaimAttachment,
  type ClaimCategory,
  type ClaimPriority,
  type ClaimStatus,
} from "../../models/claim.models";
import { priorityBadgeClass, statusBadgeClass } from "../../claims/claimUi";
import { useI18n } from "../../i18n/I18nContext";
import DonutChart from "../components/ClaimPage/DonutChart";
import ChartLegendRow from "../components/ClaimPage/ChartLegendRow";
import InfoRow from "../components/ClaimPage/InfoRow";

type UiLanguage = "fr" | "en" | "ar";

const CATEGORY_OPTIONS: ClaimCategory[] = [
  "ACCOUNT",
  "CHATBOT",
  "DOCUMENT",
  "OTHER",
];
const CHAT_CLAIM_DRAFT_KEY = "chat-claim-draft";
const FEEDBACK_STORAGE_KEY = "my-claims-resolution-feedback";
const CHART_COLORS: Record<DetailedClaimStatus, string> = {
  SUBMITTED: "#C62828",
  UNDER_REVIEW: "#8E1F1F",
  PROCESSING: "#1F3A5F",
  RESOLVED: "#4B5563",
  CLOSED: "#111827",
};

const PRIORITY_OPTIONS: ClaimPriority[] = ["LOW", "NORMAL", "HIGH", "URGENT"];

const claimPageCopy = {
  fr: {
    section: "Espace reclamations",
    title: "Reclamations",
    newClaim: "Nouvelle reclamation",
    myClaims: "Mes reclamations",
    subjectPlaceholder: "Sujet",
    descriptionPlaceholder: "Description detaillee",
    pageContextPlaceholder: "Lien ou page concernee",
    acceptedFormats: "Formats acceptes: PNG, JPG, WEBP. Taille max: 3 MB.",
    completion: "Completude du dossier",
    completionHint: "Ajoutez plus de details pour accelerer le traitement.",
    sending: "Envoi...",
    submit: "Envoyer la reclamation",
    bestPractices: "Bonnes pratiques",
    practice1: "Choisissez la categorie la plus proche du sujet traite.",
    practice2: "Decrivez clairement le contexte et les etapes deja realisees.",
    practice3:
      "Utilisez la priorite urgente uniquement en cas de blocage reel.",
    searchPlaceholder: "Mot-cle, sujet ou ticket",
    allStatuses: "Tous les statuts",
    allCategories: "Toutes les categories",
    allPriorities: "Toutes les priorites",
    reset: "Reinitialiser",
    noClaims: "Aucune reclamation ne correspond aux filtres actifs.",
    updatedOn: "Mise a jour le",
    details: "Details",
    statsTitle: "Statistiques des reclamations",
    statsHint:
      "Repartition par statut selon la categorie et la priorite selectionnees.",
    noChartClaims: "Aucune reclamation pour cette combinaison.",
    inspection: "Inspection",
    claimDetails: "Details de la reclamation",
    generalInfo: "Informations generales",
    category: "Categorie",
    createdAt: "Date de creation",
    updatedAtLabel: "Derniere mise a jour",
    assignedAgent: "Agent charge",
    assignmentPending: "Affectation en attente",
    dueAt: "Echeance",
    duePending: "Echeance en calcul",
    exchanges: "Nombre d'echanges",
    lastReply: "Derniere reponse",
    history: "Historique des actions",
    userConfirmation: "Confirmation utilisateur",
    confirmHint:
      "Confirmez si le probleme est resolu ou demandez la poursuite du traitement.",
    resolved: "Probleme resolu",
    continueProcessing: "Poursuivre le traitement",
    actions: "Actions",
    openPage: "Ouvrir la page concernee",
    total: "Total",
    claimsWord: "reclamations",
    validationWarning: "Veuillez completer les champs",
    claimSent: "Reclamation envoyee",
    closedMessage: "Le ticket a ete marque comme ferme.",
    processingMessage: "Le ticket reste en traitement.",
    noAdminReply: "Aucune reponse administrative pour le moment.",
    serviceName: "Service reclamations",
    userActor: "Utilisateur",
    adminActor: "Administration",
    caseAgent: "Agent instructeur",
    claimCreated: "Reclamation creee",
    reviewStarted: "Prise en charge pour analyse",
    processingStarted: "Dossier en traitement",
    adminReplySent: "Reponse administrative transmise",
    resolutionShared: "Resolution communiquee",
    ticketClosed: "Cloture du ticket",
    reopened: "Utilisateur a demande la poursuite du traitement",
  },
  en: {
    section: "Claims area",
    title: "Claims",
    newClaim: "New claim",
    myClaims: "My claims",
    subjectPlaceholder: "Subject",
    descriptionPlaceholder: "Detailed description",
    pageContextPlaceholder: "Related link or page",
    acceptedFormats: "Accepted formats: PNG, JPG, WEBP. Max size: 3 MB.",
    completion: "File completeness",
    completionHint: "Add more details to speed up processing.",
    sending: "Sending...",
    submit: "Send claim",
    bestPractices: "Best practices",
    practice1: "Choose the category closest to the reported topic.",
    practice2: "Clearly describe the context and the steps already taken.",
    practice3: "Use urgent priority only for a real blocking issue.",
    searchPlaceholder: "Keyword, subject or ticket",
    allStatuses: "All statuses",
    allCategories: "All categories",
    allPriorities: "All priorities",
    reset: "Reset",
    noClaims: "No claim matches the active filters.",
    updatedOn: "Updated on",
    details: "Details",
    statsTitle: "Claim statistics",
    statsHint:
      "Distribution by status according to the selected category and priority.",
    noChartClaims: "No claims for this combination.",
    inspection: "Inspection",
    claimDetails: "Claim details",
    generalInfo: "General information",
    category: "Category",
    createdAt: "Created on",
    updatedAtLabel: "Last update",
    assignedAgent: "Assigned agent",
    assignmentPending: "Assignment pending",
    dueAt: "Due date",
    duePending: "Due date pending",
    exchanges: "Number of exchanges",
    lastReply: "Latest reply",
    history: "Action history",
    userConfirmation: "User confirmation",
    confirmHint:
      "Confirm whether the issue is resolved or ask for processing to continue.",
    resolved: "Issue resolved",
    continueProcessing: "Continue processing",
    actions: "Actions",
    openPage: "Open related page",
    total: "Total",
    claimsWord: "claims",
    validationWarning: "Please complete the required fields",
    claimSent: "Claim sent",
    closedMessage: "The ticket was marked as closed.",
    processingMessage: "The ticket remains in progress.",
    noAdminReply: "No administrative reply yet.",
    serviceName: "Claims service",
    userActor: "User",
    adminActor: "Administration",
    caseAgent: "Review officer",
    claimCreated: "Claim created",
    reviewStarted: "Taken in charge for review",
    processingStarted: "File under processing",
    adminReplySent: "Administrative reply sent",
    resolutionShared: "Resolution communicated",
    ticketClosed: "Ticket closed",
    reopened: "User requested continued processing",
  },
  ar: {
    section: "فضاء الشكايات",
    title: "الشكايات",
    newClaim: "شكاية جديدة",
    myClaims: "شكاياتي",
    subjectPlaceholder: "الموضوع",
    descriptionPlaceholder: "وصف مفصل",
    pageContextPlaceholder: "الرابط او الصفحة المعنية",
    acceptedFormats: "الصيغ المقبولة: PNG وJPG وWEBP. الحجم الاقصى 3 ميغابايت.",
    completion: "اكتمال الملف",
    completionHint: "اضف مزيدا من التفاصيل لتسريع المعالجة.",
    sending: "جار الارسال...",
    submit: "ارسال الشكاية",
    bestPractices: "ممارسات جيدة",
    practice1: "اختر الفئة الاقرب لموضوع الشكاية.",
    practice2: "صف السياق والخطوات المنجزة بوضوح.",
    practice3: "استعمل الاولوية المستعجلة فقط عند وجود عرقلة حقيقية.",
    searchPlaceholder: "كلمة مفتاحية او موضوع او رقم التذكرة",
    allStatuses: "كل الحالات",
    allCategories: "كل الفئات",
    allPriorities: "كل الاولويات",
    reset: "اعادة التعيين",
    noClaims: "لا توجد شكاية تطابق المرشحات الحالية.",
    updatedOn: "اخر تحديث",
    details: "التفاصيل",
    statsTitle: "احصائيات الشكايات",
    statsHint: "توزيع الحالات حسب الفئة والاولوية المحددتين.",
    noChartClaims: "لا توجد شكايات لهذا الاختيار.",
    inspection: "معاينة",
    claimDetails: "تفاصيل الشكاية",
    generalInfo: "معلومات عامة",
    category: "الفئة",
    createdAt: "تاريخ الانشاء",
    updatedAtLabel: "اخر تحديث",
    assignedAgent: "المكلف",
    assignmentPending: "في انتظار التعيين",
    dueAt: "الاجل",
    duePending: "الاجل قيد التحديد",
    exchanges: "عدد التبادلات",
    lastReply: "اخر رد",
    history: "سجل الاجراءات",
    userConfirmation: "تأكيد المستخدم",
    confirmHint: "اكد حل المشكل او اطلب مواصلة المعالجة.",
    resolved: "تم حل المشكل",
    continueProcessing: "مواصلة المعالجة",
    actions: "الاجراءات",
    openPage: "فتح الصفحة المعنية",
    total: "المجموع",
    claimsWord: "شكايات",
    validationWarning: "يرجى اكمال الحقول المطلوبة",
    claimSent: "تم ارسال الشكاية",
    closedMessage: "تم اعتبار التذكرة مغلقة.",
    processingMessage: "التذكرة ما زالت قيد المعالجة.",
    noAdminReply: "لا يوجد رد اداري حاليا.",
    serviceName: "مصلحة الشكايات",
    userActor: "المستخدم",
    adminActor: "الادارة",
    caseAgent: "المكلف بالمعالجة",
    claimCreated: "تم انشاء الشكاية",
    reviewStarted: "تم التكفل بها للدراسة",
    processingStarted: "الملف قيد المعالجة",
    adminReplySent: "تم ارسال الرد الاداري",
    resolutionShared: "تم تبليغ الحل",
    ticketClosed: "اغلاق التذكرة",
    reopened: "طلب المستخدم مواصلة المعالجة",
  },
} as const;

type DetailedClaimStatus = Exclude<ClaimStatus, "ANSWERED">;
type ResolutionFeedback = "CONFIRMED" | "REOPENED";

type EnrichedClaim = Claim & {
  displayStatus: DetailedClaimStatus;
  ticketNumber: string;
  messageTotal: number;
  summaryReply: string;
  history: ClaimActivityLogEntry[];
};

type ChartSegment = {
  status: DetailedClaimStatus;
  label: string;
  count: number;
  percentage: number;
  color: string;
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
  const {
    language,
    locale,
    dir,
    claimCategoryLabel,
    claimPriorityLabel,
    claimStatusLabel,
  } = useI18n();
  const copy = claimPageCopy[language as UiLanguage];
  const isRtl = dir === "rtl";
  const formatDateTime = (value: string | null | undefined) => {
    if (!value) return "-";
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  };
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
  const [statusFilter, setStatusFilter] = useState<DetailedClaimStatus | "">(
    "",
  );
  const [categoryFilter, setCategoryFilter] = useState<ClaimCategory | "">("");
  const [priorityFilter, setPriorityFilter] = useState<ClaimPriority | "">("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [chartCategoryFilter, setChartCategoryFilter] = useState<
    ClaimCategory | "ALL"
  >("ALL");
  const [chartPriorityFilter, setChartPriorityFilter] = useState<
    ClaimPriority | "ALL"
  >("ALL");
  const [resolutionFeedback, setResolutionFeedback] = useState<
    Record<string, ResolutionFeedback>
  >(() => readFeedbackState());
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
    () =>
      claims.filter(
        (claim) => claim.status === "ANSWERED" && !claim.isReplyReadByUser,
      ).length,
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
    window.dispatchEvent(
      new CustomEvent("claims-unread-changed", { detail: unreadCount }),
    );
  }, [unreadCount]);

  async function loadClaims() {
    const data = await listMyClaims();
    setClaims(
      data.map((claim) => ({
        ...claim,
        priority: claim.priority ?? "NORMAL",
        pageContext: claim.pageContext ?? "",
      })),
    );
  }

  async function onFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.currentTarget.value = "";
    if (files.length === 0) return;
    const accepted = files
      .filter(
        (file) =>
          file.type.startsWith("image/") && file.size <= 3 * 1024 * 1024,
      )
      .slice(0, 4);
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
      publishSnackbar({ variant: "warning", message: copy.validationWarning });
      return;
    }

    try {
      setSending(true);
      await createClaim({
        category,
        priority,
        subject,
        description,
        pageContext,
        attachments,
      });
      setSubject("");
      setDescription("");
      setPageContext("");
      setAttachments([]);
      publishSnackbar({ variant: "success", message: copy.claimSent });
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
      message:
        feedback === "CONFIRMED" ? copy.closedMessage : copy.processingMessage,
    });
  }

  const enrichedClaims = useMemo<EnrichedClaim[]>(() => {
    return claims
      .map((claim, index) =>
        enrichClaim(
          claim,
          index,
          resolutionFeedback[claim.id],
          language as UiLanguage,
        ),
      )
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
  }, [claims, resolutionFeedback]);

  const filteredClaims = useMemo(() => {
    const normalizedSearch = normalizeText(search);
    const fromTs = createdFrom
      ? new Date(`${createdFrom}T00:00:00`).getTime()
      : null;
    const toTs = createdTo ? new Date(`${createdTo}T23:59:59`).getTime() : null;

    return enrichedClaims.filter((claim) => {
      if (statusFilter && claim.displayStatus !== statusFilter) return false;
      if (categoryFilter && claim.category !== categoryFilter) return false;
      if (priorityFilter && (claim.priority ?? "NORMAL") !== priorityFilter)
        return false;

      if (normalizedSearch) {
        const haystack = normalizeText(
          [
            claim.subject,
            claim.description,
            claim.summaryReply,
            claim.ticketNumber,
            claimCategoryLabel(claim.category),
          ].join(" "),
        );
        if (!haystack.includes(normalizedSearch)) return false;
      }

      const createdAtTs = new Date(claim.createdAt).getTime();
      if (fromTs !== null && createdAtTs < fromTs) return false;
      if (toTs !== null && createdAtTs > toTs) return false;
      return true;
    });
  }, [
    categoryFilter,
    createdFrom,
    createdTo,
    enrichedClaims,
    priorityFilter,
    search,
    statusFilter,
  ]);

  const chartClaims = useMemo(() => {
    return enrichedClaims.filter((claim) => {
      if (
        chartCategoryFilter !== "ALL" &&
        claim.category !== chartCategoryFilter
      )
        return false;
      if (
        chartPriorityFilter !== "ALL" &&
        (claim.priority ?? "NORMAL") !== chartPriorityFilter
      )
        return false;
      return true;
    });
  }, [chartCategoryFilter, chartPriorityFilter, enrichedClaims]);

  const chartSegments = useMemo<ChartSegment[]>(() => {
    const total = chartClaims.length;
    const statuses: DetailedClaimStatus[] = [
      "SUBMITTED",
      "UNDER_REVIEW",
      "PROCESSING",
      "RESOLVED",
      "CLOSED",
    ];
    return statuses
      .map((status) => {
        const count = chartClaims.filter(
          (claim) => claim.displayStatus === status,
        ).length;
        return {
          status,
          label: claimStatusLabel(status),
          count,
          percentage: total > 0 ? (count / total) * 100 : 0,
          color: CHART_COLORS[status],
        };
      })
      .filter((segment) => segment.count > 0 || total === 0);
  }, [chartClaims]);

  const selectedClaim = useMemo(
    () => filteredClaims.find((claim) => claim.id === selectedClaimId) ?? null,
    [filteredClaims, selectedClaimId],
  );

  return (
    <div dir={dir} className="w-full space-y-6 px-4">
      <section className="px-5 py-4 rounded-2xl border border-white/50 bg-white/80 py-1 shadow-lg backdrop-blur">
        <div
          className={`flex flex-col gap-3 lg:items-end lg:justify-between ${isRtl ? "lg:flex-row-reverse" : "lg:flex-row"}`}
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
              {copy.section}
            </p>
            <h1 className="mt-2 px-2 text-2xl font-bold tracking-tight text-red-900 ">
              {copy.title} {unreadCount > 0 ? `(${unreadCount})` : ""}
            </h1>
          </div>
          <div
            className={`inline-flex gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1 mb-4 ${isRtl ? "flex-row-reverse self-start lg:self-auto" : ""}`}
          >
            <button
              type="button"
              onClick={() => setTab("NEW")}
              className={
                tab === "NEW"
                  ? "rounded-lg bg-slate-900 px-3  py-1.5 text-[11px] font-semibold text-white transition"
                  : "rounded-lg px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-white hover:text-slate-900"
              }
            >
              {copy.newClaim}
            </button>
            <button
              type="button"
              onClick={() => setTab("LIST")}
              className={
                tab === "LIST"
                  ? "rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white transition"
                  : "rounded-lg px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-white hover:text-slate-900"
              }
            >
              {copy.myClaims} {unreadCount > 0 ? `(${unreadCount})` : ""}
            </button>
          </div>
        </div>
      </section>

      {tab === "NEW" ? (
        <div
          className={`grid gap-4 ${isRtl ? "xl:grid-cols-[280px_minmax(0,1fr)]" : "xl:grid-cols-[minmax(0,1fr)_280px]"}`}
        >
          <form
            onSubmit={onSubmit}
            className={`grid gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-lg ${isRtl ? "text-right" : "text-left"}`}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ClaimCategory)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none transition focus:border-slate-400"
              >
                {CATEGORY_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {claimCategoryLabel(value)}
                  </option>
                ))}
              </select>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as ClaimPriority)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none transition focus:border-slate-400"
              >
                {PRIORITY_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {claimPriorityLabel(value)}
                  </option>
                ))}
              </select>
            </div>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={copy.subjectPlaceholder}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none transition focus:border-slate-400"
            />
            <textarea
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={copy.descriptionPlaceholder}
              className="min-h-[140px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-700 outline-none transition focus:border-slate-400"
            />
            <div className="grid gap-3 md:grid-cols-2">
              <input
                value={pageContext}
                onChange={(e) => setPageContext(e.target.value)}
                placeholder={copy.pageContextPlaceholder}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none transition focus:border-slate-400"
              />
              <input
                value={new Date().toLocaleString(locale)}
                readOnly
                className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] text-slate-500"
              />
            </div>
            <input
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              onChange={onFilesChange}
              className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-[13px] text-slate-600"
            />
            <p className="text-xs text-slate-500">{copy.acceptedFormats}</p>
            {attachments.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {attachments.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
                  >
                    <img
                      src={file.dataUrl}
                      alt={file.name}
                      className="h-28 w-full object-cover"
                    />
                    <div className="space-y-1 px-3 py-2">
                      <div className="truncate text-xs font-semibold text-slate-800">
                        {file.name}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {Math.round(file.size / 1024)} KB
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3">
              <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-700">
                <span>{copy.completion}</span>
                <span>{completion}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-200">
                <div
                  className="h-2 rounded-full bg-red-600"
                  style={{ width: `${completion}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {copy.completionHint}
              </p>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={sending}
                className="h-10 rounded-xl bg-slate-900 px-4 text-[13px] font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {sending ? copy.sending : copy.submit}
              </button>
            </div>
          </form>
          <aside
            className={`grid gap-3 ${isRtl ? "xl:order-first text-right" : ""}`}
          >
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-lg">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                {copy.bestPractices}
              </div>
              <div className="mt-3 grid gap-2 text-[13px] text-slate-600">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  {copy.practice1}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  {copy.practice2}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  {copy.practice3}
                </div>
              </div>
            </div>
          </aside>
        </div>
      ) : (
        <div className="grid gap-4">
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-lg">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={copy.searchPlaceholder}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none transition focus:border-slate-400 xl:col-span-2"
              />
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as DetailedClaimStatus | "")
                }
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none transition focus:border-slate-400"
              >
                <option value="">{copy.allStatuses}</option>
                <option value="SUBMITTED">
                  {claimStatusLabel("SUBMITTED")}
                </option>
                <option value="UNDER_REVIEW">
                  {claimStatusLabel("UNDER_REVIEW")}
                </option>
                <option value="PROCESSING">
                  {claimStatusLabel("PROCESSING")}
                </option>
                <option value="RESOLVED">{claimStatusLabel("RESOLVED")}</option>
                <option value="CLOSED">{claimStatusLabel("CLOSED")}</option>
              </select>
              <select
                value={categoryFilter}
                onChange={(e) =>
                  setCategoryFilter(e.target.value as ClaimCategory | "")
                }
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none transition focus:border-slate-400"
              >
                <option value="">{copy.allCategories}</option>
                {CATEGORY_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {claimCategoryLabel(value)}
                  </option>
                ))}
              </select>
              <select
                value={priorityFilter}
                onChange={(e) =>
                  setPriorityFilter(e.target.value as ClaimPriority | "")
                }
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none transition focus:border-slate-400"
              >
                <option value="">{copy.allPriorities}</option>
                {PRIORITY_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {claimPriorityLabel(value)}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
              <input
                type="date"
                value={createdFrom}
                onChange={(e) => setCreatedFrom(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none transition focus:border-slate-400"
              />
              <input
                type="date"
                value={createdTo}
                onChange={(e) => setCreatedTo(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none transition focus:border-slate-400"
              />
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("");
                  setCategoryFilter("");
                  setPriorityFilter("");
                  setCreatedFrom("");
                  setCreatedTo("");
                }}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {copy.reset}
              </button>
            </div>
          </section>

          <div
            className={`grid gap-4 xl:items-start ${isRtl ? "xl:grid-cols-[360px_minmax(0,1fr)]" : "xl:grid-cols-[minmax(0,1fr)_360px]"}`}
          >
            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-lg">
              <div className="grid gap-3">
                {filteredClaims.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                    {copy.noClaims}
                  </div>
                ) : null}
                {filteredClaims.map((claim) => (
                  <article
                    key={claim.id}
                    className={`rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-lg ${isRtl ? "text-right" : "text-left"}`}
                  >
                    <div
                      className={`flex items-start justify-between gap-4 ${isRtl ? "flex-row-reverse" : ""}`}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                          <span>{claim.ticketNumber}</span>
                          <span className="h-1 w-1 rounded-full bg-slate-300" />
                          <span>{claimCategoryLabel(claim.category)}</span>
                        </div>
                        <h2 className="mt-1 text-[15px] font-semibold text-slate-900">
                          {claim.subject}
                        </h2>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${statusBadgeClass(claim.displayStatus)}`}
                          >
                            {claimStatusLabel(claim.displayStatus)}
                          </span>
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${priorityBadgeClass(claim.priority ?? "NORMAL")}`}
                          >
                            {claimPriorityLabel(claim.priority ?? "NORMAL")}
                          </span>
                        </div>
                        <p className="mt-2 text-[12px] text-slate-500">
                          {copy.updatedOn} {formatDateTime(claim.updatedAt)}
                        </p>
                      </div>
                      <div
                        className={`flex shrink-0 flex-col gap-2 ${isRtl ? "items-start" : "items-end"}`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedClaimId(claim.id)}
                          className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          Details
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <aside
              className={`rounded-3xl border border-slate-200 bg-white p-4 shadow-lg xl:sticky xl:top-4 ${isRtl ? "xl:order-first text-right" : ""}`}
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                {copy.statsTitle}
              </div>
              <div className="mt-1 text-[13px] text-slate-500">
                {copy.statsHint}
              </div>

              <div className="mt-4 grid gap-3">
                <select
                  value={chartCategoryFilter}
                  onChange={(e) =>
                    setChartCategoryFilter(
                      e.target.value as ClaimCategory | "ALL",
                    )
                  }
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none transition focus:border-slate-400"
                >
                  <option value="ALL">{copy.allCategories}</option>
                  {CATEGORY_OPTIONS.map((value) => (
                    <option key={value} value={value}>
                      {claimCategoryLabel(value)}
                    </option>
                  ))}
                </select>
                <select
                  value={chartPriorityFilter}
                  onChange={(e) =>
                    setChartPriorityFilter(
                      e.target.value as ClaimPriority | "ALL",
                    )
                  }
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none transition focus:border-slate-400"
                >
                  <option value="ALL">{copy.allPriorities}</option>
                  {PRIORITY_OPTIONS.map((value) => (
                    <option key={value} value={value}>
                      {claimPriorityLabel(value)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-5 flex justify-center">
                <DonutChart
                  segments={chartSegments}
                  total={chartClaims.length}
                  totalLabel={copy.total}
                  claimsLabel={copy.claimsWord}
                />
              </div>

              <div className="mt-5 grid gap-2">
                {chartSegments.map((segment) => (
                  <ChartLegendRow key={segment.status} segment={segment} />
                ))}
                {chartClaims.length === 0 ? (
                  <div className="text-[12px] text-slate-500">
                    {copy.noChartClaims}
                  </div>
                ) : null}
              </div>
            </aside>
          </div>
        </div>
      )}

      {tab === "LIST" && selectedClaim ? (
        <div
          className={`fixed inset-0 z-50 flex bg-slate-950/30 backdrop-blur-[2px] ${isRtl ? "justify-start" : "justify-end"}`}
        >
          <div
            className={`flex h-full w-full max-w-3xl flex-col overflow-y-auto border-slate-200 bg-white px-5 py-5 shadow-2xl ${isRtl ? "border-r text-right" : "border-l text-left"}`}
          >
            <div
              className={`flex items-start justify-between gap-4 ${isRtl ? "flex-row-reverse" : ""}`}
            >
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#DA3D20]">
                  {copy.inspection}
                </div>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                  {copy.claimDetails}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedClaimId(null)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
              >
                <span className="text-lg">x</span>
              </button>
            </div>

            <div className="mt-6 grid gap-4">
              <section className="rounded-[24px] bg-slate-50 px-4 py-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {selectedClaim.ticketNumber}
                </div>
                <div className="mt-1 text-lg font-semibold text-slate-950">
                  {selectedClaim.subject}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${statusBadgeClass(selectedClaim.displayStatus)}`}
                  >
                    {claimStatusLabel(selectedClaim.displayStatus)}
                  </span>
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${priorityBadgeClass(selectedClaim.priority ?? "NORMAL")}`}
                  >
                    {claimPriorityLabel(selectedClaim.priority ?? "NORMAL")}
                  </span>
                </div>
                <p className="mt-3 text-[13px] leading-5 text-slate-600">
                  {selectedClaim.description}
                </p>
              </section>

              <section className="rounded-[24px] bg-slate-50 px-4 py-4">
                <div className="text-sm font-semibold text-slate-950">
                  {copy.generalInfo}
                </div>
                <div
                  className={`mt-4 grid gap-4 sm:grid-cols-2 ${isRtl ? "text-right" : ""}`}
                >
                  <InfoRow
                    label={copy.category}
                    value={claimCategoryLabel(selectedClaim.category)}
                  />
                  <InfoRow
                    label={copy.createdAt}
                    value={formatDateTime(selectedClaim.createdAt)}
                  />
                  <InfoRow
                    label={copy.updatedAtLabel}
                    value={formatDateTime(selectedClaim.updatedAt)}
                  />
                  <InfoRow
                    label={copy.assignedAgent}
                    value={
                      selectedClaim.assignedAgent?.name ||
                      copy.assignmentPending
                    }
                  />
                  <InfoRow
                    label={copy.dueAt}
                    value={
                      selectedClaim.dueAt
                        ? formatDateTime(selectedClaim.dueAt)
                        : copy.duePending
                    }
                  />
                  <InfoRow
                    label={copy.exchanges}
                    value={`${selectedClaim.messageTotal}`}
                  />
                </div>
              </section>

              <section className="rounded-[24px] bg-slate-50 px-4 py-4">
                <div className="text-sm font-semibold text-slate-950">
                  {copy.lastReply}
                </div>
                <p className="mt-3 text-[13px] leading-6 text-slate-600">
                  {selectedClaim.summaryReply}
                </p>
              </section>

              <section className="rounded-[24px] bg-slate-50 px-4 py-4">
                <div className="text-sm font-semibold text-slate-950">
                  {copy.history}
                </div>
                <div className="mt-3 grid gap-3">
                  {selectedClaim.history.map((entry) => (
                    <div
                      key={entry.id}
                      className="relative pl-4 text-[12px] text-slate-600 before:absolute before:left-0 before:top-1.5 before:h-1.5 before:w-1.5 before:rounded-full before:bg-slate-500"
                    >
                      <div className="font-semibold text-slate-800">
                        {entry.description}
                      </div>
                      <div>
                        {entry.actorName} | {formatDateTime(entry.createdAt)}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {selectedClaim.displayStatus === "RESOLVED" ? (
                <section className="rounded-[24px] bg-slate-50 px-4 py-4">
                  <div className="text-sm font-semibold text-slate-950">
                    {copy.userConfirmation}
                  </div>
                  <p className="mt-2 text-[12px] text-slate-600">
                    {copy.confirmHint}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onResolutionFeedback(selectedClaim.id, "CONFIRMED")
                      }
                      className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-slate-800"
                    >
                      {copy.resolved}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onResolutionFeedback(selectedClaim.id, "REOPENED")
                      }
                      className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      {copy.continueProcessing}
                    </button>
                  </div>
                </section>
              ) : null}

              <section className="rounded-[24px] bg-slate-50 px-4 py-4">
                <div className="text-sm font-semibold text-slate-950">
                  {copy.actions}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedClaim.pageContext ? (
                    <a
                      href={selectedClaim.pageContext}
                      className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-3 py-1.5 text-[12px] font-semibold text-white no-underline transition hover:bg-slate-800"
                    >
                      {copy.openPage}
                    </a>
                  ) : null}
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}
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

function enrichClaim(
  claim: Claim,
  index: number,
  feedback?: ResolutionFeedback,
  language: UiLanguage = "fr",
): EnrichedClaim {
  const copy = claimPageCopy[language];
  const priority = claim.priority ?? "NORMAL";
  const displayStatus = toDetailedStatus(claim.status, feedback);
  const ticketNumber =
    claim.ticketNumber?.trim() || buildTicketNumber(claim, index);
  const dueAt =
    claim.dueAt ??
    addHours(
      claim.createdAt,
      priority === "URGENT" ? 12 : priority === "HIGH" ? 24 : 48,
    );
  const history = buildHistory(claim, displayStatus, feedback, language);

  return {
    ...claim,
    priority,
    assignedAgent:
      claim.assignedAgent ??
      (displayStatus !== "SUBMITTED"
        ? { id: `agent-${claim.id}`, name: copy.serviceName }
        : null),
    dueAt,
    displayStatus,
    ticketNumber,
    messageTotal: claim.messageCount ?? (claim.adminReply ? 2 : 1),
    summaryReply:
      claim.lastAdminReplyPreview ?? claim.adminReply ?? copy.noAdminReply,
    history,
  };
}

function toDetailedStatus(
  status: ClaimStatus,
  feedback?: ResolutionFeedback,
): DetailedClaimStatus {
  if (feedback === "CONFIRMED") return "CLOSED";
  if (feedback === "REOPENED") return "PROCESSING";
  if (status === "ANSWERED") return "RESOLVED";
  return status === "CLOSED" ||
    status === "RESOLVED" ||
    status === "PROCESSING" ||
    status === "UNDER_REVIEW"
    ? status
    : "SUBMITTED";
}

function buildTicketNumber(claim: Claim, index: number) {
  const year = new Date(claim.createdAt).getFullYear();
  const serialBase = `${claim.id}${claim.createdAt}`
    .split("")
    .reduce((total, char) => total + char.charCodeAt(0), 0);
  const serial = String((serialBase + index + 1) % 10000).padStart(4, "0");
  return `REC-${year}-${serial}`;
}

function buildHistory(
  claim: Claim,
  displayStatus: DetailedClaimStatus,
  feedback?: ResolutionFeedback,
  language: UiLanguage = "fr",
): ClaimActivityLogEntry[] {
  const copy = claimPageCopy[language];
  if (claim.activityLog?.length) return claim.activityLog;

  const entries: ClaimActivityLogEntry[] = [
    {
      id: `${claim.id}-created`,
      description: copy.claimCreated,
      actorName: copy.userActor,
      createdAt: claim.createdAt,
    },
  ];

  if (
    ["UNDER_REVIEW", "PROCESSING", "RESOLVED", "CLOSED"].includes(displayStatus)
  ) {
    entries.push({
      id: `${claim.id}-review`,
      description: copy.reviewStarted,
      actorName: copy.serviceName,
      createdAt: addHours(claim.createdAt, 2),
    });
  }
  if (["PROCESSING", "RESOLVED", "CLOSED"].includes(displayStatus)) {
    entries.push({
      id: `${claim.id}-processing`,
      description: copy.processingStarted,
      actorName: claim.adminReplyBy || copy.caseAgent,
      createdAt: addHours(claim.createdAt, 8),
    });
  }
  if (["RESOLVED", "CLOSED"].includes(displayStatus)) {
    entries.push({
      id: `${claim.id}-reply`,
      description: claim.adminReply
        ? copy.adminReplySent
        : copy.resolutionShared,
      actorName: claim.adminReplyBy || copy.adminActor,
      createdAt: claim.adminReplyAt || claim.updatedAt,
    });
  }
  if (feedback === "CONFIRMED" || displayStatus === "CLOSED") {
    entries.push({
      id: `${claim.id}-closed`,
      description: copy.ticketClosed,
      actorName: feedback === "CONFIRMED" ? copy.userActor : copy.adminActor,
      createdAt: addHours(claim.updatedAt, 4),
    });
  }
  if (feedback === "REOPENED") {
    entries.push({
      id: `${claim.id}-reopened`,
      description: copy.reopened,
      actorName: copy.userActor,
      createdAt: addHours(claim.updatedAt, 4),
    });
  }

  return entries.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

function addHours(value: string, hours: number) {
  const date = new Date(value);
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

function normalizeText(value: string) {
  return value.toLocaleLowerCase("fr-FR").normalize("NFD").replace(/[̀-ͯ]/g, "");
}






