import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { DocumentSearchResult } from "../../models/document.models";
import { listFavoriteDocuments, setDocumentFavorite } from "../../services/userDocuments.service";

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
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

  return (
    <div className="fav-page">
      <section className="fav-hero">
        <div className="fav-hero-icon" aria-hidden="true">
          <Icon>
            <path d="m12 3 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8 6.8 19l1-5.8L3.6 9.1l5.8-.8L12 3z" />
          </Icon>
        </div>
        <div>
          <h1 className="fav-hero-title">Mes Favoris</h1>
          <p className="fav-hero-sub">{countLabel}</p>
        </div>
        <div className="fav-hero-actions">
          <button className="fav-refresh" type="button" onClick={() => void loadFavorites()} disabled={loading}>
            {loading ? "Actualisation..." : "Actualiser"}
          </button>
        </div>
      </section>

      {error && <div className="message-error">{error}</div>}

      {!loading && !error && results.length === 0 && <div className="empty-state">Aucun document favori pour le moment.</div>}

      <section className="fav-grid">
        {results.map((doc) => {
          const dateValue = doc.realizedAt || doc.createdAt;
          return (
            <article key={doc.id} className="fav-card">
              <div className="fav-card-top">
                <div className="fav-doc-ico" aria-hidden="true">
                  <Icon>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6" />
                  </Icon>
                </div>

                <button
                  type="button"
                  className={`fav-star${doc.isFavored ? " active" : ""}`}
                  onClick={() => void onToggleFavorite(doc)}
                  disabled={favoriteBusy[doc.id]}
                  aria-label={doc.isFavored ? "Retirer des favoris" : "Ajouter aux favoris"}
                >
                  <Icon>
                    <path d="m12 3 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8 6.8 19l1-5.8L3.6 9.1l5.8-.8L12 3z" />
                  </Icon>
                </button>
              </div>

              <div className="fav-card-title">{doc.title}</div>
              <div className="fav-card-sub">{doc.description || ""}</div>

              <div className="fav-card-meta">
                <span className="fav-pill">{doc.category.replace(/_/g, " ")}</span>
                {dateValue && (
                  <span className="fav-date">
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

              <p className="fav-card-excerpt">{doc.excerpt || doc.description || "Aucun extrait disponible."}</p>

              <div className="fav-card-actions">
                <a className="fav-btn" href={doc.downloadUrl} target="_blank" rel="noreferrer">
                  Consulter
                </a>
                <a className="fav-dl" href={doc.downloadUrl} target="_blank" rel="noreferrer" aria-label="Telecharger">
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
