import { useEffect, useState } from "react";
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

export default function FavoriteDocumentsPage() {
  const [results, setResults] = useState<DocumentSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [favoriteBusy, setFavoriteBusy] = useState<Record<string, boolean>>({});

  async function loadFavorites() {
    try {
      setLoading(true);
      setError(null);
      const data = await listFavoriteDocuments(50);
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
    } catch {
      setError("Impossible de mettre a jour les favoris.");
    } finally {
      setFavoriteBusy((prev) => ({ ...prev, [item.id]: false }));
    }
  }

  return (
    <div className="favorites-page">
      <section className="search-hero">
        <div>
          <h1>Mes favoris</h1>
          <p>Retrouvez rapidement vos documents favoris.</p>
        </div>
        <button className="btn btn-ghost" type="button" onClick={() => void loadFavorites()} disabled={loading}>
          {loading ? "Actualisation..." : "Actualiser"}
        </button>
      </section>

      <section className="search-results">
        <div className="search-results-header">
          <div>
            <h2>Documents favoris</h2>
            <p>{results.length} document(s) en favoris</p>
          </div>
        </div>

        {error && <div className="message-error">{error}</div>}

        {results.length === 0 && !loading && !error && (
          <div className="empty-state">Aucun document favori pour le moment.</div>
        )}

        <div className="search-grid">
          {results.map((doc) => (
            <article key={doc.id} className="search-card">
              <a className="search-card-main" href={doc.downloadUrl} target="_blank" rel="noreferrer">
                <div className="search-card-title">{doc.title}</div>
                <div className="search-card-meta">{doc.category.replace(/_/g, " ")}</div>
                <p className="search-card-excerpt">{doc.excerpt || doc.description || "Aucun extrait disponible."}</p>
                <span className="search-card-cta">Consulter le document</span>
              </a>
              <div className="search-card-actions">
                <button
                  type="button"
                  className={`favorite-btn${doc.isFavored ? " active" : ""}`}
                  onClick={() => void onToggleFavorite(doc)}
                  disabled={favoriteBusy[doc.id]}
                  aria-label={doc.isFavored ? "Retirer des favoris" : "Ajouter aux favoris"}
                >
                  <Icon>
                    <path d="m12 3 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8 6.8 19l1-5.8L3.6 9.1l5.8-.8L12 3z" />
                  </Icon>
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
