import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import type {
  DocumentCategory,
  DocumentSearchResult,
} from "../../models/document.models";
import {
  listFavoriteDocuments,
  setDocumentFavorite,
} from "../../services/userDocuments.service";
import { useI18n } from "../../i18n/I18nContext";
import Icon from "../components/FavoriteDocumentsPage/Icon";
import Metric from "../components/FavoriteDocumentsPage/Metric";
import InfoRow from "../components/FavoriteDocumentsPage/InfoRow";

const FAVORITE_LIBRARY_KEY = "user-favorite-library";
type FavoriteSortField = "addedAt" | "documentDate" | "title" | "category";
type FavoriteLibraryEntry = { note: string; addedAt: string };

const labels = {
  fr: {
    loadError: "Erreur lors du chargement des favoris.",
    favoriteError: "Impossible de mettre a jour les favoris.",
    totalDocsOne: "document enregistre",
    totalDocsMany: "documents enregistres",
    title: "Mes Favoris",
    total: "Total",
    categories: "Categories",
    notes: "Notes",
    lastAdded: "Dernier ajout",
    differentTypes: "Types differents en favoris",
    notedDocs: "Documents commentes",
    recentFavorite: "Favori le plus recent",
    searchPlaceholder: "Rechercher par titre, categorie, type ou note...",
    allCategories: "Toutes les categories",
    added: "Ajout",
    docDate: "Date doc",
    titleField: "Titre",
    category: "Categorie",
    results: "resultat(s)",
    search: "Recherche",
    noFavoriteYet: "Aucun favori pour le moment",
    noFavoriteText:
      "Enregistrez des documents depuis la recherche pour construire votre bibliotheque personnelle.",
    goSearch: "Aller a la recherche",
    noResult: "Aucun resultat",
    noResultText: "Essayez une autre recherche ou retirez un filtre.",
    recentAdded: "Documents recemment ajoutes",
    item: "element(s)",
    addedOn: "Ajoute le",
    details: "Details",
    consult: "Consulter",
    noDescription: "Sans description.",
    inspection: "Inspection",
    favoriteDetails: "Details du favori",
    generalInfo: "Informations generales",
    documentDate: "Date du document",
    addedToFavorites: "Ajoute aux favoris",
    fileType: "Type de fichier",
    notProvided: "Non renseignee",
    excerpt: "Extrait",
    noExcerpt: "Aucun extrait disponible.",
    personalNote: "Note personnelle",
    notePlaceholder: "Ajoutez ici vos remarques ou points a verifier.",
    actions: "Actions",
    openDocument: "Consulter le document",
    removeFavorite: "Retirer des favoris",
    noDate: "Aucune date",
  },
  en: {
    loadError: "Error while loading favorites.",
    favoriteError: "Unable to update favorites.",
    totalDocsOne: "saved document",
    totalDocsMany: "saved documents",
    title: "My Favorites",
    total: "Total",
    categories: "Categories",
    notes: "Notes",
    lastAdded: "Last added",
    differentTypes: "Different favorite types",
    notedDocs: "Annotated documents",
    recentFavorite: "Most recent favorite",
    searchPlaceholder: "Search by title, category, file type, or note...",
    allCategories: "All categories",
    added: "Added",
    docDate: "Doc date",
    titleField: "Title",
    category: "Category",
    results: "result(s)",
    search: "Search",
    noFavoriteYet: "No favorites yet",
    noFavoriteText:
      "Save documents from search to build your personal library.",
    goSearch: "Go to search",
    noResult: "No results",
    noResultText: "Try another search or remove a filter.",
    recentAdded: "Recently added documents",
    item: "item(s)",
    addedOn: "Added on",
    details: "Details",
    consult: "Open",
    noDescription: "No description.",
    inspection: "Inspection",
    favoriteDetails: "Favorite details",
    generalInfo: "General information",
    documentDate: "Document date",
    addedToFavorites: "Added to favorites",
    fileType: "File type",
    notProvided: "Not provided",
    excerpt: "Excerpt",
    noExcerpt: "No excerpt available.",
    personalNote: "Personal note",
    notePlaceholder: "Add your remarks or items to review here.",
    actions: "Actions",
    openDocument: "Open document",
    removeFavorite: "Remove from favorites",
    noDate: "No date",
  },
  ar: {
    loadError: "??? ????? ????? ???????.",
    favoriteError: "???? ????? ???????.",
    totalDocsOne: "????? ??????",
    totalDocsMany: "????? ??????",
    title: "???????",
    total: "???????",
    categories: "??????",
    notes: "?????????",
    lastAdded: "??? ?????",
    differentTypes: "????? ?????? ?? ???????",
    notedDocs: "????? ?? ???????",
    recentFavorite: "???? ?????",
    searchPlaceholder: "???? ???????? ?? ????? ?? ??? ????? ?? ????????...",
    allCategories: "?? ??????",
    added: "???????",
    docDate: "????? ???????",
    titleField: "???????",
    category: "?????",
    results: "?????",
    search: "???",
    noFavoriteYet: "?? ???? ?????? ??????",
    noFavoriteText: "?? ???? ??????? ?? ???? ????? ????? ?????? ???????.",
    goSearch: "???????? ??? ?????",
    noResult: "?? ???? ?????",
    noResultText: "???? ????? ??? ?? ??? ??? ????????.",
    recentAdded: "??????? ??????? ??????",
    item: "????",
    addedOn: "???? ??",
    details: "????????",
    consult: "???",
    noDescription: "?? ???? ???.",
    inspection: "??????",
    favoriteDetails: "?????? ???????",
    generalInfo: "??????? ????",
    documentDate: "????? ???????",
    addedToFavorites: "????? ??? ???????",
    fileType: "??? ?????",
    notProvided: "??? ?????",
    excerpt: "?????",
    noExcerpt: "?? ???? ????? ????.",
    personalNote: "?????? ?????",
    notePlaceholder: "??? ??? ???????? ?? ?????? ???? ???? ????????.",
    actions: "???????",
    openDocument: "??? ???????",
    removeFavorite: "????? ?? ???????",
    noDate: "?? ???? ?????",
  },
} as const;

