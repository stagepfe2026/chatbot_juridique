import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
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
  description: "",
};

export default function DocumentsImportPage() {
  const [form, setForm] = useState<ImportDocumentForm>(initialForm);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canSubmit = useMemo(() => {
    return !!form.file && form.title.trim().length > 0 && !!form.category && !fileError && !isSubmitting;
  }, [form.file, form.title, form.category, fileError, isSubmitting]);

  function onPickFile(file: File | null) {
    setSuccessMsg(null);
    setSubmitError(null);

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
    setSubmitError(null);
    setSuccessMsg(null);

    if (!form.file) return setSubmitError("Veuillez selectionner un fichier.");
    if (fileError) return setSubmitError(fileError);
    if (!form.title.trim()) return setSubmitError("Le titre est obligatoire.");
    if (!form.category) return setSubmitError("La categorie est obligatoire.");

    try {
      setIsSubmitting(true);
      const res = await importDocument(form);

      if (res.status === "FAILED") {
        setSubmitError(res.error || `Echec d'indexation pour ${res.filename}.`);
        return;
      }

      setSuccessMsg(`Document importe: ${res.filename} (statut: ${res.status}).`);
      setForm(initialForm);
      setFileError(null);
    } catch (e: unknown) {
      const message =
        typeof e === "object" && e !== null && "message" in e
          ? String((e as { message?: unknown }).message ?? "Erreur lors de l'import.")
          : "Erreur lors de l'import.";
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="page">
      <div className="page-toolbar">
        <div>
          <div className="page-subtitle">Gestion documentaire &gt; Importer un document</div>
          <h1 className="page-title">Importer un document</h1>
        </div>
        <Link to="/admin/documents" style={{ textDecoration: "none" }}>
          <button type="button" className="btn btn-ghost">
            Retour a la liste
          </button>
        </Link>
      </div>

      <section className="card">
        <h3 className="card-title">Fichier</h3>
        <div
          className="dropzone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const droppedFile = e.dataTransfer.files?.[0];
            if (droppedFile) onPickFile(droppedFile);
          }}
        >
          <div style={{ fontSize: 18, marginBottom: 10, fontWeight: 700 }}>Glissez-deposez un fichier ici</div>
          <div style={{ marginBottom: 12, opacity: 0.8 }}>ou</div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx"
            style={{ display: "none" }}
            onChange={(e) => onPickFile(e.target.files?.[0] || null)}
          />
          <button type="button" className="btn btn-primary" onClick={() => fileInputRef.current?.click()}>
            Parcourir les fichiers
          </button>
          <div style={{ marginTop: 12, fontSize: 13, opacity: 0.8 }}>Formats acceptes : PDF, DOCX</div>
          {form.file && (
            <div style={{ marginTop: 10, fontSize: 13 }}>
              <strong>Fichier :</strong> {form.file.name}
            </div>
          )}
          {fileError && <div className="message-error">{fileError}</div>}
        </div>
      </section>

      <section className="card">
        <h3 className="card-title">Metadonnees</h3>
        <div className="field-grid">
          <div>
            <label className="field-label">Titre</label>
            <input
              className="input"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Ex: Loi de finances 2026"
            />
          </div>
          <div>
            <label className="field-label">Categorie</label>
            <select
              className="select"
              value={form.category}
              onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value as DocumentCategory }))}
            >
              <option value="">Selectionner...</option>
              {categoryOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Description</label>
            <textarea
              className="textarea"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Description du document juridique..."
            />
          </div>
        </div>
      </section>

      <div className="actions">
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => {
            setForm(initialForm);
            setFileError(null);
            setSubmitError(null);
            setSuccessMsg(null);
          }}
          disabled={isSubmitting}
        >
          Annuler
        </button>
        <button className="btn btn-primary" type="button" onClick={onSubmit} disabled={!canSubmit}>
          {isSubmitting ? "Import en cours..." : "Importer"}
        </button>
      </div>

      {submitError && <div className="message-error">{submitError}</div>}
      {successMsg && <div className="message-success">{successMsg}</div>}
    </div>
  );
}
