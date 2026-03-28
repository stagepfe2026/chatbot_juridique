import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { DocumentCategory, DocumentSearchResult } from "../../models/document.models";
import { searchDocuments, setDocumentFavorite } from "../../services/userDocuments.service";

const RECENT_SEARCHES_KEY = "user-document-searches";
const RECENT_DOCUMENTS_KEY = "user-recent-documents";
const PAGE_SIZE = 10;

type SortField = "date" | "title";
type SortDir = "desc" | "asc";
type CategoryFilter = "ALL" | DocumentCategory;

type StoredRecentDocument = {
  id: string;
  title: string;
  category: DocumentCategory;
  viewedAt: string;
};

const categoryOptions: Array<{ value: CategoryFilter; label: string }> = [
  { value: "ALL", label: "Toutes les categories" },
  { value: "LOI_DES_FINANCES", label: "Loi des finances" },
  { value: "RECUEILS_DES_TEXTES_FISCAUX", label: "Recueils des textes fiscaux" },
  { value: "NOTE_COMMUNES", label: "Notes communes" },
  { value: "CONVENTIONS_DE_NON_DOUBLE_IMPOSITION", label: "Conventions de non double imposition" },
];

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      {children}
    </svg>
  );
}

function highlightText(text: string, terms: string[]) {
  if (!terms.length || !text) return text;
  const escaped = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, index) => {
    const isMatch = terms.some((term) => part.toLowerCase() === term.toLowerCase());
    return isMatch ? (
      <mark key={`${part}-${index}`} className="rounded bg-amber-200 px-1 text-slate-900">
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    );
  });
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("fr-FR");
}