function readFavoriteLibrary(): Record<string, FavoriteLibraryEntry> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(FAVORITE_LIBRARY_KEY);
    return raw ? (JSON.parse(raw) as Record<string, FavoriteLibraryEntry>) : {};
  } catch {
    return {};
  }
}
function writeFavoriteLibrary(value: Record<string, FavoriteLibraryEntry>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FAVORITE_LIBRARY_KEY, JSON.stringify(value));
}
function buildDefaultLibraryEntry(
  doc: DocumentSearchResult,
): FavoriteLibraryEntry {
  return {
    note: "",
    addedAt: doc.createdAt || doc.realizedAt || new Date().toISOString(),
  };
}
function compareText(a: string, b: string) {
  return a.localeCompare(b, "fr", { sensitivity: "base" });
}

export default function FavoriteDocumentsPage() {
  const { language, locale, documentCategoryLabel, t } = useI18n();
  const l = labels[language];
  const [results, setResults] = useState<DocumentSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [favoriteBusy, setFavoriteBusy] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<
    "ALL" | DocumentCategory
  >("ALL");
  const [sortField, setSortField] = useState<FavoriteSortField>("addedAt");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [favoriteLibrary, setFavoriteLibrary] = useState<
    Record<string, FavoriteLibraryEntry>
  >({});
  const [selectedFavoriteId, setSelectedFavoriteId] = useState<string | null>(
    null,
  );

  function formatDate(value?: string | null) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString(locale);
  }
  function formatFileType(value?: string | null) {
    if (!value) return "Fichier";
    return value
      .replace("application/", "")
      .replace(
        "vnd.openxmlformats-officedocument.wordprocessingml.document",
        "DOCX",
      )
      .replace("pdf", "PDF")
      .toUpperCase();
  }

  async function loadFavorites() {
    try {
      setLoading(true);
      setError(null);
      const data = await listFavoriteDocuments(100);
      setResults(data);
      setFavoriteLibrary((current) => {
        const next = { ...current };
        data.forEach((doc) => {
          if (!next[doc.id]) next[doc.id] = buildDefaultLibraryEntry(doc);
        });
        writeFavoriteLibrary(next);
        return next;
      });
    } catch (e: unknown) {
      const message =
        typeof e === "object" && e !== null && "message" in e
          ? String((e as { message?: unknown }).message ?? l.loadError)
          : l.loadError;
      setError(message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setFavoriteLibrary(readFavoriteLibrary());
    void loadFavorites();
  }, []);

  async function onToggleFavorite(item: DocumentSearchResult) {
    if (favoriteBusy[item.id]) return;
    const next = !item.isFavored;
    try {
      setFavoriteBusy((prev) => ({ ...prev, [item.id]: true }));
      const res = await setDocumentFavorite(item.id, next);
      setResults((prev) =>
        prev.filter((doc) => doc.id !== item.id || res.isFavored),
      );
      if (!res.isFavored) {
        setFavoriteLibrary((current) => {
          const nextLibrary = { ...current };
          delete nextLibrary[item.id];
          writeFavoriteLibrary(nextLibrary);
          return nextLibrary;
        });
      }
      window.dispatchEvent(new Event("favorites-changed"));
    } catch {
      setError(l.favoriteError);
    } finally {
      setFavoriteBusy((prev) => ({ ...prev, [item.id]: false }));
    }
  }

  function updateLibraryEntry(
    documentId: string,
    updater: (entry: FavoriteLibraryEntry) => FavoriteLibraryEntry,
  ) {
    setFavoriteLibrary((current) => {
      const targetDocument = results.find((doc) => doc.id === documentId);
      const base =
        current[documentId] ??
        (targetDocument
          ? buildDefaultLibraryEntry(targetDocument)
          : { note: "", addedAt: new Date().toISOString() });
      const next = { ...current, [documentId]: updater(base) };
      writeFavoriteLibrary(next);
      return next;
    });
  }

  function onNoteChange(
    documentId: string,
    event: ChangeEvent<HTMLTextAreaElement>,
  ) {
    updateLibraryEntry(documentId, (entry) => ({
      ...entry,
      note: event.target.value.slice(0, 240),
    }));
  }

  const countLabel = useMemo(
    () =>
      `${results.length} ${results.length <= 1 ? l.totalDocsOne : l.totalDocsMany}`,
    [results.length, l],
  );
  const categories = useMemo(
    () => Array.from(new Set(results.map((doc) => doc.category))),
    [results],
  );
  const favoriteDocuments = useMemo(
    () =>
      results.map((doc) => ({
        ...doc,
        library: favoriteLibrary[doc.id] ?? buildDefaultLibraryEntry(doc),
      })),
    [favoriteLibrary, results],
  );
  const filteredResults = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = favoriteDocuments.filter((doc) => {
      const matchesCategory =
        categoryFilter === "ALL" || doc.category === categoryFilter;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        doc.title.toLowerCase().includes(normalizedQuery) ||
        doc.description.toLowerCase().includes(normalizedQuery) ||
        doc.excerpt.toLowerCase().includes(normalizedQuery) ||
        documentCategoryLabel(doc.category)
          .toLowerCase()
          .includes(normalizedQuery) ||
        doc.library.note.toLowerCase().includes(normalizedQuery) ||
        formatFileType(doc.fileType).toLowerCase().includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
    return [...filtered].sort((a, b) => {
      let comparison = 0;
      if (sortField === "addedAt")
        comparison =
          new Date(a.library.addedAt).getTime() -
          new Date(b.library.addedAt).getTime();
      else if (sortField === "documentDate")
        comparison =
          new Date(a.realizedAt || a.createdAt || 0).getTime() -
          new Date(b.realizedAt || b.createdAt || 0).getTime();
      else if (sortField === "title")
        comparison = compareText(a.title, b.title);
      else
        comparison = compareText(
          documentCategoryLabel(a.category),
          documentCategoryLabel(b.category),
        );
      return sortDir === "asc" ? comparison : -comparison;
    });
  }, [
    categoryFilter,
    favoriteDocuments,
    query,
    sortDir,
    sortField,
    documentCategoryLabel,
  ]);
  const recentFavorites = useMemo(
    () =>
      [...favoriteDocuments]
        .sort(
          (a, b) =>
            new Date(b.library.addedAt).getTime() -
            new Date(a.library.addedAt).getTime(),
        )
        .slice(0, 4),
    [favoriteDocuments],
  );
  const latestFavoriteDate = useMemo(
    () =>
      recentFavorites.length === 0
        ? l.noDate
        : formatDate(recentFavorites[0].library.addedAt) || l.noDate,
    [recentFavorites, l.noDate],
  );
  const notesCount = useMemo(
    () =>
      favoriteDocuments.filter((doc) => doc.library.note.trim().length > 0)
        .length,
    [favoriteDocuments],
  );
  const selectedFavorite = useMemo(
    () =>
      favoriteDocuments.find((doc) => doc.id === selectedFavoriteId) ?? null,
    [favoriteDocuments, selectedFavoriteId],
  );

  return (
    <div className="favorite-docs-page mx-auto max-w-8xl space-y-4">
      <section className="">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between rounded-2xl border border-white/50 bg-white/80 py-1 shadow-lg backdrop-blur py-4 px-2">
          <div>
            <p className="px-4 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{t("claims.userArea")}</p>
            <h1 className="mt-2 px-4 font-bold text-2xl  tracking-tight text-slate-900 text-red-900 ">
              {l.title}
            </h1>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <Metric
              
              label={l.total}
              value={String(results.length)}
              helper={countLabel}
            />
            <Metric
              label={l.categories}
              value={String(categories.length)}
              helper={l.differentTypes}
            />
            <Metric
              label={l.notes}
              value={String(notesCount)}
              helper={l.notedDocs}
            />
            <Metric
              label={l.lastAdded}
              value={latestFavoriteDate}
              helper={l.recentFavorite}
            />
          </div>
        </div>
      </section>
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {error}
        </div>
      ) : null}
      <section className="rounded-xl border border-[#e7ddd9] bg-white px-4 py-5 shadow-lg" >
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_0.8fr_0.7fr]">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <Icon>
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-4.2-4.2" />
              </Icon>
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={l.searchPlaceholder}
              className="h-11 w-full rounded-xl border border-[#e7ddd9] bg-white pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#DA3D20]"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) =>
              setCategoryFilter(e.target.value as "ALL" | DocumentCategory)
            }
            className="h-11 rounded-xl border border-[#e7ddd9] bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-[#DA3D20] shadow-md"
          >
            <option value="ALL">{l.allCategories}</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {documentCategoryLabel(category)}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={sortField}
              onChange={(e) =>
                setSortField(e.target.value as FavoriteSortField)
              }
              className="h-11 rounded-xl border border-[#e7ddd9] bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-[#DA3D20]"
            >
              <option value="addedAt">{l.added}</option>
              <option value="documentDate">{l.docDate}</option>
              <option value="title">{l.titleField}</option>
              <option value="category">{l.category}</option>
            </select>
            <select
              value={sortDir}
              onChange={(e) => setSortDir(e.target.value as "desc" | "asc")}
              className="h-11 rounded-xl border border-[#e7ddd9] bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-[#DA3D20]"
            >
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="rounded-full bg-[#fdf1ed] px-3 py-1 font-semibold text-[#DA3D20]">
            {filteredResults.length} {l.results}
          </span>
          {query.trim() ? (
            <span>
              {l.search}: "{query.trim()}"
            </span>
          ) : null}
          {categoryFilter !== "ALL" ? (
            <span>
              {l.category}: {documentCategoryLabel(categoryFilter)}
            </span>
          ) : null}
        </div>
      </section>
      {!loading && !error && results.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-[#dccdc8] bg-white px-6 py-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[#DA3D20] bg-[#fdf1ed] text-[#DA3D20]">
            <Icon>
              <path d="m12 3 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8 6.8 19l1-5.8L3.6 9.1l5.8-.8L12 3z" />
            </Icon>
          </div>
          <h2 className="mt-4 text-base font-semibold text-slate-900">
            {l.noFavoriteYet}
          </h2>
          <p className="mt-2 text-sm text-slate-500">{l.noFavoriteText}</p>
          <a
            href="/user/recherche"
            className="mt-5 inline-flex rounded-xl bg-[#DA3D20] px-4 py-2 text-sm font-semibold text-white no-underline transition hover:bg-[#C73519]"
          >
            {l.goSearch}
          </a>
        </div>
      ) : null}
      {!loading &&
      !error &&
      results.length > 0 &&
      filteredResults.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-[#dccdc8] bg-white px-6 py-10 text-center">
          <h2 className="text-base font-semibold text-slate-900">
            {l.noResult}
          </h2>
          <p className="mt-2 text-sm text-slate-500">{l.noResultText}</p>
        </div>
      ) : null}
      {recentFavorites.length > 0 ? (
        <section className="rounded-2xl border border-[#e7ddd9] bg-white p-4 shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[13px] font-semibold text-slate-900">
                {l.recentAdded}
              </div>
            </div>
            <div className="text-xs font-medium text-slate-400">
              {recentFavorites.length} {l.item}
            </div>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {recentFavorites.map((doc) => (
              <div
                key={`recent-${doc.id}`}
                className="rounded-xl border border-slate-200 bg-slate-50/80 p-3"
              >
                <div className="line-clamp-2 text-[13px] font-semibold text-slate-900">
                  {doc.title}
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  {l.addedOn} {formatDate(doc.library.addedAt) || "-"}
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-500">
                  <span className="rounded-full bg-white px-2 py-0.5 font-semibold text-[#DA3D20]">
                    {documentCategoryLabel(doc.category)}
                  </span>
                  <span className="rounded-full bg-white px-2 py-0.5 font-semibold text-slate-600">
                    {formatFileType(doc.fileType)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 ">
        {filteredResults.map((doc) => {
          const dateValue = doc.realizedAt || doc.createdAt;
          return (
            <article
              key={doc.id}
              className="rounded-2xl border border-[#e7ddd9] bg-white p-4 transition hover:border-[#d8b7af] hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-[#fdf1ed] text-[#DA3D20] dark:border-[#DA3D20]">
                  <Icon>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6" />
                  </Icon>
                </div>
                <button
                  type="button"
                  onClick={() => void onToggleFavorite(doc)}
                  disabled={favoriteBusy[doc.id]}
                  className={`rounded-md p-1 transition ${doc.isFavored ? "text-amber-500" : "text-slate-300 hover:text-amber-500"}`}
                >
                  <Icon>
                    <path d="m12 3 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8 6.8 19l1-5.8L3.6 9.1l5.8-.8L12 3z" />
                  </Icon>
                </button>
              </div>
              <div className="mt-3 line-clamp-2 text-[13px] font-semibold text-slate-900">
                {doc.title}
              </div>
              <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-slate-500">
                {doc.description || l.noDescription}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-500">
                <span className="rounded-full bg-[#fdf1ed] px-2 py-[2px] font-semibold uppercase tracking-wide text-[#DA3D20]">
                  {documentCategoryLabel(doc.category)}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-[2px] font-semibold uppercase tracking-wide text-slate-600">
                  {formatFileType(doc.fileType)}
                </span>
                {dateValue ? (
                  <span className="rounded-full bg-slate-100 px-2 py-[2px] font-semibold text-slate-600">
                    {formatDate(dateValue)}
                  </span>
                ) : null}
              </div>
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedFavoriteId(doc.id)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:border-[#DA3D20] hover:text-[#DA3D20]"
                >
                  {l.details}
                </button>
                <a
                  href={doc.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-[#DA3D20] px-3 py-1.5 text-[11px] font-semibold text-white no-underline transition hover:bg-[#C73519]"
                >
                  {l.consult}
                </a>
              </div>
            </article>
          );
        })}
      </section>
      {selectedFavorite ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30 backdrop-blur-[2px]">
          <div className="flex h-full w-full max-w-3xl flex-col overflow-y-auto border-l border-slate-200 bg-white px-5 py-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#DA3D20]">
                  {l.inspection}
                </div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  {l.favoriteDetails}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFavoriteId(null)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
              >
                <Icon>
                  <path d="M6 6l12 12" />
                  <path d="M18 6 6 18" />
                </Icon>
              </button>
            </div>
            <div className="mt-6 grid gap-4">
              <section className="rounded-[24px] bg-slate-50 px-4 py-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#DA3D20] bg-white text-[#DA3D20] shadow-lg ring-1 ring-slate-200">
                    <Icon>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <path d="M14 2v6h6" />
                    </Icon>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-lg font-semibold text-slate-950">
                      {selectedFavorite.title}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-500">
                      <span className="rounded-full bg-white px-3 py-1 font-semibold text-[#DA3D20] ring-1 ring-[#f1d2c7]">
                        {documentCategoryLabel(selectedFavorite.category)}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 font-semibold text-slate-600 ring-1 ring-slate-200">
                        {formatFileType(selectedFavorite.fileType)}
                      </span>
                    </div>
                    <p className="mt-3 text-[13px] leading-5 text-slate-600">
                      {selectedFavorite.description || l.noDescription}
                    </p>
                  </div>
                </div>
              </section>
              <section className="rounded-[24px] bg-slate-50 px-4 py-4">
                <div className="text-base font-semibold text-slate-950">
                  {l.generalInfo}
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <InfoRow
                    label={l.documentDate}
                    value={
                      formatDate(
                        selectedFavorite.realizedAt ||
                          selectedFavorite.createdAt,
                      ) || l.notProvided
                    }
                  />
                  <InfoRow
                    label={l.addedToFavorites}
                    value={
                      formatDate(selectedFavorite.library.addedAt) ||
                      l.notProvided
                    }
                  />
                  <InfoRow
                    label={l.category}
                    value={documentCategoryLabel(selectedFavorite.category)}
                  />
                  <InfoRow
                    label={l.fileType}
                    value={formatFileType(selectedFavorite.fileType)}
                  />
                </div>
              </section>
              <section className="rounded-[24px] bg-slate-50 px-4 py-4">
                <div className="text-base font-semibold text-slate-950">
                  {l.excerpt}
                </div>
                <p className="mt-3 whitespace-pre-wrap text-[13px] leading-6 text-slate-600">
                  {selectedFavorite.excerpt ||
                    selectedFavorite.description ||
                    l.noExcerpt}
                </p>
              </section>
              <section className="rounded-[24px] bg-slate-50 px-4 py-4">
                <div className="text-base font-semibold text-slate-950">
                  {l.personalNote}
                </div>
                <textarea
                  value={selectedFavorite.library.note}
                  onChange={(e) => onNoteChange(selectedFavorite.id, e)}
                  rows={4}
                  placeholder={l.notePlaceholder}
                  className="mt-3 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-700 outline-none transition focus:border-[#DA3D20]"
                />
                <div className="mt-2 text-right text-[11px] text-slate-400">
                  {selectedFavorite.library.note.length}/240
                </div>
              </section>
              <section className="rounded-[24px] bg-slate-50 px-4 py-4">
                <div className="text-base font-semibold text-slate-950">
                  {l.actions}
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <a
                    href={selectedFavorite.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-xl bg-[#DA3D20] px-4 py-2 text-[13px] font-semibold text-white no-underline transition hover:bg-[#C73519]"
                  >
                    {l.openDocument}
                  </a>
                  <button
                    type="button"
                    onClick={() => void onToggleFavorite(selectedFavorite)}
                    disabled={favoriteBusy[selectedFavorite.id]}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-[13px] font-semibold text-slate-700 transition hover:border-[#DA3D20] hover:text-[#DA3D20] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {l.removeFavorite}
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}





