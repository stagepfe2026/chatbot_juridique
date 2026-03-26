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
  return d.toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
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
  const [snack, setSnack] = useState<{
    open: boolean;
    message: string;
    variant: "success" | "error" | "info";
  }>({
    open: false,
    message: "",
    variant: "info",
  });

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
    <div className="space-y-4">
      {/* Header */}
      <section className="flex flex-col gap-2">
        <div>
          <h1 className="text-2xl font-bold leading-tight text-[#1f1b1a]">
            Documents indexés
          </h1>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">

        {/* Total */}
        <div className="relative overflow-hidden rounded-[18px] border border-[#e8dfdc] bg-white px-4 py-1.5 shadow-sm">
          <div className="absolute left-0 top-0 h-full w-1 bg-[#ef4444]" />
          <p className="text-[12px] font-medium text-[#7a6b66]">Total documents</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[16px] font-bold text-[#140a08]">{stats.total}</span>
            <span className="rounded-full bg-green-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
              +{stats.total}
            </span>
          </div>
        </div>

        {/* Indexed */}
        <div className="relative overflow-hidden rounded-[18px] border border-[#e8dfdc] bg-white px-4 py-1.5 shadow-sm">
          <div className="absolute left-0 top-0 h-full w-1 bg-[#C40C0C]" />
          <p className="text-[12px] font-medium text-[#7a6b66]">Documents indexés</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[16px] font-bold text-[#140a08]">{stats.indexed}</span>
            <span className="rounded-full bg-green-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
              +OK
            </span>
          </div>
        </div>

        {/* Failed */}
        <div className="relative overflow-hidden rounded-[18px] border border-[#e8dfdc] bg-white px-4 py-1.5 shadow-sm">
          <div className="absolute left-0 top-0 h-full w-1 bg-[#C44A3A]" />
          <p className="text-[12px] font-medium text-[#7a6b66]">Documents échoués</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[16px] font-bold text-[#140a08]">{stats.failed}</span>
            <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
              -ERR
            </span>
          </div>
        </div>

      </section>
      {/* Filters */}
      <section className="py-3">
        

        <div className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold text-[#5f5551]">Recherche</span>
            <input
              className="h-10 rounded-xl border border-[#eadfdc] bg-white px-3 text-xs text-[#1f1b1a] outline-none transition placeholder:text-[#a89b96] focus:border-[#DA3D20] focus:ring-2 focus:ring-[#ffe6de]"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un document..."
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-semibold text-[#5f5551]">Statut</span>
            <select
              className="h-10 rounded-xl border border-[#eadfdc] bg-white px-3 text-xs text-[#1f1b1a] outline-none transition focus:border-[#DA3D20] focus:ring-2 focus:ring-[#ffe6de]"
              value={status}
              onChange={(e) => setStatus(e.target.value as DocumentStatus | "")}
            >
              <option value="">Tous les statuts</option>
              <option value="PROCESSING">En cours</option>
              <option value="INDEXED">Indexé</option>
              <option value="FAILED">Échoué</option>
            </select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-semibold text-[#5f5551]">Catégorie</span>
            <select
              className="h-10 rounded-xl border border-[#eadfdc] bg-white px-3 text-xs text-[#1f1b1a] outline-none transition focus:border-[#DA3D20] focus:ring-2 focus:ring-[#ffe6de]"
              value={category}
              onChange={(e) => setCategory(e.target.value as DocumentCategory | "")}
            >
              <option value="">Toutes les catégories</option>
              {Object.entries(categoryLabel).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {/* Results count */}
      <div className="text-xs font-medium text-[#8b7d78]">
        {filtered.length} document(s) trouvé(s)
      </div>

      {/* Messages */}
      {loading && (
        <div className="rounded-[20px] border border-[#f0e7e4] bg-white px-4 py-4 text-xs text-[#7d706b] shadow-[0_4px_18px_rgba(15,23,42,0.04)]">
          Chargement des documents...
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="rounded-[20px] border border-dashed border-[#eadfdc] bg-[#fcfaf9] px-4 py-8 text-center text-xs font-medium text-[#8b7d78]">
          Aucun document à afficher pour le moment.
        </div>
      )}

      {/* Documents list */}
      {!loading && !error && filtered.length > 0 && (
        <div className="grid gap-4">
          {filtered.map((doc) => (
            <article
              key={doc.id}
              className="grid gap-3 rounded-[22px] border border-[#f0e7e4] bg-white p-4 shadow-[0_8px_30px_rgba(15,23,42,0.04)] lg:grid-cols-[48px_1fr_auto] lg:items-start"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#fff4ef] text-[#DA3D20]">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6" />
                </svg>
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-[#1f1b1a]">{doc.title}</h3>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badgeClasses(
                      doc.documentStatus
                    )}`}
                  >
                    {statusLabel[doc.documentStatus]}
                  </span>
                </div>

                <div className="mt-2">
                  <span className="inline-flex rounded-full bg-[#fff2ed] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#DA3D20]">
                    {categoryLabel[doc.category] ?? doc.category}
                  </span>
                </div>

                {doc.description?.trim() && (
                  <p className="mt-2 text-xs leading-5 text-[#7d706b]">{doc.description}</p>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#8b7d78]">
                  <span>Réalisé le {formatDate(doc.realizedAt)}</span>
                  <span>Indexé le {formatDate(doc.indexedAt)}</span>
                  <span>{getFilename(doc.filePath)}</span>
                </div>
              </div>

              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => setConfirmDoc(doc)}
                disabled={deletingId === doc.id}
                aria-label={`Supprimer ${doc.title}`}
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
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
        title="Suppression d�finitive"
        message={
          confirmDoc
            ? `Supprimer d�finitivement "${confirmDoc.title}" ? Cette action supprime le document de MongoDB et de Qdrant.`
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


