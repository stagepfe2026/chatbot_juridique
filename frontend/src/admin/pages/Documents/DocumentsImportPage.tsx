import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import mammoth from "mammoth";
import Snackbar from "../../../components/Snackbar";
import { importDocument } from "../../../services/admin.service";
import type { DocumentCategory, DocumentStatus, ImportDocumentForm } from "../../../models/document.models";
import { ACCEPTED_FILE_LABEL, MAX_FILE_MB, guessTitleFromFilename, validateFile } from "../../../utils/fileValidation";

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

const TITLE_MIN_LENGTH = 5;
const TITLE_MAX_LENGTH = 150;
const DESCRIPTION_MIN_LENGTH = 15;
const DESCRIPTION_MAX_LENGTH = 1000;

type FieldName = "file" | "title" | "category" | "realizedAt" | "description";
type FieldErrors = Partial<Record<FieldName, string>>;
type TouchedFields = Partial<Record<FieldName, boolean>>;

type ImportFeedback = {
  filename: string;
  status: DocumentStatus;
  error?: string | null;
};

function formatFileType(file: File | null): string {
  if (!file) return "-";
  if (file.type === "application/pdf") return "PDF";
  if (file.type === "application/msword") return "DOC";
  if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "DOCX";
  return file.type || "Document";
}

