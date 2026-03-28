import { useEffect, useMemo, useState } from "react";
import type { ConversationSummary } from "../../models/conversation.models";
import { archiveConversation, listMyConversations, restoreConversation } from "../../services/user.service";
import { publishSnackbar } from "../../utils/snackbarBus";
import { useI18n } from "../../i18n/I18nContext";

const labels = {
  fr: { title: "Historique des conversations", subtitle: "Consultez, archivez ou restaurez vos echanges.", search: "Rechercher...", active: "Actives", archived: "Archives", newest: "Plus recentes", oldest: "Plus anciennes", loading: "Chargement...", empty: "Aucune conversation trouvee.", archivedDone: "Conversation archivee.", restoredDone: "Conversation restauree.", archivedBadge: "Archivee", activeBadge: "Active", noPreview: "Aucun apercu", messages: "msg", restore: "Restaurer", archive: "Archiver" },
  en: { title: "Conversation history", subtitle: "View, archive, or restore your exchanges.", search: "Search...", active: "Active", archived: "Archived", newest: "Most recent", oldest: "Oldest", loading: "Loading...", empty: "No conversation found.", archivedDone: "Conversation archived.", restoredDone: "Conversation restored.", archivedBadge: "Archived", activeBadge: "Active", noPreview: "No preview", messages: "msg", restore: "Restore", archive: "Archive" },
  ar: { title: "سجل المحادثات", subtitle: "اطلع على محادثاتك أو قم بأرشفتها أو استعادتها.", search: "بحث...", active: "نشطة", archived: "مؤرشفة", newest: "الأحدث", oldest: "الأقدم", loading: "جاري التحميل...", empty: "لم يتم العثور على أي محادثة.", archivedDone: "تمت أرشفة المحادثة.", restoredDone: "تمت استعادة المحادثة.", archivedBadge: "مؤرشفة", activeBadge: "نشطة", noPreview: "لا توجد معاينة", messages: "رسالة", restore: "استرجاع", archive: "أرشفة" },
} as const;

function Icon({ children }: { children: React.ReactNode }) {
  return <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}

function matchesSearch(item: ConversationSummary, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  const haystack = [item.title, item.preview, item.summary].join(" ").toLowerCase();
  return haystack.includes(normalized);
}

function sortConversations(items: ConversationSummary[], order: "desc" | "asc") {
  return [...items].sort((a, b) => {
    const aTime = new Date(a.updatedAt).getTime();
    const bTime = new Date(b.updatedAt).getTime();
    return order === "desc" ? bTime - aTime : aTime - bTime;
  });
}

export default function ConversationsHistoryPage() {
  const { language, locale } = useI18n();
  const l = labels[language];
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"ACTIVE" | "ARCHIVED">("ACTIVE");
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [pendingId, setPendingId] = useState<string | null>(null);

  function formatDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString(locale);
  }

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await listMyConversations();
        setConversations(data);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const activeCount = useMemo(() => conversations.filter((item) => !item.isArchived).length, [conversations]);
  const archivedCount = useMemo(() => conversations.filter((item) => item.isArchived).length, [conversations]);

  const filtered = useMemo(() => {
    const base = conversations.filter((item) => (tab === "ACTIVE" ? !item.isArchived : item.isArchived));
    const searched = base.filter((item) => matchesSearch(item, search));
    return sortConversations(searched, sortOrder);
  }, [conversations, tab, search, sortOrder]);

  async function handleArchive(item: ConversationSummary) {
    try {
      setPendingId(item.id);
      const state = await archiveConversation(item.id);
      setConversations((prev) => prev.map((conversation) => conversation.id === item.id ? { ...conversation, isArchived: state.isArchived, archivedAt: state.archivedAt, updatedAt: state.updatedAt } : conversation));
      publishSnackbar({ variant: "success", message: l.archivedDone });
    } finally {
      setPendingId(null);
    }
  }

  async function handleRestore(item: ConversationSummary) {
    try {
      setPendingId(item.id);
      const state = await restoreConversation(item.id);
      setConversations((prev) => prev.map((conversation) => conversation.id === item.id ? { ...conversation, isArchived: state.isArchived, archivedAt: state.archivedAt, updatedAt: state.updatedAt } : conversation));
      publishSnackbar({ variant: "success", message: l.restoredDone });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl grid gap-4">
      <section className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-lg">
        <h1 className="text-xl font-bold text-slate-900">{l.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{l.subtitle}</p>
        <div className="relative mt-4">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Icon><circle cx="11" cy="11" r="7" /><path d="m20 20-4.2-4.2" /></Icon></span>
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={l.search} className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100" />
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-lg bg-slate-100 p-1">
          <button onClick={() => setTab("ACTIVE")} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${tab === "ACTIVE" ? "bg-white text-red-600 shadow-lg" : "text-slate-600"}`}>{l.active} ({activeCount})</button>
          <button onClick={() => setTab("ARCHIVED")} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${tab === "ARCHIVED" ? "bg-white text-red-600 shadow-lg" : "text-slate-600"}`}>{l.archived} ({archivedCount})</button>
        </div>
        <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as "desc" | "asc")} className="h-9 rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"><option value="desc">{l.newest}</option><option value="asc">{l.oldest}</option></select>
      </section>

      {loading ? <div className="rounded-lg border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">{l.loading}</div> : filtered.length === 0 ? <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">{l.empty}</div> : <div className="grid gap-3">{filtered.map((item) => <article key={item.id} className="rounded-lg border border-slate-200 bg-white px-4 py-3 transition hover:border-red-200"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><h2 className="truncate text-sm font-semibold text-slate-900">{item.title}</h2><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${item.isArchived ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{item.isArchived ? l.archivedBadge : l.activeBadge}</span></div><p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.preview || item.summary || l.noPreview}</p><div className="mt-2 flex gap-3 text-[11px] text-slate-400"><span>{item.messageCount} {l.messages}</span><span>{formatDate(item.updatedAt)}</span></div></div><button onClick={() => item.isArchived ? handleRestore(item) : handleArchive(item)} disabled={pendingId === item.id} className={`text-xs px-3 py-1.5 rounded-md border transition ${item.isArchived ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"}`}>{pendingId === item.id ? "..." : item.isArchived ? l.restore : l.archive}</button></div></article>)}</div>}
    </div>
  );
}
