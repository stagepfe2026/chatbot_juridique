import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { DocumentSearchResult } from "../../models/document.models";
import { searchDocuments, setDocumentFavorite } from "../../services/userDocuments.service";

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
        typeof e === "object" && e != null && "message" in e
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
      setError("Impossible de mettre à jour les favoris.");
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

  const filterBtn = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
      active ? "border-red-600 bg-red-600 text-white shadow-[0_6px_12px_rgba(239,68,68,0.15)]" : "border-slate-200 bg-white text-slate-700 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
    }`;

  return (
    <div className="mx-auto max-w-8xl space-y-6 ">
      <section className="rounded-2xl border border-white/50 bg-white/80 p-4 shadow-sm backdrop-blur">
        <form onSubmit={onSearch} className="rounded-lg border border-slate-200 bg-slate-50/70 p-2 shadow-inner">
          <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 shadow-sm">
            <div className="text-slate-400">
              <Icon>
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-4.2-4.2" />
              </Icon>
            </div>
            <input
              className="w-full border-0 bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher des documents juridiques..."
            />
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
            <Icon>
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4" />
              <path d="M8 2v4" />
              <path d="M3 10h18" />
            </Icon>
            Date {sortField === "date" && <span className="ml-1 rounded-full bg-white/20 px-1 py-0.5 text-[10px]">{sortDir === "asc" ? "Asc" : "Desc"}</span>}
          </button>
          <button type="button" className={filterBtn(sortField === "title")} onClick={() => toggleSort("title")}>
            <Icon>
              <path d="M4 6h8" />
              <path d="M4 12h16" />
              <path d="M4 18h12" />
            </Icon>
            Titre {sortField === "title" && <span className="ml-1 rounded-full bg-white/20 px-1 py-0.5 text-[10px]">{sortDir === "asc" ? "A-Z" : "Z-A"}</span>}
          </button>
        </div>
      </section>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</div>}

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="grid gap-3">
          {loading && <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 px-4 py-6 text-center text-xs font-semibold text-slate-500">Recherche en cours...</div>}
          {!loading && sortedResults.length === 0 && query.trim() && <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 px-4 py-6 text-center text-xs font-semibold text-slate-500">Aucun document trouvé.</div>}
          {!query.trim() && !loading && <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 px-4 py-6 text-center text-xs font-semibold text-slate-500">Lancez une recherche pour afficher les documents.</div>}

          {sortedResults.map((doc) => {
            const isSelected = doc.id === selectedId;
            const dateValue = doc.realizedAt || doc.createdAt;
            return (
              <button
                key={doc.id}
                type="button"
                className={`group grid gap-3 rounded-lg border bg-white/85 p-4 text-left shadow-sm transition duration-150 ${
                  isSelected ? "border-red-300 shadow-[0_8px_16px_rgba(239,68,68,0.12)]" : "border-white/80 hover:-translate-y-0.5 hover:border-red-200 hover:shadow-[0_6px_12px_rgba(239,68,68,0.08)]"
                }`}
                onClick={() => setSelectedId(doc.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-lg font-bold tracking-tight text-slate-900">{highlightText(doc.title, terms)}</div>
                    <div className="mt-1 text-xs font-medium text-slate-500">{highlightText(doc.description || doc.excerpt, terms)}</div>
                  </div>
                  <button
                    type="button"
                    className={`shrink-0 rounded-full p-1.5 transition ${doc.isFavored ? "text-amber-500" : "text-slate-300 hover:text-amber-500"}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      void onToggleFavorite(doc);
                    }}
                    disabled={favoriteBusy[doc.id]}
                  >
                    <Icon>
                      <path d="m12 3 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8 6.8 19l1-5.8L3.6 9.1l5.8-.8L12 3z" />
                    </Icon>
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-600">{doc.category.replace(/_/g, " ")}</span>
                  {dateValue && (
                    <span className="inline-flex items-center gap-1">
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
              </button>
            );
          })}
        </div>

        <div className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm">
          {selectedDoc ? (
            <div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xl font-bold tracking-tight text-slate-900">{selectedDoc.title}</div>
                  <div className="mt-1 text-xs font-medium text-slate-500">{selectedDoc.description || ""}</div>
                </div>
                <button type="button" className={`rounded-full p-1.5 transition ${selectedDoc.isFavored ? "text-amber-500" : "text-slate-300 hover:text-amber-500"}`} onClick={() => void onToggleFavorite(selectedDoc)}>
                  <Icon>
                    <path d="m12 3 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8 6.8 19l1-5.8L3.6 9.1l5.8-.8L12 3z" />
                  </Icon>
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-600">{selectedDoc.category.replace(/_/g, " ")}</span>
                {(selectedDoc.realizedAt || selectedDoc.createdAt) && (
                  <span className="inline-flex items-center gap-1">
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

              <div className="mt-4 border-t border-slate-100 pt-4">
                <div className="text-sm font-bold text-slate-900">Contenu</div>
                <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-slate-600">{selectedDoc.excerpt || selectedDoc.description || ""}</p>
              </div>

              <a
                className="mt-4 inline-flex items-center justify-center rounded-full bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-[0_8px_16px_rgba(239,68,68,0.15)] transition hover:-translate-y-px"
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
                <div className="mt-2 text-sm font-bold text-slate-900">Sélectionnez un document</div>
                <div className="mt-1 text-xs font-medium">Cliquez sur un document pour consulter son contenu</div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}