function formatCategory(value: DocumentCategory) {
  return categoryOptions.find((option) => option.value === value)?.label ?? value.replace(/_/g, " ");
}

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export default function SearchDocumentsPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DocumentSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [favoriteBusy, setFavoriteBusy] = useState<Record<string, boolean>>({});
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [recentDocuments, setRecentDocuments] = useState<StoredRecentDocument[]>([]);
  const hasMountedRef = useRef(false);

  const terms = useMemo(() => query.trim().split(/\s+/).filter(Boolean), [query]);
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  useEffect(() => {
    setRecentSearches(readStorage<string[]>(RECENT_SEARCHES_KEY, []));
    setRecentDocuments(readStorage<StoredRecentDocument[]>(RECENT_DOCUMENTS_KEY, []));
  }, []);

  async function runSearch(nextPage = page, event?: FormEvent, nextQuery?: string) {
    event?.preventDefault();
    const trimmed = (nextQuery ?? query).trim();
    if (!trimmed) {
      setResults([]);
      setTotal(0);
      setError(null);
      setSelectedId(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await searchDocuments({
        query: trimmed,
        limit: PAGE_SIZE,
        page: nextPage,
        category: categoryFilter,
        dateFrom,
        dateTo,
        sortField,
        sortDir,
      });
      setResults(data.items);
      setTotal(data.total);
      setPage(data.page);
      setSelectedId((current) => (data.items.some((doc) => doc.id === current) ? current : data.items[0]?.id ?? null));
      const nextRecentSearches = [trimmed, ...recentSearches.filter((item) => item !== trimmed)].slice(0, 6);
      setRecentSearches(nextRecentSearches);
      writeStorage(RECENT_SEARCHES_KEY, nextRecentSearches);
    } catch (e: unknown) {
      const message =
        typeof e === "object" && e != null && "message" in e
          ? String((e as { message?: unknown }).message ?? "Erreur lors de la recherche.")
          : "Erreur lors de la recherche.";
      setError(message);
      setResults([]);
      setTotal(0);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }

  async function onSearch(event?: FormEvent) {
    setPage(1);
    await runSearch(1, event);
  }

  async function onToggleFavorite(item: DocumentSearchResult) {
    if (favoriteBusy[item.id]) return;
    const next = !item.isFavored;
    try {
      setFavoriteBusy((prev) => ({ ...prev, [item.id]: true }));
      const res = await setDocumentFavorite(item.id, next);
      setResults((prev) => prev.map((doc) => (doc.id === item.id ? { ...doc, isFavored: res.isFavored } : doc)));
      window.dispatchEvent(new Event("favorites-changed"));
    } catch {
      setError("Impossible de mettre a jour les favoris.");
    } finally {
      setFavoriteBusy((prev) => ({ ...prev, [item.id]: false }));
    }
  }

  useEffect(() => {
    if (!selectedId || results.length === 0) return;
    const selectedDoc = results.find((doc) => doc.id === selectedId);
    if (!selectedDoc) return;

    setRecentDocuments((prev) => {
      const nextRecentDocuments = [
        {
          id: selectedDoc.id,
          title: selectedDoc.title,
          category: selectedDoc.category,
          viewedAt: new Date().toISOString(),
        },
        ...prev.filter((doc) => doc.id !== selectedDoc.id),
      ].slice(0, 5);
      writeStorage(RECENT_DOCUMENTS_KEY, nextRecentDocuments);
      return nextRecentDocuments;
    });
  }, [selectedId, results]);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    if (!query.trim()) return;
    setPage(1);
    void runSearch(1);
  }, [categoryFilter, dateFrom, dateTo, sortField, sortDir]);

  const selectedDoc = results.find((doc) => doc.id === selectedId) ?? null;

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((prev) => (prev === "desc" ? "asc" : "desc"));
      return;
    }
    setSortField(field);
    setSortDir(field === "title" ? "asc" : "desc");
  }

  function clearFilters() {
    setCategoryFilter("ALL");
    setDateFrom("");
    setDateTo("");
    setSortField("date");
    setSortDir("desc");
    setPage(1);
  }

  const filterBtn = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
      active ? "border-red-600 bg-red-600 text-white shadow-[0_6px_12px_rgba(239,68,68,0.15)]" : "border-slate-200 bg-white text-slate-700 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
    }`;

  return (
    <div className="relative left-1/2 min-h-[calc(vh-150px)] w-screen max-w-none -translate-x-1/2 space-y-6 px-4">
      <section className="rounded-2xl border border-white/50 bg-white/80 p-4 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="mt-6 text-xl font-bold tracking-tight text-slate-900">Recherche documentaire avancee</h1>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[420px]">
            <div className="rounded-2xl border border-[#efe5e1] bg-white px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Resultats</div>
              <div className="mt-1 text-lg font-bold text-slate-900">{total}</div>
              <div className="mt-1 text-[11px] text-slate-500">documents trouves</div>
            </div>
            <div className="rounded-2xl border border-[#efe5e1] bg-white px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Page</div>
              <div className="mt-1 text-lg font-bold text-slate-900">{page}</div>
              <div className="mt-1 text-[11px] text-slate-500">sur {totalPages}</div>
            </div>
            <div className="rounded-2xl border border-[#efe5e1] bg-white px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Categorie</div>
              <div className="mt-1 text-xs font-bold text-slate-900">{categoryFilter === "ALL" ? "Toutes" : formatCategory(categoryFilter)}</div>
            </div>
          </div>
        </div>

        <form onSubmit={onSearch} className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 shadow-inner">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.8fr)_repeat(4,minmax(0,0.7fr))]">
            <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm">
              <div className="text-slate-400">
                <Icon>
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-4.2-4.2" />
                </Icon>
              </div>
              <input
                className="w-full border-0 bg-transparent text-xs font-medium text-slate-900 outline-none placeholder:text-slate-400"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher par mot-cle, reference ou intitule..."
              />
            </div>

            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-red-300">
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-red-300" />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-red-300" />

            <div className="flex gap-2">
              <button type="submit" className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-[0_8px_16px_rgba(239,68,68,0.15)] transition hover:-translate-y-px">
                Rechercher
              </button>
              <button type="button" onClick={clearFilters} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-red-200 hover:text-red-600">
                Reset
              </button>
            </div>
          </div>
        </form>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600">
            <Icon>
              <path d="M4 6h16" />
              <path d="M6 12h12" />
              <path d="M8 18h8" />
            </Icon>
            Trier par:
          </span>
          <button type="button" className={filterBtn(sortField === "date")} onClick={() => toggleSort("date")}>
            Date {sortField === "date" && <span className="ml-1 rounded-full bg-white/20 px-1 py-0.5 text-[10px]">{sortDir === "asc" ? "Asc" : "Desc"}</span>}
          </button>
          <button type="button" className={filterBtn(sortField === "title")} onClick={() => toggleSort("title")}>
            Titre {sortField === "title" && <span className="ml-1 rounded-full bg-white/20 px-1 py-0.5 text-[10px]">{sortDir === "asc" ? "A-Z" : "Z-A"}</span>}
          </button>
          {query.trim() ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Requete: {query.trim()}</span> : null}
          {dateFrom ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Du {formatDate(dateFrom)}</span> : null}
          {dateTo ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Au {formatDate(dateTo)}</span> : null}
        </div>
      </section>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</div>}

      <section className="grid gap-4 2xl:grid-cols-[1.1fr_0.9fr_0.55fr]">
        <div className="grid gap-3">
          {loading && <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 px-4 py-6 text-center text-xs font-semibold text-slate-500">Recherche en cours...</div>}
          {!loading && results.length === 0 && query.trim() && <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 px-4 py-6 text-center text-xs font-semibold text-slate-500">Aucun document trouve pour ces criteres.</div>}
          {!query.trim() && !loading && <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 px-4 py-6 text-center text-xs font-semibold text-slate-500">Saisissez une requete puis appliquez des filtres pour afficher les documents.</div>}

          {results.map((doc) => {
            const isSelected = doc.id === selectedId;
            const dateValue = doc.realizedAt || doc.createdAt;
            return (
              <article
                key={doc.id}
                className={`grid gap-2.5 rounded-2xl border bg-white p-3.5 text-left shadow-sm transition duration-150 ${
                  isSelected ? "border-red-300 shadow-[0_8px_16px_rgba(239,68,68,0.12)]" : "border-white/80 hover:-translate-y-0.5 hover:border-red-200 hover:shadow-[0_6px_12px_rgba(239,68,68,0.08)]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <button type="button" className="min-w-0 appearance-none border-0 bg-transparent p-0 text-left shadow-none outline-none" onClick={() => setSelectedId(doc.id)}>
                    <div className="text-base font-bold tracking-tight text-slate-900">{highlightText(doc.title, terms)}</div>
                    <div className="mt-1 text-[11px] leading-5 text-slate-500">{highlightText(doc.description || doc.excerpt, terms)}</div>
                  </button>
                  <button
                    type="button"
                    className={`shrink-0 rounded-full border border-slate-200 p-2 transition ${doc.isFavored ? "text-amber-500" : "text-slate-300 hover:border-amber-200 hover:text-amber-500"}`}
                    onClick={() => void onToggleFavorite(doc)}
                    disabled={favoriteBusy[doc.id]}
                  >
                    <Icon>
                      <path d="m12 3 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8 6.8 19l1-5.8L3.6 9.1l5.8-.8L12 3z" />
                    </Icon>
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-600">{formatCategory(doc.category)}</span>
                  {doc.fileType ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                      {doc.fileType.replace("application/", "").replace("vnd.openxmlformats-officedocument.wordprocessingml.document", "docx")}
                    </span>
                  ) : null}
                  {dateValue && <span>{formatDate(dateValue)}</span>}
                </div>
              </article>
            );
          })}

          {total > 0 ? (
            <div className="flex items-center justify-between  px-4 py-3 ">
              <div className="text-[11px] font-semibold text-slate-500">Affichage de {(page - 1) * PAGE_SIZE + 1} a {Math.min(page * PAGE_SIZE, total)} sur {total}</div>
              <div className="flex items-center gap-2">
                <button type="button" disabled={page <= 1 || loading} onClick={() => void runSearch(page - 1)} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition disabled:cursor-not-allowed disabled:opacity-50 hover:border-red-200 hover:text-red-600">Precedent</button>
                <button type="button" disabled={page >= totalPages || loading} onClick={() => void runSearch(page + 1)} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition disabled:cursor-not-allowed disabled:opacity-50 hover:border-red-200 hover:text-red-600">Suivant</button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm">
          {selectedDoc ? (
            <div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xl font-bold tracking-tight text-slate-900">{selectedDoc.title}</div>
                  <div className="mt-1 text-xs font-medium text-slate-500">{selectedDoc.description || "Sans description detaillee."}</div>
                </div>
                <button type="button" className={`rounded-full border border-slate-200 p-2 transition ${selectedDoc.isFavored ? "text-amber-500" : "text-slate-300 hover:border-amber-200 hover:text-amber-500"}`} onClick={() => void onToggleFavorite(selectedDoc)}>
                  <Icon>
                    <path d="m12 3 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8 6.8 19l1-5.8L3.6 9.1l5.8-.8L12 3z" />
                  </Icon>
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-600">{formatCategory(selectedDoc.category)}</span>
                {selectedDoc.fileType ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">{selectedDoc.fileType.replace("application/", "").replace("vnd.openxmlformats-officedocument.wordprocessingml.document", "docx")}</span> : null}
                {(selectedDoc.realizedAt || selectedDoc.createdAt) && <span>{formatDate(selectedDoc.realizedAt || selectedDoc.createdAt)}</span>}
              </div>

              <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Date de reference</div>
                <div className="mt-1 text-xs font-bold text-slate-900">{formatDate(selectedDoc.realizedAt || selectedDoc.createdAt) || "Non renseignee"}</div>
              </div>

              <div className="mt-4 border-t border-slate-100 pt-4">
                <div className="text-xs font-bold text-slate-900">Extrait pertinent</div>
                <p className="mt-2 whitespace-pre-wrap text-[11px] leading-5 text-slate-600">{highlightText(selectedDoc.excerpt || selectedDoc.description || "", terms)}</p>
              </div>

              <a
                className="mt-4 inline-flex items-center justify-center rounded-full bg-red-600 px-4 py-2 text-[11px] font-bold text-white shadow-[0_8px_16px_rgba(239,68,68,0.15)] transition hover:-translate-y-px "
                href={selectedDoc.downloadUrl}
                target="_blank"
                rel="noreferrer"
              >
                Consulter le document complet
              </a>
            </div>
          ) : (
            <div className="grid min-h-[200px] place-items-center text-center text-slate-500">
              <div>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-red-50 text-red-600">
                  <Icon>
                    <path d="M6 3h9l5 5v13H6z" />
                    <path d="M15 3v5h5" />
                    <path d="M9 13h6" />
                    <path d="M9 17h6" />
                  </Icon>
                </div>
                <div className="mt-2 text-sm font-bold text-slate-900">Selectionnez un document</div>
                <div className="mt-1 text-xs font-medium">Cliquez sur un document pour consulter son contenu</div>
              </div>
            </div>
          )}
        </div>

        <aside className="grid gap-4">
vov          <div className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm">
            <div className="text-xs font-bold text-slate-900">Recherches recentes</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {recentSearches.length > 0 ? recentSearches.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setQuery(item);
                    setPage(1);
                    void runSearch(1, undefined, item);
                  }}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                >
                  {item}
                </button>
              )) : <div className="text-xs text-slate-500">Aucune recherche recente.</div>}
            </div>
          </div>

          <div className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm">
            <div className="text-xs font-bold text-slate-900">Documents consultes recemment</div>
            <div className="mt-3 grid gap-2">
              {recentDocuments.length > 0 ? recentDocuments.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => {
                    setQuery(doc.title);
                    setPage(1);
                    void runSearch(1, undefined, doc.title);
                  }}
                  className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2 text-left transition hover:border-red-200 hover:bg-red-50/40"
                >
                  <div className="text-xs font-bold text-slate-900 line-clamp-2">{doc.title}</div>
                  <div className="mt-1 text-[11px] font-medium text-slate-500">{formatCategory(doc.category)} - {formatDate(doc.viewedAt)}</div>
                </button>
              )) : <div className="text-xs text-slate-500">Aucun document consulte pour le moment.</div>}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
