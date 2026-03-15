import { useMemo, useRef, useState } from "react";
import Snackbar from "../../../components/Snackbar";
import { importDocument } from "../../../services/admin.service";
import type { DocumentCategory, ImportDocumentForm } from "../../../models/document.models";
import { guessTitleFromFilename, validateFile } from "../../../utils/fileValidation";

const categoryOptions: { value: DocumentCategory; label: string }[] = [
  { value: "LOI_DES_FINANCES", label: "Loi des finances" },
  { value: "RECUEILS_DES_TEXTES_FISCAUX", label: "Recueils des textes fiscaux" },
  { value: "NOTE_COMMUNES", label: "Notes communes" },
  { value: "CONVENTIONS_DE_NON_DOUBLE_IMPOSITION", label: "Conventions de non double imposition" },
];

const initialForm: ImportDocumentForm = { file: null, title: "", category: "", realizedAt: "", description: "" };

export default function DocumentsImportPage() {
  const [form, setForm] = useState<ImportDocumentForm>(initialForm);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [snack, setSnack] = useState<{ open: boolean; message: string; variant: "success" | "error" | "info" }>({ open: false, message: "", variant: "info" });

  function showSnack(message: string, variant: "success" | "error" | "info") {
    setSnack({ open: true, message, variant });
  }

  const canSubmit = useMemo(() => !!form.file && form.title.trim().length > 0 && !!form.category && !!form.realizedAt && !fileError && !isSubmitting, [form.file, form.title, form.category, form.realizedAt, fileError, isSubmitting]);

  function onPickFile(file: File | null) {
    if (!file) {
      setForm((prev) => ({ ...prev, file: null }));
      setFileError(null);
      return;
    }
    const err = validateFile(file);
    setFileError(err);
    setForm((prev) => ({ ...prev, file, title: prev.title.trim() ? prev.title : guessTitleFromFilename(file.name) }));
  }

  async function onSubmit() {
    if (!form.file) return showSnack("Veuillez sélectionner un fichier.", "error");
    if (fileError) return showSnack(fileError, "error");
    if (!form.title.trim()) return showSnack("Le titre est obligatoire.", "error");
    if (!form.category) return showSnack("La catégorie est obligatoire.", "error");
    if (!form.realizedAt) return showSnack("La date de réalisation est obligatoire.", "error");

    try {
      setIsSubmitting(true);
      const res = await importDocument(form);
      if (res.status === "FAILED") {
        showSnack(res.error || `Échec d'indexation pour ${res.filename}.`, "error");
        return;
      }
      showSnack(`Document importé: ${res.filename} (statut: ${res.status}).`, "success");
      setForm(initialForm);
      setFileError(null);
    } catch (e: unknown) {
      const message =
        typeof e === "object" && e !== null && "message" in e
          ? String((e as { message?: unknown }).message ?? "Erreur lors de l'import.")
          : "Erreur lors de l'import.";
      showSnack(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-5">
      {/* Header */}
      <section className="flex items-center gap-3 rounded-xl border border-white/60 bg-white/85 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600 shadow-inner">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3v12" />
            <path d="M7 8l5-5 5 5" />
            <path d="M5 21h14" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Importer un document</h1>
          <p className="mt-0.5 text-sm text-slate-500">Ajoutez et indexez de nouveaux documents juridiques</p>
        </div>
      </section>

      {/* Form */}
      <section className="rounded-xl border border-white/60 bg-white/85 p-4 shadow-sm grid gap-4">
        {/* File Upload */}
        <div>
          <label className="text-sm font-semibold text-slate-700">Fichier <span className="text-red-600">*</span></label>
          <div
            className={`rounded-2xl border-2 border-dashed p-4 transition cursor-pointer ${isDragOver ? "border-red-400 bg-red-50" : "border-slate-300 bg-slate-50/70"}`}
            onDragEnter={() => setIsDragOver(true)}
            onDragLeave={() => setIsDragOver(false)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              const droppedFile = e.dataTransfer.files?.[0];
              if (droppedFile) onPickFile(droppedFile);
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => onPickFile(e.target.files?.[0] || null)} />
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-red-600 shadow-sm">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">{form.file ? form.file.name : "Cliquez pour sélectionner un fichier"}</div>
                <div className="mt-0.5 text-xs text-slate-500">PDF, DOC, DOCX - Maximum 50MB</div>
              </div>
            </div>
          </div>
          {fileError && <div className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{fileError}</div>}
        </div>

        {/* Other inputs */}
        <div className="grid gap-3 lg:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-sm font-semibold text-slate-700">Titre <span className="text-red-600">*</span></span>
            <input
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Ex: Loi de Finances 2024"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-semibold text-slate-700">Catégorie <span className="text-red-600">*</span></span>
            <select
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100"
              value={form.category}
              onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value as DocumentCategory }))}
            >
              <option value="">Sélectionner une catégorie</option>
              {categoryOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-semibold text-slate-700">Date de réalisation <span className="text-red-600">*</span></span>
            <input
              type="date"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100"
              value={form.realizedAt}
              onChange={(e) => setForm((prev) => ({ ...prev, realizedAt: e.target.value }))}
            />
          </label>
          <label className="grid gap-1 lg:col-span-2">
            <span className="text-sm font-semibold text-slate-700">Description</span>
            <textarea
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Décrivez brièvement le contenu du document..."
            />
          </label>
        </div>

        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="inline-flex items-center justify-center rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Import en cours..." : "Importer et indexer le document"}
        </button>
      </section>

      <Snackbar open={snack.open} message={snack.message} variant={snack.variant} onClose={() => setSnack((prev) => ({ ...prev, open: false }))} />
    </div>
  );
}