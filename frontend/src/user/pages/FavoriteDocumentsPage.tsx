import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import type { DocumentCategory, DocumentSearchResult } from "../../models/document.models";
import { listFavoriteDocuments, setDocumentFavorite } from "../../services/userDocuments.service";

const FAVORITE_LIBRARY_KEY = "user-favorite-library";

type FavoriteSortField = "addedAt" | "documentDate" | "title" | "category";

type FavoriteLibraryEntry = {
  note: string;
  addedAt: string;
};

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="flex-shrink-0"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("fr-FR");
}

function formatCategory(value: DocumentCategory) {
  return value.replace(/_/g, " ");
}

function formatFileType(value?: string | null) {
  if (!value) return "Fichier";
  return value
    .replace("application/", "")
    .replace("vnd.openxmlformats-officedocument.wordprocessingml.document", "DOCX")
    .replace("pdf", "PDF")
    .toUpperCase();
}

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

function buildDefaultLibraryEntry(doc: DocumentSearchResult): FavoriteLibraryEntry {
  return {
    note: "",
    addedAt: doc.createdAt || doc.realizedAt || new Date().toISOString(),
  };
}

function compareText(a: string, b: string) {
  return a.localeCompare(b, "fr", { sensitivity: "base" });
}

export default function FavoriteDocumentsPage() {
  const [results, setResults] = useState<DocumentSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [favoriteBusy, setFavoriteBusy] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | DocumentCategory>("ALL");
  const [sortField, setSortField] = useState<FavoriteSortField>("addedAt");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [favoriteLibrary, setFavoriteLibrary] = useState<Record<string, FavoriteLibraryEntry>>({});
  const [selectedFavoriteId, setSelectedFavoriteId] = useState<string | null>(null);

  async function loadFavorites() {
    try {
      setLoading(true);
      setError(null);
      const data = await listFavoriteDocuments(100);
      setResults(data);
      setFavoriteLibrary((current) => {
        const next = { ...current };
        data.forEach((doc) => {
          if (!next[doc.id]) {
            next[doc.id] = buildDefaultLibraryEntry(doc);
          }
        });
        writeFavoriteLibrary(next);
        return next;
      });
    } catch (e: unknown) {
      const message =
        typeof e === "object" && e !== null && "message" in e
          ? String((e as { message?: unknown }).message ?? "Erreur lors du chargement des favoris.")
          : "Erreur lors du chargement des favoris.";
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

      setResults((prev) => prev.filter((doc) => doc.id !== item.id || res.isFavored));
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
      setError("Impossible de mettre a jour les favoris.");
    } finally {
      setFavoriteBusy((prev) => ({ ...prev, [item.id]: false }));
    }
  }

  function updateLibraryEntry(documentId: string, updater: (entry: FavoriteLibraryEntry) => FavoriteLibraryEntry) {
    setFavoriteLibrary((current) => {
      const targetDocument = results.find((doc) => doc.id === documentId);
      const base = current[documentId] ?? (targetDocument ? buildDefaultLibraryEntry(targetDocument) : { note: "", addedAt: new Date().toISOString() });
      const next = { ...current, [documentId]: updater(base) };
      writeFavoriteLibrary(next);
      return next;
    });
  }

  function onNoteChange(documentId: string, event: ChangeEvent<HTMLTextAreaElement>) {
    updateLibraryEntry(documentId, (entry) => ({ ...entry, note: event.target.value.slice(0, 240) }));
  }

  const countLabel = useMemo(() => {
    const n = results.length;
    return n <= 1 ? `${n} document enregistre` : `${n} documents enregistres`;
  }, [results.length]);

  const categories = useMemo(() => Array.from(new Set(results.map((doc) => doc.category))), [results]);

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
      const matchesCategory = categoryFilter === "ALL" || doc.category === categoryFilter;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        doc.title.toLowerCase().includes(normalizedQuery) ||
        doc.description.toLowerCase().includes(normalizedQuery) ||
        doc.excerpt.toLowerCase().includes(normalizedQuery) ||
        formatCategory(doc.category).toLowerCase().includes(normalizedQuery) ||
        doc.library.note.toLowerCase().includes(normalizedQuery) ||
        formatFileType(doc.fileType).toLowerCase().includes(normalizedQuery);

      return matchesCategory && matchesQuery;
    });

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      if (sortField === "addedAt") {
        comparison = new Date(a.library.addedAt).getTime() - new Date(b.library.addedAt).getTime();
      } else if (sortField === "documentDate") {
        comparison = new Date(a.realizedAt || a.createdAt || 0).getTime() - new Date(b.realizedAt || b.createdAt || 0).getTime();
      } else if (sortField === "title") {
        comparison = compareText(a.title, b.title);
      } else {
        comparison = compareText(formatCategory(a.category), formatCategory(b.category));
      }

      return sortDir === "asc" ? comparison : -comparison;
    });
  }, [categoryFilter, favoriteDocuments, query, sortDir, sortField]);

  const recentFavorites = useMemo(
    () =>
      [...favoriteDocuments]
        .sort((a, b) => new Date(b.library.addedAt).getTime() - new Date(a.library.addedAt).getTime())
        .slice(0, 4),
    [favoriteDocuments],
  );

  const latestFavoriteDate = useMemo(() => {
    if (recentFavorites.length === 0) return "Aucune date";
    return formatDate(recentFavorites[0].library.addedAt) || "Aucune date";
  }, [recentFavorites]);

  const notesCount = useMemo(
    () => favoriteDocuments.filter((doc) => doc.library.note.trim().length > 0).length,
    [favoriteDocuments],
  );

  const selectedFavorite = useMemo(
    () => favoriteDocuments.find((doc) => doc.id === selectedFavoriteId) ?? null,
    [favoriteDocuments, selectedFavoriteId],
  );

  return (
    <div className="mx-auto max-w-8xl space-y-4">
      <section className="py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#DA3D20]">Bibliotheque personnelle</div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Mes Favoris</h1>
            
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-[#efe5e1] bg-white px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Total</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{results.length}</div>
              <div className="mt-1 text-xs text-slate-500">{countLabel}</div>
            </div>

            <div className="rounded-2xl border border-[#efe5e1] bg-white px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Categories</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{categories.length}</div>
              <div className="mt-1 text-xs text-slate-500">Types differents en favoris</div>
            </div>

            <div className="rounded-2xl border border-[#efe5e1] bg-white px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Notes</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{notesCount}</div>
              <div className="mt-1 text-xs text-slate-500">Documents commentes</div>
            </div>

            <div className="rounded-2xl border border-[#efe5e1] bg-white px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Dernier ajout</div>
              <div className="mt-1 text-base font-bold text-slate-900">{latestFavoriteDate}</div>
              <div className="mt-1 text-xs text-slate-500">Favori le plus recent</div>
            </div>
          </div>
        </div>
      </section>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</div> : null}

      <section className="rounded-xl border border-[#e7ddd9] bg-white px-4 py-5">
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
              placeholder="Rechercher par titre, categorie, type ou note..."
              className="h-11 w-full rounded-xl border border-[#e7ddd9] bg-white pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#DA3D20]"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as "ALL" | DocumentCategory)}
            className="h-11 rounded-xl border border-[#e7ddd9] bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-[#DA3D20]"
          >
            <option value="ALL">Toutes les categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {formatCategory(category)}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-2">
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as FavoriteSortField)}
              className="h-11 rounded-xl border border-[#e7ddd9] bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-[#DA3D20]"
            >
              <option value="addedAt">Ajout</option>
              <option value="documentDate">Date doc</option>
              <option value="title">Titre</option>
              <option value="category">Categorie</option>
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
          <span className="rounded-full bg-[#fdf1ed] px-3 py-1 font-semibold text-[#DA3D20]">{filteredResults.length} resultat(s)</span>
          {query.trim() ? <span>Recherche: "{query.trim()}"</span> : null}
          {categoryFilter !== "ALL" ? <span>Categorie: {formatCategory(categoryFilter)}</span> : null}
        </div>
      </section>

      {!loading && !error && results.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-[#dccdc8] bg-white px-6 py-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fdf1ed] text-[#DA3D20]">
            <Icon>
              <path d="m12 3 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8 6.8 19l1-5.8L3.6 9.1l5.8-.8L12 3z" />
            </Icon>
          </div>
          <h2 className="mt-4 text-base font-semibold text-slate-900">Aucun favori pour le moment</h2>
          <p className="mt-2 text-sm text-slate-500">Enregistrez des documents depuis la recherche pour construire votre bibliotheque personnelle.</p>
          <a href="/user/recherche" className="mt-5 inline-flex rounded-xl bg-[#DA3D20] px-4 py-2 text-sm font-semibold text-white no-underline transition hover:bg-[#C73519]">
            Aller a la recherche
          </a>
        </div>
      ) : null}

      {!loading && !error && results.length > 0 && filteredResults.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-[#dccdc8] bg-white px-6 py-10 text-center">
          <h2 className="text-base font-semibold text-slate-900">Aucun resultat</h2>
          <p className="mt-2 text-sm text-slate-500">Essayez une autre recherche ou retirez un filtre.</p>
        </div>
      ) : null}

      {recentFavorites.length > 0 ? (
        <section className="rounded-2xl border border-[#e7ddd9] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[13px] font-semibold text-slate-900">Documents recemment ajoutes</div>
            </div>
            <div className="text-xs font-medium text-slate-400">{recentFavorites.length} element(s)</div>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {recentFavorites.map((doc) => (
              <div key={`recent-${doc.id}`} className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                <div className="line-clamp-2 text-[13px] font-semibold text-slate-900">{doc.title}</div>
                <div className="mt-1 text-[11px] text-slate-500">Ajoute le {formatDate(doc.library.addedAt) || "-"}</div>
                <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-500">
                  <span className="rounded-full bg-white px-2 py-0.5 font-semibold text-[#DA3D20]">{formatCategory(doc.category)}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 font-semibold text-slate-600">{formatFileType(doc.fileType)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filteredResults.map((doc) => {
          const dateValue = doc.realizedAt || doc.createdAt;

          return (
            <article key={doc.id} className="rounded-2xl border border-[#e7ddd9] bg-white p-4 transition hover:border-[#d8b7af] hover:shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#fdf1ed] text-[#DA3D20]">
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

              <div className="mt-3 line-clamp-2 text-[13px] font-semibold text-slate-900">{doc.title}</div>
              <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-slate-500">{doc.description || "Sans description."}</p>

              <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-500">
                <span className="rounded-full bg-[#fdf1ed] px-2 py-[2px] font-semibold uppercase tracking-wide text-[#DA3D20]">{formatCategory(doc.category)}</span>
                <span className="rounded-full bg-slate-100 px-2 py-[2px] font-semibold uppercase tracking-wide text-slate-600">{formatFileType(doc.fileType)}</span>
                {dateValue ? <span className="rounded-full bg-slate-100 px-2 py-[2px] font-semibold text-slate-600">{formatDate(dateValue)}</span> : null}
              </div>

              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedFavoriteId(doc.id)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:border-[#DA3D20] hover:text-[#DA3D20]"
                >
                  Details
                </button>
                <a
                  href={doc.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-[#DA3D20] px-3 py-1.5 text-[11px] font-semibold text-white no-underline transition hover:bg-[#C73519]"
                >
                  Consulter
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
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#DA3D20]">Inspection</div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Details du favori</h2>
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
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-[#DA3D20] shadow-sm ring-1 ring-slate-200">
                    <Icon>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <path d="M14 2v6h6" />
                    </Icon>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-lg font-semibold text-slate-950">{selectedFavorite.title}</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-500">
                      <span className="rounded-full bg-white px-3 py-1 font-semibold text-[#DA3D20] ring-1 ring-[#f1d2c7]">{formatCategory(selectedFavorite.category)}</span>
                      <span className="rounded-full bg-white px-3 py-1 font-semibold text-slate-600 ring-1 ring-slate-200">{formatFileType(selectedFavorite.fileType)}</span>
                    </div>
                    <p className="mt-3 text-[13px] leading-5 text-slate-600">{selectedFavorite.description || "Sans description detaillee."}</p>
                  </div>
                </div>
              </section>

              <section className="rounded-[24px] bg-slate-50 px-4 py-4">
                <div className="text-base font-semibold text-slate-950">Informations generales</div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="text-[11px] text-slate-400">Date du document</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">{formatDate(selectedFavorite.realizedAt || selectedFavorite.createdAt) || "Non renseignee"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">Ajoute aux favoris</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">{formatDate(selectedFavorite.library.addedAt) || "Non renseignee"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">Categorie</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">{formatCategory(selectedFavorite.category)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">Type de fichier</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">{formatFileType(selectedFavorite.fileType)}</div>
                  </div>
                </div>
              </section>

              <section className="rounded-[24px] bg-slate-50 px-4 py-4">
                <div className="text-base font-semibold text-slate-950">Extrait</div>
                <p className="mt-3 whitespace-pre-wrap text-[13px] leading-6 text-slate-600">{selectedFavorite.excerpt || selectedFavorite.description || "Aucun extrait disponible."}</p>
              </section>

              <section className="rounded-[24px] bg-slate-50 px-4 py-4">
                <div className="text-base font-semibold text-slate-950">Note personnelle</div>
                <textarea
                  value={selectedFavorite.library.note}
                  onChange={(e) => onNoteChange(selectedFavorite.id, e)}
                  rows={4}
                  placeholder="Ajoutez ici vos remarques ou points a verifier."
                  className="mt-3 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-700 outline-none transition focus:border-[#DA3D20]"
                />
                <div className="mt-2 text-right text-[11px] text-slate-400">{selectedFavorite.library.note.length}/240</div>
              </section>

              <section className="rounded-[24px] bg-slate-50 px-4 py-4">
                <div className="text-base font-semibold text-slate-950">Actions</div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <a
                    href={selectedFavorite.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-xl bg-[#DA3D20] px-4 py-2 text-[13px] font-semibold text-white no-underline transition hover:bg-[#C73519]"
                  >
                    Consulter le document
                  </a>
                  <button
                    type="button"
                    onClick={() => void onToggleFavorite(selectedFavorite)}
                    disabled={favoriteBusy[selectedFavorite.id]}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-[13px] font-semibold text-slate-700 transition hover:border-[#DA3D20] hover:text-[#DA3D20] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Retirer des favoris
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
