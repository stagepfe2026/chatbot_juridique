import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { DocumentSearchResult } from "../../models/document.models";
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

export default function FavoriteDocumentsPage() {
  const [results, setResults] = useState<DocumentSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [favoriteBusy, setFavoriteBusy] = useState<Record<string, boolean>>({});

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

      setResults((prev) =>
        prev.filter((doc) => doc.id !== item.id || res.isFavored)
      );

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

  return (
    <div className="mx-auto max-w-7xl space-y-4">

      {/* Header */}
      <section className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2.5">

          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600">
            <Icon>
              <path d="m12 3 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8 6.8 19l1-5.8L3.6 9.1l5.8-.8L12 3z" />
            </Icon>
          </div>

          <div>
            <h1 className="text-lg font-medium text-slate-900">Mes Favoris</h1>
            <p className="text-xs text-slate-500">{countLabel}</p>
          </div>

        </div>

      </section>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {error}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && results.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-xs text-slate-500">
          Aucun document favori pour le moment.
        </div>
      )}

      {/* Documents */}
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">

        {results.map((doc) => {
          const dateValue = doc.realizedAt || doc.createdAt;

          return (
            <article
              key={doc.id}
              className="rounded-xl border border-slate-200 bg-white p-3 transition hover:border-red-200 hover:shadow-sm"
            >

              {/* Top */}
              <div className="flex items-start justify-between">

                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600">
                  <Icon>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6" />
                  </Icon>
                </div>

                {/* Favorite Button */}
                <button
                  type="button"
                  onClick={() => void onToggleFavorite(doc)}
                  disabled={favoriteBusy[doc.id]}
                  className={`p-1 rounded-md outline-none focus:outline-none focus:ring-0 transition ${
                    doc.isFavored
                      ? "text-amber-500"
                      : "text-slate-300 hover:text-amber-500"
                  }`}
                >
                  <Icon>
                    <path d="m12 3 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8 6.8 19l1-5.8L3.6 9.1l5.8-.8L12 3z" />
                  </Icon>
                </button>

              </div>

              {/* Title */}
              <div className="mt-2 text-sm font-medium text-slate-900 line-clamp-2">
                {doc.title}
              </div>

              {/* Description */}
              <div className="text-xs text-slate-500 line-clamp-2">
                {doc.description || "Sans description."}
              </div>

              {/* Meta */}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">

                <span className="rounded-full bg-red-50 px-2 py-[2px] text-[10px] font-semibold uppercase tracking-wide text-red-600">
                  {doc.category.replace(/_/g, " ")}
                </span>

                {dateValue && (
                  <span className="flex items-center gap-1">
                    <Icon>
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <path d="M16 2v4" />
                      <path d="M8 2v4" />
                      <path d="M3 10h18" />
                    </Icon>
                    {formatDate(dateValue)}
                  </span>
                )}

              </div>

              {/* Excerpt */}
              <p className="mt-2 text-xs text-slate-600 line-clamp-3">
                {doc.excerpt || doc.description || "Aucun extrait disponible."}
              </p>

              {/* Actions */}
              <div className="mt-3 flex items-center gap-2">

                <a
                  href={doc.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="no-underline rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700"
                >
                  Consulter
                </a>

                <a
                  href={doc.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
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