import { useEffect, useMemo, useState } from "react";
import type { ConversationSummary } from "../../models/conversation.models";
import { archiveConversation, listMyConversations, restoreConversation } from "../../services/user.service";
import { publishSnackbar } from "../../utils/snackbarBus";

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("fr-FR");
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
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"ACTIVE" | "ARCHIVED">("ACTIVE");
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [pendingId, setPendingId] = useState<string | null>(null);

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
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.id === item.id
            ? {
                ...conversation,
                isArchived: state.isArchived,
                archivedAt: state.archivedAt,
                updatedAt: state.updatedAt,
              }
            : conversation,
        ),
      );
      publishSnackbar({ variant: "success", message: "Conversation archivee." });
    } finally {
      setPendingId(null);
    }
  }

  async function handleRestore(item: ConversationSummary) {
    try {
      setPendingId(item.id);
      const state = await restoreConversation(item.id);
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.id === item.id
            ? {
                ...conversation,
                isArchived: state.isArchived,
                archivedAt: state.archivedAt,
                updatedAt: state.updatedAt,
              }
            : conversation,
        ),
      );
      publishSnackbar({ variant: "success", message: "Conversation restauree." });
    } finally {
      setPendingId(null);
    }
  }

return (
  <div className="mx-auto max-w-5xl grid gap-4">

    {/* HEADER */}
    <section className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <h1 className="text-xl font-bold text-slate-900">
        Historique des conversations
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Consultez, archivez ou restaurez vos échanges.
      </p>

      {/* SEARCH */}
      <div className="relative mt-4">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          <Icon>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4.2-4.2" />
          </Icon>
        </span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher..."
          className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
        />
      </div>
    </section>

    {/* FILTER BAR */}
    <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">

      {/* TABS */}
      <div className="flex rounded-lg bg-slate-100 p-1">
        <button
          onClick={() => setTab("ACTIVE")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
            tab === "ACTIVE"
              ? "bg-white text-red-600 shadow-sm"
              : "text-slate-600"
          }`}
        >
          Actives ({activeCount})
        </button>

        <button
          onClick={() => setTab("ARCHIVED")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
            tab === "ARCHIVED"
              ? "bg-white text-red-600 shadow-sm"
              : "text-slate-600"
          }`}
        >
          Archives ({archivedCount})
        </button>
      </div>

      {/* SORT */}
      <select
        value={sortOrder}
        onChange={(e) => setSortOrder(e.target.value as "desc" | "asc")}
        className="h-9 rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
      >
        <option value="desc">Plus récentes</option>
        <option value="asc">Plus anciennes</option>
      </select>
    </section>

    {/* CONTENT */}
    {loading ? (
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
        Chargement...
      </div>
    ) : filtered.length === 0 ? (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
        Aucune conversation trouvée.
      </div>
    ) : (
      <div className="grid gap-3">
        {filtered.map((item) => (
          <article
            key={item.id}
            className="rounded-lg border border-slate-200 bg-white px-4 py-3 transition hover:border-red-200"
          >
            <div className="flex items-start justify-between gap-3">

              {/* LEFT */}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-slate-900 truncate">
                    {item.title}
                  </h2>

                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      item.isArchived
                        ? "bg-amber-100 text-amber-700"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {item.isArchived ? "Archivée" : "Active"}
                  </span>
                </div>

                <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                  {item.preview || item.summary || "Aucun aperçu"}
                </p>

                <div className="mt-2 flex gap-3 text-[11px] text-slate-400">
                  <span>{item.messageCount} msg</span>
                  <span>{formatDate(item.updatedAt)}</span>
                </div>
              </div>

              {/* ACTION */}
              <button
                onClick={() =>
                  item.isArchived
                    ? handleRestore(item)
                    : handleArchive(item)
                }
                disabled={pendingId === item.id}
                className={`text-xs px-3 py-1.5 rounded-md border transition ${
                  item.isArchived
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                }`}
              >
                {pendingId === item.id
                  ? "..."
                  : item.isArchived
                  ? "Restaurer"
                  : "Archiver"}
              </button>
            </div>
          </article>
        ))}
      </div>
    )}
  </div>
);
}
