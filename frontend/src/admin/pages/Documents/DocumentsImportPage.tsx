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

const initialForm: ImportDocumentForm = {
  file: null,
  title: "",
  category: "",
  realizedAt: "",
  description: "",
};

export default function DocumentsImportPage() {
  const [form, setForm] = useState<ImportDocumentForm>(initialForm);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

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

  const canSubmit = useMemo(() => {
    return (
      !!form.file &&
      form.title.trim().length > 0 &&
      !!form.category &&
      !!form.realizedAt &&
      !fileError &&
      !isSubmitting
    );
  }, [form.file, form.title, form.category, form.realizedAt, fileError, isSubmitting]);

  function onPickFile(file: File | null) {
    if (!file) {
      setForm((prev) => ({ ...prev, file: null }));
      setFileError(null);
      return;
    }

    const err = validateFile(file);
    setFileError(err);
    setForm((prev) => ({
      ...prev,
      file,
      title: prev.title.trim() ? prev.title : guessTitleFromFilename(file.name),
    }));
  }

  async function onSubmit() {
    if (!form.file) return showSnack("Veuillez selectionner un fichier.", "error");
    if (fileError) return showSnack(fileError, "error");
    if (!form.title.trim()) return showSnack("Le titre est obligatoire.", "error");
    if (!form.category) return showSnack("La categorie est obligatoire.", "error");
    if (!form.realizedAt) return showSnack("La date de realisation est obligatoire.", "error");

    try {
      setIsSubmitting(true);
      const res = await importDocument(form);

      if (res.status === "FAILED") {
        showSnack(res.error || `Echec d'indexation pour ${res.filename}.`, "error");
        return;
      }

      showSnack(`Document importe: ${res.filename} (statut: ${res.status}).`, "success");
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
    <div className="jb-page">

      <section className="jb-hero">
        <div className="jb-hero-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3v12" />
            <path d="M7 8l5-5 5 5" />
            <path d="M5 21h14" />
          </svg>
        </div>
        <div>
          <h1 className="jb-hero-title">Importer un document</h1>
          <p className="jb-hero-subtitle">Ajoutez et indexez de nouveaux documents juridiques</p>
        </div>
      </section>

      <section className="jb-card">
        <div className="jb-form">
          <div className="jb-field">
            <label className="jb-label">
              Fichier <span className="jb-required">*</span>
            </label>
            <div
              className={`jb-dropzone${isDragOver ? " drag" : ""}`}
              onDragEnter={() => setIsDragOver(true)}
              onDragLeave={() => setIsDragOver(false)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                const droppedFile = e.dataTransfer.files?.[0];
                if (droppedFile) onPickFile(droppedFile);
              }}
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                style={{ display: "none" }}
                onChange={(e) => onPickFile(e.target.files?.[0] || null)}
              />
              <div className="jb-dropzone-inner jb-dropzone-inner--center">
                <div className="jb-file-ico" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6" />
                  </svg>
                </div>
                <div>
                  <div className="jb-dropzone-title">
                    {form.file ? form.file.name : "Cliquez pour selectionner un fichier"}
                  </div>
                  <div className="jb-dropzone-hint">PDF, DOC, DOCX ? Maximum 50MB</div>
                </div>
              </div>
            </div>
            {fileError && <div className="jb-msg jb-msg--error">{fileError}</div>}
          </div>

          <div className="jb-grid">
            <div className="jb-field">
              <label className="jb-label">
                Titre du document <span className="jb-required">*</span>
              </label>
              <input
                className="jb-input"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Ex: Loi de Finances 2024"
              />
            </div>

            <div className="jb-field">
              <label className="jb-label">
                Categorie <span className="jb-required">*</span>
              </label>
              <select
                className="jb-select"
                value={form.category}
                onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value as DocumentCategory }))}
              >
                <option value="">Selectionner une categorie</option>
                {categoryOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="jb-field">
              <label className="jb-label">
                Date de realisation <span className="jb-required">*</span>
              </label>
              <input
                className="jb-input"
                type="date"
                value={form.realizedAt}
                onChange={(e) => setForm((prev) => ({ ...prev, realizedAt: e.target.value }))}
              />
            </div>

            <div className="jb-field jb-field--full">
              <label className="jb-label">Description</label>
              <textarea
                className="jb-textarea"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Decrivez brievement le contenu du document..."
              />
            </div>
          </div>

          <button className="jb-btn-primary" type="button" onClick={onSubmit} disabled={!canSubmit}>
            {isSubmitting ? "Import en cours..." : "Importer et Indexer le document"}
          </button>
        </div>
      </section>

      <Snackbar
        open={snack.open}
        message={snack.message}
        variant={snack.variant}
        onClose={() => setSnack((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}
