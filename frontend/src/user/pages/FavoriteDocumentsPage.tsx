import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { DocumentCategory, DocumentSearchResult } from "../../models/document.models";
import { listFavoriteDocuments, setDocumentFavorite } from "../../services/userDocuments.service";

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

export default function FavoriteDocumentsPage() {
  const [results, setResults] = useState<DocumentSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [favoriteBusy, setFavoriteBusy] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | DocumentCategory>("ALL");

  async function loadFavorites() {
    try {
      setLoading(true);
      setError(null);
      const data = await listFavoriteDocuments(100);
      setResults(data);
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
    void loadFavorites();
  }, []);

  async function onToggleFavorite(item: DocumentSearchResult) {
    if (favoriteBusy[item.id]) return;
    const next = !item.isFavored;

    try {
      setFavoriteBusy((prev) => ({ ...prev, [item.id]: true }));
      const res = await setDocumentFavorite(item.id, next);

      setResults((prev) => prev.filter((doc) => doc.id !== item.id || res.isFavored));
      window.dispatchEvent(new Event("favorites-changed"));
    } catch {
      setError("Impossible de mettre a jour les favoris.");
    } finally {
      setFavoriteBusy((prev) => ({ ...prev, [item.id]: false }));
    }
  }

  const countLabel = useMemo(() => {
    const n = results.length;
    return n <= 1 ? `${n} document enregistre` : `${n} documents enregistres`;
  }, [results.length]);

  const categories = useMemo(
    () => Array.from(new Set(results.map((doc) => doc.category))),
    [results]
  );

  const filteredResults = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return results.filter((doc) => {
      const matchesCategory = categoryFilter === "ALL" || doc.category === categoryFilter;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        doc.title.toLowerCase().includes(normalizedQuery) ||
        doc.description.toLowerCase().includes(normalizedQuery) ||
        doc.excerpt.toLowerCase().includes(normalizedQuery) ||
        formatCategory(doc.category).toLowerCase().includes(normalizedQuery);

      return matchesCategory && matchesQuery;
    });
  }, [categoryFilter, query, results]);

  const recentFavorites = useMemo(
    () =>
      [...results]
        .sort((a, b) => {
          const aTime = new Date(a.createdAt ?? a.realizedAt ?? 0).getTime();
          const bTime = new Date(b.createdAt ?? b.realizedAt ?? 0).getTime();
          return bTime - aTime;
        })
        .slice(0, 3),
    [results]
  );

  const latestFavoriteDate = useMemo(() => {
    if (recentFavorites.length === 0) return "Aucune date";
    return formatDate(recentFavorites[0].createdAt || recentFavorites[0].realizedAt) || "Aucune date";
  }, [recentFavorites]);

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <section className="py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#DA3D20]">
              Bibliotheque personnelle
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              Mes Favoris
            </h1>
        
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#efe5e1] bg-white px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Total
              </div>
              <div className="mt-1 text-xl font-bold text-slate-900">{results.length}</div>
              <div className="mt-1 text-xs text-slate-500">{countLabel}</div>
            </div>

            <div className="rounded-2xl border border-[#efe5e1] bg-white px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Categories
              </div>
              <div className="mt-1 text-xl font-bold text-slate-900">{categories.length}</div>
              <div className="mt-1 text-xs text-slate-500">Types differents en favoris</div>
            </div>

            <div className="rounded-2xl border border-[#efe5e1] bg-white px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Dernier ajout
              </div>
              <div className="mt-1 text-base font-bold text-slate-900">{latestFavoriteDate}</div>
              <div className="mt-1 text-xs text-slate-500">Favori le plus recent</div>
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      <section className="py-6 bg-white rounded-xl border border-[#e7ddd9] px-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center ">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <Icon>
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-4.2-4.2" />
              </Icon>
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher par titre, categorie ou contenu..."
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
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="rounded-full bg-[#fdf1ed] px-3 py-1 font-semibold text-[#DA3D20]">
            {filteredResults.length} resultat(s)
          </span>
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
          <h2 className="mt-4 text-lg font-semibold text-slate-900">Aucun favori pour le moment</h2>
          <p className="mt-2 text-sm text-slate-500">
            Enregistrez des documents depuis la recherche pour construire votre bibliotheque personnelle.
          </p>
          <a
            href="/user/recherche"
            className="mt-5 inline-flex rounded-xl bg-[#DA3D20] px-4 py-2 text-sm font-semibold text-white no-underline transition hover:bg-[#C73519]"
          >
            Aller a la recherche
          </a>
        </div>
      ) : null}

      {!loading && !error && results.length > 0 && filteredResults.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-[#dccdc8] bg-white px-6 py-10 text-center">
          <h2 className="text-lg font-semibold text-slate-900">Aucun resultat</h2>
          <p className="mt-2 text-sm text-slate-500">
            Essayez une autre recherche ou retirez le filtre de categorie.
          </p>
        </div>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filteredResults.map((doc) => {
          const dateValue = doc.realizedAt || doc.createdAt;

          return (
            <article
              key={doc.id}
              className="rounded-2xl border border-[#e7ddd9] bg-white p-4 transition hover:border-[#d8b7af] hover:shadow-sm"
            >
              <div className="flex items-start justify-between">
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
                  className={`rounded-md p-1 transition ${
                    doc.isFavored ? "text-amber-500" : "text-slate-300 hover:text-amber-500"
                  }`}
                >
                  <Icon>
                    <path d="m12 3 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8 6.8 19l1-5.8L3.6 9.1l5.8-.8L12 3z" />
                  </Icon>
                </button>
              </div>

              <div className="mt-2 line-clamp-2 text-sm font-medium text-slate-900">
                {doc.title}
              </div>

              <div className="text-xs text-slate-500 line-clamp-2">
                {doc.description || "Sans description."}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                <span className="rounded-full bg-[#fdf1ed] px-2 py-[2px] text-[10px] font-semibold uppercase tracking-wide text-[#DA3D20]">
                  {formatCategory(doc.category)}
                </span>

                {dateValue ? (
                  <span className="flex items-center gap-1">
                    <Icon>
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <path d="M16 2v4" />
                      <path d="M8 2v4" />
                      <path d="M3 10h18" />
                    </Icon>
                    {formatDate(dateValue)}
                  </span>
                ) : null}
              </div>

              <p className="mt-2 line-clamp-3 text-xs text-slate-600">
                {doc.excerpt || doc.description || "Aucun extrait disponible."}
              </p>

              <div className="mt-3 flex items-center gap-2">
                <a
                  href={doc.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-[#DA3D20] px-3 py-1.5 text-xs font-semibold text-white no-underline transition hover:bg-[#C73519]"
                >
                  Consulter
                </a>

                <a
                  href={doc.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-[#e7c6be] hover:bg-[#fdf1ed] hover:text-[#DA3D20]"
                >
                  <Icon>
                    <path d="M12 3v12" />
                    <path d="M7 10l5 5 5-5" />
                    <path d="M5 21h14" />
                  </Icon>
                </a>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
