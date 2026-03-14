import { useEffect, useMemo, useState } from "react";
import ConfirmDialog from "../../../components/ConfirmDialog";
import Snackbar from "../../../components/Snackbar";
import { deleteDocument, listDocuments } from "../../../services/admin.service";
import type { Document, DocumentCategory, DocumentStatus } from "../../../models/document.models";

const categoryLabel: Record<DocumentCategory, string> = {
  LOI_DES_FINANCES: "Loi des finances",
  RECUEILS_DES_TEXTES_FISCAUX: "Recueils des textes fiscaux",
  NOTE_COMMUNES: "Notes communes",
  CONVENTIONS_DE_NON_DOUBLE_IMPOSITION: "Conventions de non double imposition",
};

const statusLabel: Record<DocumentStatus, string> = {
  PROCESSING: "En cours",
  INDEXED: "Indexe",
  FAILED: "Echoue",
};

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });
}

function getFilename(filePath: string): string {
  const parts = filePath.split(/[/\\]/g);
  return parts[parts.length - 1] || filePath;
}

function badgeClass(status: DocumentStatus): string {
  if (status === "INDEXED") return "jb-badge jb-badge--indexed";
  if (status === "FAILED") return "jb-badge jb-badge--failed";
  return "jb-badge jb-badge--processing";
}

export default function DocumentsListPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<DocumentStatus | "">("");
  const [category, setCategory] = useState<DocumentCategory | "">("");

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDoc, setConfirmDoc] = useState<Document | null>(null);

  const [snack, setSnack] = useState<{ open: boolean; message: string; variant: "success" | "error" | "info" }>(
    {
      open: false,
      message: "",
      variant: "info",
    }
  );

  function showSnack(message: string, variant: "success" | "error" | "info") {
    setSnack({ open: true, message, variant });
  }

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await listDocuments();
        setDocuments(data);
      } catch (e: unknown) {
        const message =
          typeof e === "object" && e !== null && "message" in e
            ? String((e as { message?: unknown }).message ?? "Erreur de chargement.")
            : "Erreur de chargement.";
        setError(message);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const stats = useMemo(() => {
    const total = documents.length;
    const indexed = documents.filter((d) => d.documentStatus === "INDEXED").length;
    const failed = documents.filter((d) => d.documentStatus === "FAILED").length;
    return { total, indexed, failed };
  }, [documents]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return documents.filter((doc) => {
      if (status && doc.documentStatus !== status) return false;
      if (category && doc.category !== category) return false;
      if (!q) return true;
      const blob = `${doc.title} ${doc.description || ""}`.toLowerCase();
      return blob.includes(q);
    });
  }, [documents, query, status, category]);

  async function confirmDelete() {
    if (!confirmDoc || deletingId) return;
    const doc = confirmDoc;

    try {
      setDeletingId(doc.id);
      await deleteDocument(doc.id);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      showSnack("Document supprime definitivement.", "success");
    } catch (e: unknown) {
      const message =
        typeof e === "object" && e !== null && "message" in e
          ? String((e as { message?: unknown }).message ?? "Erreur de suppression.")
          : "Erreur de suppression.";
      showSnack(message, "error");
    } finally {
      setDeletingId(null);
      setConfirmDoc(null);
    }
  }

  return (
    <div className="jb-page">
      <section className="jb-hero jb-hero--docs">
        <div className="jb-hero-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 7h6l2 2h10v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          </svg>
        </div>
        <div className="jb-hero-main">
          <div>
            <h1 className="jb-hero-title">Documents indexes</h1>
            <p className="jb-hero-subtitle">Gerez tous vos documents juridiques</p>
          </div>
          <div className="jb-stats">
            <div className="jb-stat">
              <div className="jb-stat-label">Total</div>
              <div className="jb-stat-value">{stats.total}</div>
            </div>
            <div className="jb-stat jb-stat--ok">
              <div className="jb-stat-label">Indexes</div>
              <div className="jb-stat-value">{stats.indexed}</div>
            </div>
            <div className="jb-stat jb-stat--bad">
              <div className="jb-stat-label">Echoues</div>
              <div className="jb-stat-value">{stats.failed}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="jb-card">
        <div className="jb-card-title">
          <span className="jb-card-ico" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 10a4 4 0 1 0 0.001 0z" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
          </span>
          Filtres et recherche
        </div>

        <div className="jb-filters">
          <input
            className="jb-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un document..."
          />

          <select className="jb-select" value={status} onChange={(e) => setStatus(e.target.value as DocumentStatus | "")}>
            <option value="">Tous les status</option>
            <option value="PROCESSING">En cours</option>
            <option value="INDEXED">Indexe</option>
            <option value="FAILED">Echoue</option>
          </select>

          <select className="jb-select" value={category} onChange={(e) => setCategory(e.target.value as DocumentCategory | "")}>
            <option value="">Toutes les categories</option>
            {Object.entries(categoryLabel).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="jb-found">{filtered.length} documents trouves</div>
      </section>

      {loading && <div className="jb-card">Chargement des documents...</div>}
      {error && <div className="jb-msg jb-msg--error">{error}</div>}

      {!loading && !error && filtered.length === 0 && <div className="jb-empty">Aucun document a afficher pour le moment.</div>}

      {!loading && !error && filtered.length > 0 && (
        <div className="jb-list">
          {filtered.map((doc) => (
            <article className="jb-doc" key={doc.id}>
              <div className="jb-doc-ico" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6" />
                </svg>
              </div>

              <div className="jb-doc-main">
                <div className="jb-doc-top">
                  <div className="jb-doc-title">{doc.title}</div>
                  <span className={badgeClass(doc.documentStatus)}>{statusLabel[doc.documentStatus]}</span>
                </div>

                <div className="jb-tags">
                  <span className="jb-tag">{categoryLabel[doc.category] ?? doc.category}</span>
                </div>

                {doc.description?.trim() ? <p className="jb-doc-desc">{doc.description}</p> : null}

                <div className="jb-meta">
                  <span>Realise le {formatDate(doc.realizedAt)}</span>
                  <span className="jb-dot">-</span>
                  <span>Indexe le {formatDate(doc.indexedAt)}</span>
                  <span className="jb-dot">-</span>
                  <span>{getFilename(doc.filePath)}</span>
                </div>
              </div>

              <button
                type="button"
                className="jb-trash"
                onClick={() => setConfirmDoc(doc)}
                disabled={deletingId === doc.id}
                aria-label={`Supprimer ${doc.title}`}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18" />
                  <path d="M8 6V4h8v2" />
                  <path d="M6 6l1 16h10l1-16" />
                </svg>
              </button>
            </article>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDoc}
        title="Suppression definitive"
        message={
          confirmDoc
            ? `Supprimer definitivement "${confirmDoc.title}" ? Cette action supprime le document de MongoDB et de Qdrant.`
            : ""
        }
        confirmText={deletingId ? "Suppression..." : "Supprimer"}
        cancelText="Annuler"
        onCancel={() => setConfirmDoc(null)}
        onConfirm={() => void confirmDelete()}
      />

      <Snackbar
        open={snack.open}
        message={snack.message}
        variant={snack.variant}
        onClose={() => setSnack((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}
