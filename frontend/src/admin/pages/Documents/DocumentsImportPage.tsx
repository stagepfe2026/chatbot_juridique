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

function StatCard({
  title,
  value,
  hint,
  icon,
}: {
  title: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
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

export default function DocumentsImportPage() {
  const [form, setForm] = useState<ImportDocumentForm>(initialForm);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
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

  const missingFields = useMemo(() => {
    const items: string[] = [];
    if (!form.file) items.push("fichier");
    if (!form.title.trim()) items.push("titre");
    if (!form.category) items.push("categorie");
    if (!form.realizedAt) items.push("date de realisation");
    if (!form.description.trim()) items.push("description");
    if (fileError) items.push("fichier invalide");
    return items;
  }, [form.file, form.title, form.category, form.realizedAt, form.description, fileError]);

  const canSubmit = useMemo(
    () => missingFields.length === 0 && !isSubmitting,
    [missingFields, isSubmitting]
  );

  function onPickFile(file: File | null) {
    if (!file) {
      console.warn("[DocumentsImportPage] Aucun fichier selectionne.");
      setForm((prev) => ({ ...prev, file: null }));
      setFileError(null);
      return;
    }

    const err = validateFile(file);
    if (err) {
      console.warn("[DocumentsImportPage] Validation fichier echouee.", { fileName: file.name, error: err });
    } else {
      console.info("[DocumentsImportPage] Fichier valide.", { fileName: file.name, size: file.size, type: file.type });
    }
    setFileError(err);
    setForm((prev) => ({
      ...prev,
      file,
      title: prev.title.trim() ? prev.title : guessTitleFromFilename(file.name),
    }));
  }

  async function onSubmit() {
    if (!form.file) return showSnack("Veuillez sélectionner un fichier.", "error");
    if (fileError) return showSnack(fileError, "error");
    if (!form.title.trim()) return showSnack("Le titre est obligatoire.", "error");
    if (!form.category) return showSnack("La catégorie est obligatoire.", "error");
    if (!form.realizedAt) return showSnack("La date de réalisation est obligatoire.", "error");

    try {
      setIsSubmitting(true);
      console.info("[DocumentsImportPage] Debut import document.", {
        fileName: form.file.name,
        category: form.category,
        realizedAt: form.realizedAt,
      });

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

      logImportIssue("Erreur API import", e);
      showSnack(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Page heading */}
      <section className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold leading-tight text-[#1f1b1a]">
            Import documents
          </h1>
         
        </div>
     
      </section>

<section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
  <div className="[&>div]:p-2 [&_h3]:mt-0 [&_p]:mt-0 [&_p]:leading-tight">
    <StatCard
      title="Formats autorisés"
      value="PDF / DOCX"
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
      value="50 MB"
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
      value="Active"
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

      {/* Main content */}
      <section className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        {/* Left - main form */}
        <div className="rounded-[22px] border border-[#f0e7e4] bg-white p-4 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-[#1f1b1a]">Nouveau document</h2>
            <p className="mt-1 text-xs text-[#7d706b]">
              Importez un fichier puis renseignez ses métadonnées avant indexation.
            </p>
          </div>

          <div className="space-y-4">
            {/* Upload zone */}
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
                    PDF, DOC, DOCX — taille maximale 50MB
                  </div>
                </div>
              </div>

              {fileError && (
                <div className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  {fileError}
                </div>
              )}
            </div>

            {/* Inputs */}
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-[#5f5551]">
                  Titre <span className="text-[#DA3D20]">*</span>
                </span>
                <input
                  className="h-10 rounded-xl border border-[#eadfdc] bg-white px-3 text-xs text-[#1f1b1a] outline-none transition focus:border-[#DA3D20] focus:ring-2 focus:ring-[#ffe6de]"
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Ex: Loi de Finances 2024"
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-[#5f5551]">
                  Catégorie <span className="text-[#DA3D20]">*</span>
                </span>
                <select
                  className="h-10 rounded-xl border border-[#eadfdc] bg-white px-3 text-xs text-[#1f1b1a] outline-none transition focus:border-[#DA3D20] focus:ring-2 focus:ring-[#ffe6de]"
                  value={form.category}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, category: e.target.value as DocumentCategory }))
                  }
                >
                  <option value="">Sélectionner une catégorie</option>
                  {categoryOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5 md:col-span-2">
                <span className="text-xs font-semibold text-[#5f5551]">
                  Date de réalisation <span className="text-[#DA3D20]">*</span>
                </span>
                <input
                  type="date"
                  className="h-10 rounded-xl border border-[#eadfdc] bg-white px-3 text-xs text-[#1f1b1a] outline-none transition focus:border-[#DA3D20] focus:ring-2 focus:ring-[#ffe6de]"
                  value={form.realizedAt}
                  onChange={(e) => setForm((prev) => ({ ...prev, realizedAt: e.target.value }))}
                />
              </label>

              <label className="grid gap-1.5 md:col-span-2">
                <span className="text-xs font-semibold text-[#5f5551]">Description <span className="text-[#DA3D20]">*</span></span>
                <textarea
                  rows={4}
                  className="rounded-xl border border-[#eadfdc] bg-white px-3 py-2.5 text-xs text-[#1f1b1a] outline-none transition focus:border-[#DA3D20] focus:ring-2 focus:ring-[#ffe6de]"
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Décrivez brièvement le contenu du document..."
                />
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
                  Champs a verifier: {missingFields.join(", ")}. Consultez aussi la console pour plus de details.
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          <div className="rounded-[22px] border border-[#f0e7e4] bg-white p-4 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
            <h3 className="text-sm font-semibold text-[#1f1b1a]">Guide rapide</h3>
            <p className="mt-2 text-xs leading-5 text-[#7d706b]">
              Vérifiez que votre document est bien lisible, correctement nommé et classé dans la bonne
              catégorie afin d’améliorer la recherche et l’indexation.
            </p>

            <div className="mt-4 space-y-3">
              {[
                "Sélectionnez un fichier valide.",
                "Ajoutez un titre clair et exploitable.",
                "Choisissez la bonne catégorie documentaire.",
                "Renseignez la date de réalisation.",
                "Lancez l’importation puis l’indexation.",
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