function formatAddedAt(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function StatCard({
  title,
  value,
  hint,
  icon,
}: {
  title: string;
  value: string;
  hint: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-[20px] border border-[#f0e7e4] bg-white p-4 shadow-[0_4px_18px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-[#8b7d78]">{title}</p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight text-[#1f1b1a]">{value}</h3>
          <p className="mt-1 text-xs text-[#22c55e]">{hint}</p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff4ef] text-[#DA3D20]">
          {icon}
        </div>
      </div>
    </div>
  );
}

function formatFileSize(size: number): string {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

function formatDocumentStatus(status: DocumentStatus): string {
  switch (status) {
    case "INDEXED":
      return "Indexé";
    case "PROCESSING":
      return "Indexation en cours";
    case "FAILED":
      return "Échec";
    default:
      return status;
  }
}

function validateField(name: FieldName, form: ImportDocumentForm, fileError: string | null): string {
  const title = form.title.trim();
  const description = form.description.trim();
  const today = new Date().toISOString().slice(0, 10);

  switch (name) {
    case "file":
      if (!form.file) return "Le fichier est obligatoire.";
      return fileError ?? "";
    case "title":
      if (!title) return "Le titre est obligatoire.";
      if (title.length < TITLE_MIN_LENGTH) return `Le titre doit contenir au moins ${TITLE_MIN_LENGTH} caractères.`;
      if (title.length > TITLE_MAX_LENGTH) return `Le titre ne doit pas dépasser ${TITLE_MAX_LENGTH} caractères.`;
      return "";
    case "category":
      if (!form.category) return "La catégorie est obligatoire.";
      return "";
    case "realizedAt":
      if (!form.realizedAt) return "La date de réalisation est obligatoire.";
      if (form.realizedAt > today) return "La date de réalisation ne peut pas être dans le futur.";
      return "";
    case "description":
      if (!description) return "La description est obligatoire.";
      if (description.length < DESCRIPTION_MIN_LENGTH) return `La description doit contenir au moins ${DESCRIPTION_MIN_LENGTH} caractères.`;
      if (description.length > DESCRIPTION_MAX_LENGTH) return `La description ne doit pas dépasser ${DESCRIPTION_MAX_LENGTH} caractères.`;
      return "";
    default:
      return "";
  }
}

export default function DocumentsImportPage() {
  const [form, setForm] = useState<ImportDocumentForm>(initialForm);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touchedFields, setTouchedFields] = useState<TouchedFields>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [feedback, setFeedback] = useState<ImportFeedback | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [selectedAt, setSelectedAt] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [docxPreviewText, setDocxPreviewText] = useState<string>("");
  const [docxPreviewStatus, setDocxPreviewStatus] = useState<"idle" | "loading" | "ready" | "unavailable">("idle");
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

  function logImportIssue(scope: string, details?: unknown) {
    console.error(`[DocumentsImportPage] ${scope}`, details);
  }

  const currentErrors = useMemo(() => {
    const errors: FieldErrors = {};
    const fields: FieldName[] = ["file", "title", "category", "realizedAt", "description"];

    for (const field of fields) {
      const message = validateField(field, form, fileError);
      if (message) errors[field] = message;
    }

    return errors;
  }, [form, fileError]);

  const missingFields = useMemo(() => {
    const items: string[] = [];
    if (currentErrors.file) items.push("fichier");
    if (currentErrors.title) items.push("titre");
    if (currentErrors.category) items.push("catégorie");
    if (currentErrors.realizedAt) items.push("date de réalisation");
    if (currentErrors.description) items.push("description");
    return items;
  }, [currentErrors]);

  const canSubmit = useMemo(
    () => Object.keys(currentErrors).length === 0 && !isSubmitting,
    [currentErrors, isSubmitting]
  );

  useEffect(() => {
    let cancelled = false;

    if (!form.file) {
      setPreviewUrl(null);
      setDocxPreviewText("");
      setDocxPreviewStatus("idle");
      return;
    }

    if (form.file.type === "application/pdf") {
      const objectUrl = URL.createObjectURL(form.file);
      setPreviewUrl(objectUrl);
      setDocxPreviewText("");
      setDocxPreviewStatus("idle");

      return () => {
        URL.revokeObjectURL(objectUrl);
      };
    }

    setPreviewUrl(null);

    if (form.file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      setDocxPreviewStatus("loading");
      setDocxPreviewText("");

      form.file
        .arrayBuffer()
        .then((arrayBuffer) => mammoth.extractRawText({ arrayBuffer }))
        .then((result) => {
          if (cancelled) return;
          const normalized = result.value.replace(/\s+/g, " ").trim();
          if (!normalized) {
            setDocxPreviewStatus("unavailable");
            setDocxPreviewText("");
            return;
          }
          setDocxPreviewText(normalized.slice(0, 4000));
          setDocxPreviewStatus("ready");
        })
        .catch(() => {
          if (cancelled) return;
          setDocxPreviewStatus("unavailable");
          setDocxPreviewText("");
        });

      return () => {
        cancelled = true;
      };
    }

    setDocxPreviewText("");
    setDocxPreviewStatus("unavailable");
    return () => {
      cancelled = true;
    };
  }, [form.file]);

  function setTouched(name: FieldName) {
    setTouchedFields((prev) => ({ ...prev, [name]: true }));
    setFieldErrors((prev) => ({
      ...prev,
      [name]: validateField(name, form, fileError),
    }));
  }

  function updateForm<K extends keyof ImportDocumentForm>(key: K, value: ImportDocumentForm[K]) {
    const nextForm = { ...form, [key]: value };
    setForm(nextForm);

    if (touchedFields[key as FieldName]) {
      setFieldErrors((prev) => ({
        ...prev,
        [key]: validateField(key as FieldName, nextForm, fileError),
      }));
    }
  }

  function onPickFile(file: File | null) {
    if (!file) {
      setForm((prev) => ({ ...prev, file: null }));
      setFileError(null);
      setFeedback(null);
      setSelectedAt(null);

      if (touchedFields.file) {
        setFieldErrors((prev) => ({ ...prev, file: "Le fichier est obligatoire." }));
      }
      return;
    }

    const err = validateFile(file);
    if (err) {
      console.warn("[DocumentsImportPage] Validation fichier échouée.", { fileName: file.name, error: err });
    } else {
      console.info("[DocumentsImportPage] Fichier valide.", { fileName: file.name, size: file.size, type: file.type });
    }

    const nextForm = {
      ...form,
      file,
      title: form.title.trim() ? form.title : guessTitleFromFilename(file.name),
    };

    setFileError(err);
    setForm(nextForm);
    setFeedback(null);
    setSelectedAt(new Date().toISOString());

    if (touchedFields.file) {
      setFieldErrors((prev) => ({ ...prev, file: validateField("file", nextForm, err) }));
    }
    if (touchedFields.title) {
      setFieldErrors((prev) => ({ ...prev, title: validateField("title", nextForm, err) }));
    }
  }

  async function onSubmit() {
    setTouchedFields({
      file: true,
      title: true,
      category: true,
      realizedAt: true,
      description: true,
    });
    setFieldErrors(currentErrors);

    if (Object.keys(currentErrors).length > 0) {
      showSnack("Veuillez corriger les champs invalides.", "error");
      return;
    }

    try {
      setIsSubmitting(true);
      console.info("[DocumentsImportPage] Début import document.", {
        fileName: form.file?.name,
        category: form.category,
        realizedAt: form.realizedAt,
      });

      const res = await importDocument(form);
      setFeedback({
        filename: res.filename,
        status: res.status,
        error: res.error,
      });

      if (res.status === "FAILED") {
        showSnack(res.error || `Échec d'indexation pour ${res.filename}.`, "error");
        return;
      }

      showSnack(`Document importé: ${res.filename} (statut: ${res.status}).`, "success");
      setForm(initialForm);
      setFileError(null);
      setFieldErrors({});
      setTouchedFields({});
    } catch (e: unknown) {
      const message =
        typeof e === "object" && e !== null && "message" in e
          ? String((e as { message?: unknown }).message ?? "Erreur lors de l'import.")
          : "Erreur lors de l'import.";

      logImportIssue("Erreur API import", e);
      showSnack(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  const titleClass = `h-10 rounded-xl border bg-white px-3 text-xs text-[#1f1b1a] outline-none transition focus:border-[#DA3D20] focus:ring-2 focus:ring-[#ffe6de] ${
    fieldErrors.title && touchedFields.title ? "border-red-300" : "border-[#eadfdc]"
  }`;
  const selectClass = `h-10 rounded-xl border bg-white px-3 text-xs text-[#1f1b1a] outline-none transition focus:border-[#DA3D20] focus:ring-2 focus:ring-[#ffe6de] ${
    fieldErrors.category && touchedFields.category ? "border-red-300" : "border-[#eadfdc]"
  }`;
  const dateClass = `h-10 rounded-xl border bg-white px-3 text-xs text-[#1f1b1a] outline-none transition focus:border-[#DA3D20] focus:ring-2 focus:ring-[#ffe6de] ${
    fieldErrors.realizedAt && touchedFields.realizedAt ? "border-red-300" : "border-[#eadfdc]"
  }`;
  const textareaClass = `rounded-xl border bg-white px-3 py-2.5 text-xs text-[#1f1b1a] outline-none transition focus:border-[#DA3D20] focus:ring-2 focus:ring-[#ffe6de] ${
    fieldErrors.description && touchedFields.description ? "border-red-300" : "border-[#eadfdc]"
  }`;

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold leading-tight text-red-800">
            Import documents
          </h1>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <div className="[&>div]:p-2 [&_h3]:mt-0 [&_p]:mt-0 [&_p]:leading-tight">
          <StatCard
            title="Formats autorisés"
            value={ACCEPTED_FILE_LABEL}
            hint="Documents bureautiques pris en charge"
            icon={
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
              </svg>
            }
          />
        </div>

        <div className="[&>div]:p-2 [&_h3]:mt-0 [&_p]:mt-0 [&_p]:leading-tight">
          <StatCard
            title="Poids maximum"
            value={`${MAX_FILE_MB} MB`}
            hint="Validation automatique avant import"
            icon={
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3v12" />
                <path d="M7 8l5-5 5 5" />
                <path d="M5 21h14" />
              </svg>
            }
          />
        </div>

        <div className="[&>div]:p-2 [&_h3]:mt-0 [&_p]:mt-0 [&_p]:leading-tight">
          <StatCard
            title="Indexation"
            value={feedback ? formatDocumentStatus(feedback.status) : "Active"}
            hint="Traitement après envoi du fichier"
            icon={
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-3-6.7" />
                <path d="M21 3v6h-6" />
              </svg>
            }
          />
        </div>
      </section>

      <section className="grid gap-4">
        <div className="rounded-[22px] border border-[#f0e7e4] bg-white p-4 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-[#1f1b1a]">Nouveau document</h2>
            <p className="mt-1 text-xs text-[#7d706b]">
              Importez un fichier puis renseignez ses métadonnées avant indexation.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-xs font-semibold text-[#5f5551]">
                Fichier <span className="text-[#DA3D20]">*</span>
              </label>

              <div
                className={`cursor-pointer rounded-[20px] border-2 border-dashed p-4 transition ${
                  isDragOver
                    ? "border-[#DA3D20] bg-[#fff6f2]"
                    : "border-[#eadfdc] bg-[#fcfaf9]"
                }`}
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
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={(e) => onPickFile(e.target.files?.[0] || null)}
                  onBlur={() => setTouched("file")}
                />

                <div className="flex flex-col items-center justify-center text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-[#DA3D20] shadow-lg">
                    <svg
                      viewBox="0 0 24 24"
                      width="20"
                      height="20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <path d="M14 2v6h6" />
                    </svg>
                  </div>

                  <div className="mt-3 text-sm font-medium text-[#1f1b1a]">
                    {form.file ? form.file.name : "Cliquez ou glissez votre fichier ici"}
                  </div>

                  <div className="mt-1 text-xs text-[#8b7d78]">
                    {ACCEPTED_FILE_LABEL} - taille maximale {MAX_FILE_MB}MB
                  </div>
                </div>
              </div>

              {form.file ? (
                <div className="mt-2 rounded-xl border border-[#eadfdc] bg-[#fcfaf9] px-3 py-3 text-xs text-[#5f5551]">
                  <div className="grid gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-[#1f1b1a]">{form.file.name}</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="rounded-lg border border-[#eadfdc] bg-white px-2.5 py-1 font-medium text-[#5f5551] transition hover:border-[#d8c6c1] hover:text-[#1f1b1a]"
                          onClick={(e) => {
                            e.stopPropagation();
                            fileInputRef.current?.click();
                          }}
                        >
                          Remplacer
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-[#eadfdc] bg-white px-2.5 py-1 font-medium text-[#5f5551] transition hover:border-[#d8c6c1] hover:text-[#1f1b1a]"
                          onClick={(e) => {
                            e.stopPropagation();
                            onPickFile(null);
                          }}
                        >
                          Retirer
                        </button>
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <span className="text-[#8b7d78]">Type :</span> {formatFileType(form.file)}
                      </div>
                      <div>
                        <span className="text-[#8b7d78]">Taille :</span> {formatFileSize(form.file.size)}
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-[#8b7d78]">Date d'ajout :</span> {formatAddedAt(selectedAt)}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-2 rounded-xl border border-[#eadfdc] bg-[#fcfaf9] px-3 py-3 text-xs text-[#5f5551]">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-medium text-[#1f1b1a]">Aperçu du document</span>
                  <span className="text-[#8b7d78]">
                    {previewUrl || docxPreviewStatus === "ready" ? "Aperçu disponible" : form.file ? "Aperçu impossible" : "Aperçu disponible après sélection"}
                  </span>
                </div>

                {previewUrl ? (
                  <iframe
                    title="Aperçu PDF"
                    src={`${previewUrl}#page=1&view=FitH`}
                    className="h-[260px] w-full rounded-lg border border-[#eadfdc] bg-white"
                  />
                ) : form.file?.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ? (
                  docxPreviewStatus === "loading" ? (
                    <div className="flex h-[220px] items-center justify-center rounded-lg border border-dashed border-[#eadfdc] bg-white px-4 text-center text-[#7d706b]">
                      Chargement de l'aperçu texte du DOCX...
                    </div>
                  ) : docxPreviewStatus === "ready" ? (
                    <div className="h-[260px] overflow-y-auto rounded-lg border border-[#eadfdc] bg-white p-4 text-left text-sm leading-6 text-[#3f3a37] whitespace-pre-wrap">
                      {docxPreviewText}
                    </div>
                  ) : (
                    <div className="flex h-[220px] items-center justify-center rounded-lg border border-dashed border-[#eadfdc] bg-white px-4 text-center text-[#7d706b]">
                      Aperçu texte indisponible pour ce DOCX.
                    </div>
                  )
                ) : form.file ? (
                  <div className="flex h-[180px] items-center justify-center rounded-lg border border-dashed border-[#eadfdc] bg-white px-4 text-center text-[#7d706b]">
                    Ce format ne permet pas d'afficher un aperçu ici, mais le document peut être importé.
                  </div>
                ) : (
                  <div className="flex h-[180px] items-center justify-center rounded-lg border border-dashed border-[#eadfdc] bg-white px-4 text-center text-[#7d706b]">
                    Sélectionnez un fichier pour afficher un aperçu léger du document.
                  </div>
                )}
              </div>

              {fieldErrors.file && touchedFields.file ? (
                <div className="mt-2 text-xs font-medium text-red-700">{fieldErrors.file}</div>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-[#5f5551]">
                  Titre <span className="text-[#DA3D20]">*</span>
                </span>
                <input
                  className={titleClass}
                  value={form.title}
                  onChange={(e) => updateForm("title", e.target.value)}
                  onBlur={() => setTouched("title")}
                  placeholder="Ex: Loi de Finances 2024"
                />
                {fieldErrors.title && touchedFields.title ? (
                  <span className="text-xs font-medium text-red-700">{fieldErrors.title}</span>
                ) : null}
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-[#5f5551]">
                  Catégorie <span className="text-[#DA3D20]">*</span>
                </span>
                <select
                  className={selectClass}
                  value={form.category}
                  onChange={(e) => updateForm("category", e.target.value as DocumentCategory | "")}
                  onBlur={() => setTouched("category")}
                >
                  <option value="">Sélectionner une catégorie</option>
                  {categoryOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {fieldErrors.category && touchedFields.category ? (
                  <span className="text-xs font-medium text-red-700">{fieldErrors.category}</span>
                ) : null}
              </label>

              <label className="grid gap-1.5 md:col-span-2">
                <span className="text-xs font-semibold text-[#5f5551]">
                  Date de réalisation <span className="text-[#DA3D20]">*</span>
                </span>
                <input
                  type="date"
                  className={dateClass}
                  value={form.realizedAt}
                  onChange={(e) => updateForm("realizedAt", e.target.value)}
                  onBlur={() => setTouched("realizedAt")}
                  max={new Date().toISOString().slice(0, 10)}
                />
                {fieldErrors.realizedAt && touchedFields.realizedAt ? (
                  <span className="text-xs font-medium text-red-700">{fieldErrors.realizedAt}</span>
                ) : null}
              </label>

              <label className="grid gap-1.5 md:col-span-2">
                <span className="text-xs font-semibold text-[#5f5551]">Description <span className="text-[#DA3D20]">*</span></span>
                <textarea
                  rows={4}
                  className={textareaClass}
                  value={form.description}
                  onChange={(e) => updateForm("description", e.target.value)}
                  onBlur={() => setTouched("description")}
                  placeholder="Décrivez brièvement le contenu du document..."
                />
                {fieldErrors.description && touchedFields.description ? (
                  <span className="text-xs font-medium text-red-700">{fieldErrors.description}</span>
                ) : null}
              </label>
            </div>

            <div className="pt-1">
              <button
                type="button"
                onClick={onSubmit}
                disabled={!canSubmit}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-[#DA3D20] px-4 text-xs font-semibold text-white shadow-lg transition hover:bg-[#C73519] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Import en cours..." : "Importer et indexer le document"}
              </button>
              {!canSubmit && !isSubmitting ? (
                <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Champs à vérifier: {missingFields.join(", ")}.
                </div>
              ) : null}
            </div>
          </div>
        </div>

      </section>

      {assistantOpen ? (
        <div className="fixed inset-0 z-40 bg-[#1f1b1a]/20 backdrop-blur-[1px]" onClick={() => setAssistantOpen(false)} />
      ) : null}

      <aside
        className={`fixed bottom-20 right-5 z-50 w-[min(360px,calc(100vw-2rem))] rounded-[28px] border border-[#f0e7e4] bg-[#fffaf7] p-4 shadow-[0_22px_60px_rgba(15,23,42,0.18)] transition-all ${
          assistantOpen ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#1f1b1a]">Assistant d'import</p>
            <p className="mt-1 text-xs text-[#6c625e]">Conseils rapides pour remplir cette page.</p>
          </div>
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-full border border-[#eadfdc] bg-white text-lg text-[#5f5551]"
            onClick={() => setAssistantOpen(false)}
            aria-label="Fermer l'assistant"
          >
            x
          </button>
        </div>

        <div className="mt-4 max-h-[65vh] space-y-4 overflow-y-auto pr-1">
          <div className="rounded-[22px] border border-[#f0e7e4] bg-white p-4 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
            <h3 className="text-sm font-semibold text-[#1f1b1a]">Guide rapide</h3>
            <p className="mt-2 text-xs leading-5 text-[#7d706b]">
              Vérifiez que votre document est bien lisible, correctement nommé et classé dans la bonne catégorie afin d'améliorer la recherche et l'indexation.
            </p>
            <div className="mt-4 space-y-3">
              {[
                "Sélectionnez un fichier valide.",
                "Ajoutez un titre clair et exploitable.",
                "Choisissez la bonne catégorie documentaire.",
                "Renseignez la date de réalisation.",
                "Lancez l'importation puis l'indexation.",
              ].map((item, index) => (
                <div key={index} className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#fff2ed] text-[10px] font-bold text-[#DA3D20]">
                    {index + 1}
                  </div>
                  <p className="text-xs text-[#5f5551]">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[22px] border border-[#f0e7e4] bg-white p-4 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
            <h3 className="text-sm font-semibold text-[#1f1b1a]">Comment utiliser cette page</h3>
            <div className="mt-3 space-y-3 text-xs leading-5 text-[#5f5551]">
              <p>1. Ajoutez d'abord le fichier a importér.</p>
              <p>2. Vérifiez puis complétez le titre, la catégorie et la date.</p>
              <p>3. Renseignez une description claire pour faciliter la recherche.</p>
              <p>4. Corrigez les messages rouges affichés sous les champs si nécessaire.</p>
              <p>5. Lancez l'import puis consultez le retour d'import dans cet assistant.</p>
            </div>
          </div>

          <div className="rounded-[22px] border border-[#f0e7e4] bg-white p-4 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
            <h3 className="text-sm font-semibold text-[#1f1b1a]">Contraintes de saisie</h3>
            <div className="mt-3 space-y-2 text-xs leading-5 text-[#5f5551]">
              <p>Titre : obligatoire, entre {TITLE_MIN_LENGTH} et {TITLE_MAX_LENGTH} caractères.</p>
              <p>Catégorie : obligatoire.</p>
              <p>Date de réalisation : obligatoire, date du jour maximum.</p>
              <p>Description : obligatoire, entre {DESCRIPTION_MIN_LENGTH} et {DESCRIPTION_MAX_LENGTH} caractères.</p>
              <p>Fichier : obligatoire, formats {ACCEPTED_FILE_LABEL}, taille maximale {MAX_FILE_MB} MB.</p>
            </div>
          </div>

          {feedback ? (
            <div className="rounded-[22px] border border-[#f0e7e4] bg-white p-4 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
              <h3 className="text-sm font-semibold text-[#1f1b1a]">Retour d'import</h3>
              <div className="mt-3 space-y-2 text-xs text-[#5f5551]">
                <p><span className="font-semibold text-[#1f1b1a]">Fichier :</span> {feedback.filename}</p>
                <p><span className="font-semibold text-[#1f1b1a]">Statut :</span> {formatDocumentStatus(feedback.status)}</p>
                {feedback.error ? <p className="text-red-700">{feedback.error}</p> : null}
              </div>
            </div>
          ) : null}
        </div>
      </aside>

      <button
        type="button"
        onClick={() => setAssistantOpen((prev) => !prev)}
        className="fixed bottom-5 right-5 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-red-700 text-white shadow-[0_16px_30px_rgba(124,58,237,0.38)] transition hover:bg-[#6d28d9]"
        aria-label="Ouvrir l'assistant d'import"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.2 9a2.8 2.8 0 1 1 5.6.3c0 1.7-1.7 2.3-2.5 3.1-.5.5-.7.9-.7 1.6" />
          <circle cx="12" cy="17.4" r="1" fill="currentColor" stroke="none" />
        </svg>
      </button>

      <Snackbar
        open={snack.open}
        message={snack.message}
        variant={snack.variant}
        onClose={() => setSnack((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}


