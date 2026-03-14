import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { DocumentSearchResult } from "../../models/document.models";
import { searchDocuments, setDocumentFavorite } from "../../services/userDocuments.service";

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
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
    const isMatch = terms.some((term) => part.toLowerCase() == term.toLowerCase());
    return isMatch ? (
      <mark key={`${part}-${index}`} className="search-highlight">
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

function sortTime(doc: DocumentSearchResult): number {
  const value = doc.realizedAt || doc.createdAt;
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export default function SearchDocumentsPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DocumentSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [favoriteBusy, setFavoriteBusy] = useState<Record<string, boolean>>({});
  const [sortField, setSortField] = useState<"date" | "title">("date");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const terms = useMemo(() => query.trim().split(/\s+/).filter(Boolean), [query]);

  async function onSearch(event?: FormEvent) {
    event?.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await searchDocuments(trimmed, 20);
      setResults(data);
    } catch (e: unknown) {
      const message =
        typeof e == "object" && e != null && "message" in e
          ? String((e as { message?: unknown }).message ?? "Erreur lors de la recherche.")
          : "Erreur lors de la recherche.";
      setError(message);
      setResults([]);
    } finally {
      setLoading(false);
    }
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

  const sortedResults = useMemo(() => {
    const items = [...results];

    if (sortField === "title") {
      items.sort((a, b) => a.title.localeCompare(b.title, "fr", { sensitivity: "base" }));
      if (sortDir === "desc") items.reverse();
      return items;
    }

    items.sort((a, b) => sortTime(a) - sortTime(b));
    if (sortDir === "desc") items.reverse();
    return items;
  }, [results, sortField, sortDir]);

  useEffect(() => {
    if (!selectedId && sortedResults.length > 0) {
      setSelectedId(sortedResults[0].id);
    }
    if (selectedId && !sortedResults.find((doc) => doc.id === selectedId)) {
      setSelectedId(sortedResults[0]?.id ?? null);
    }
  }, [sortedResults, selectedId]);

  const selectedDoc = sortedResults.find((doc) => doc.id === selectedId) ?? null;

  function toggleSort(field: "date" | "title") {
    if (sortField === field) {
      setSortDir((prev) => (prev === "desc" ? "asc" : "desc"));
      return;
    }
    setSortField(field);
    setSortDir("desc");
  }

  return (
    <div className="juris-search-page">
      <section className="juris-search-panel">
        <div className="juris-search-input">
          <Icon>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4.2-4.2" />
          </Icon>
          <form onSubmit={onSearch}>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher des documents juridiques..."
            />
          </form>
        </div>

        <div className="juris-search-filters">
          <span className="juris-filter-label">
            <Icon>
              <path d="M4 6h16" />
              <path d="M6 12h12" />
              <path d="M8 18h8" />
            </Icon>
            Trier par:
          </span>

          <button
            type="button"
            className={`juris-filter-btn${sortField === "date" ? " active" : ""}`}
            onClick={() => toggleSort("date")}
          >
            <Icon>
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4" />
              <path d="M8 2v4" />
              <path d="M3 10h18" />
            </Icon>
            Date
            {sortField === "date" && <span className="juris-sort-dir">{sortDir === "asc" ? "Asc" : "Desc"}</span>}
          </button>

          <button
            type="button"
            className={`juris-filter-btn${sortField === "title" ? " active" : ""}`}
            onClick={() => toggleSort("title")}
          >
            <Icon>
              <path d="M4 6h8" />
              <path d="M4 12h16" />
              <path d="M4 18h12" />
            </Icon>
            Titre
            {sortField === "title" && <span className="juris-sort-dir">{sortDir === "asc" ? "A-Z" : "Z-A"}</span>}
          </button>
        </div>
      </section>

      {error && <div className="message-error">{error}</div>}

      <section className="juris-search-body">
        <div className="juris-search-list">
          {loading && <div className="empty-state">Recherche en cours...</div>}
          {!loading && sortedResults.length === 0 && query.trim() && (
            <div className="empty-state">Aucun document trouve. Essayez un autre terme.</div>
          )}
          {!query.trim() && !loading && <div className="empty-state">Lancez une recherche pour afficher les documents.</div>}

          {sortedResults.map((doc) => {
            const isSelected = doc.id === selectedId;
            const dateValue = doc.realizedAt || doc.createdAt;
            return (
              <button
                key={doc.id}
                type="button"
                className={`juris-doc-card${isSelected ? " selected" : ""}`}
                onClick={() => setSelectedId(doc.id)}
              >
                <div className="juris-doc-card-main">
                  <div className="juris-doc-title">{highlightText(doc.title, terms)}</div>
                  <div className="juris-doc-subtitle">{highlightText(doc.description || doc.excerpt, terms)}</div>
                  <div className="juris-doc-meta">
                    <span className="juris-doc-tag">{doc.category.replace(/_/g, " ")}</span>
                    {dateValue && (
                      <span className="juris-doc-date">
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
                </div>

                <span
                  className={`juris-doc-star${doc.isFavored ? " active" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    void onToggleFavorite(doc);
                  }}
                >
                  <Icon>
                    <path d="m12 3 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8 6.8 19l1-5.8L3.6 9.1l5.8-.8L12 3z" />
                  </Icon>
                </span>
              </button>
            );
          })}
        </div>

        <div className="juris-search-detail">
          {selectedDoc ? (
            <div className="juris-detail-card">
              <div className="juris-detail-header">
                <div>
                  <div className="juris-detail-title">{selectedDoc.title}</div>
                  <div className="juris-detail-subtitle">{selectedDoc.description || ""}</div>
                </div>
                <button
                  type="button"
                  className={`juris-doc-star${selectedDoc.isFavored ? " active" : ""}`}
                  onClick={() => void onToggleFavorite(selectedDoc)}
                >
                  <Icon>
                    <path d="m12 3 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8 6.8 19l1-5.8L3.6 9.1l5.8-.8L12 3z" />
                  </Icon>
                </button>
              </div>

              <div className="juris-doc-meta">
                <span className="juris-doc-tag">{selectedDoc.category.replace(/_/g, " ")}</span>
                {(selectedDoc.realizedAt || selectedDoc.createdAt) && (
                  <span className="juris-doc-date">
                    <Icon>
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <path d="M16 2v4" />
                      <path d="M8 2v4" />
                      <path d="M3 10h18" />
                    </Icon>
                    {formatDate(selectedDoc.realizedAt || selectedDoc.createdAt)}
                  </span>
                )}
              </div>

              <div className="juris-detail-content">
                <div className="juris-detail-label">Contenu:</div>
                <p>{selectedDoc.excerpt || selectedDoc.description || ""}</p>
              </div>

              <a className="juris-detail-cta" href={selectedDoc.downloadUrl} target="_blank" rel="noreferrer">
                Consulter le document complet
              </a>
            </div>
          ) : (
            <div className="juris-detail-empty">
              <Icon>
                <path d="M6 3h9l5 5v13H6z" />
                <path d="M15 3v5h5" />
                <path d="M9 13h6" />
                <path d="M9 17h6" />
              </Icon>
              <div className="juris-detail-title">Selectionnez un document</div>
              <div className="juris-detail-subtitle">Cliquez sur un document pour consulter son contenu</div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
