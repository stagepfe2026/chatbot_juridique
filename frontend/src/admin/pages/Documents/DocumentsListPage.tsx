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
  INDEXED: "Indexé",
  FAILED: "Échoué",
};

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });
}

function getFilename(filePath: string): string {
  const parts = filePath.split(/[\\/]/g);
  return parts[parts.length - 1] || filePath;
}

function badgeClasses(status: DocumentStatus): string {
  if (status === "INDEXED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "FAILED") return "border-red-200 bg-red-50 text-red-700";
  return "border-sky-200 bg-sky-50 text-sky-700";
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
  const [snack, setSnack] = useState<{ open: boolean; message: string; variant: "success" | "error" | "info" }>({ open: false, message: "", variant: "info" });

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
      showSnack("Document supprimé définitivement.", "success");
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
    <div className="grid gap-5">
      {/* Header & stats */}
      <section className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between rounded-xl border border-white/60 bg-white/85 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600 shadow-inner">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7h6l2 2h10v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Documents indexés</h1>
            <p className="mt-0.5 text-sm text-slate-500">Gérez vos documents juridiques</p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-3 mt-2 xl:mt-0">
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Total</div>
            <div className="mt-1 text-lg font-bold text-slate-900">{stats.total}</div>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">Indexés</div>
            <div className="mt-1 text-lg font-bold text-emerald-700">{stats.indexed}</div>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wide text-red-600">Échoués</div>
            <div className="mt-1 text-lg font-bold text-red-700">{stats.failed}</div>
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="grid gap-3 lg:grid-cols-3 rounded-xl border border-white/60 bg-white/85 p-4 shadow-sm">
        <input
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-red-300 focus:ring-2 focus:ring-red-100 outline-none"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un document..."
        />
        <select
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-red-300 focus:ring-2 focus:ring-red-100 outline-none"
          value={status}
          onChange={(e) => setStatus(e.target.value as DocumentStatus | "")}
        >
          <option value="">Tous les statuts</option>
          <option value="PROCESSING">En cours</option>
          <option value="INDEXED">Indexé</option>
          <option value="FAILED">Échoué</option>
        </select>
        <select
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-red-300 focus:ring-2 focus:ring-red-100 outline-none"
          value={category}
          onChange={(e) => setCategory(e.target.value as DocumentCategory | "")}
        >
          <option value="">Toutes les catégories</option>
          {Object.entries(categoryLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </section>

      {/* Results count */}
      <div className="text-sm font-medium text-slate-500">{filtered.length} document(s) trouvé(s)</div>

      {/* Messages */}
      {loading && <div className="rounded-xl border border-white/80 bg-white/85 px-4 py-4 text-sm text-slate-500 shadow-sm">Chargement des documents...</div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
      {!loading && !error && filtered.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 bg-white/70 px-4 py-6 text-center text-sm font-medium text-slate-500">Aucun document à afficher pour le moment.</div>}

      {/* Documents list */}
      {!loading && !error && filtered.length > 0 && (
        <div className="grid gap-3">
          {filtered.map((doc) => (
            <article className="grid gap-3 rounded-xl border border-white/80 bg-white/85 p-4 shadow-sm lg:grid-cols-[56px_1fr_auto] lg:items-start" key={doc.id}>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-lg font-bold text-slate-900">{doc.title}</div>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badgeClasses(doc.documentStatus)}`}>{statusLabel[doc.documentStatus]}</span>
                </div>
                <div className="mt-2 inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-600">{categoryLabel[doc.category] ?? doc.category}</div>
                {doc.description?.trim() && <p className="mt-2 text-sm text-slate-600">{doc.description}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>Réalisé le {formatDate(doc.realizedAt)}</span>
                  <span>Indexé le {formatDate(doc.indexedAt)}</span>
                  <span>{getFilename(doc.filePath)}</span>
                </div>
              </div>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:opacity-60"
                onClick={() => setConfirmDoc(doc)}
                disabled={deletingId === doc.id}
                aria-label={`Supprimer ${doc.title}`}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
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
        title="Suppression définitive"
        message={confirmDoc ? `Supprimer définitivement "${confirmDoc.title}" ? Cette action supprime le document de MongoDB et de Qdrant.` : ""}
        confirmText={deletingId ? "Suppression..." : "Supprimer"}
        cancelText="Annuler"
        onCancel={() => setConfirmDoc(null)}
        onConfirm={() => void confirmDelete()}
      />
      <Snackbar open={snack.open} message={snack.message} variant={snack.variant} onClose={() => setSnack((prev) => ({ ...prev, open: false }))} />
    </div>
  );
}