export const MAX_FILE_MB = 50;
export const ACCEPTED_FILE_LABEL = "PDF, DOC, DOCX";

const allowedMime = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export function validateFile(file: File): string | null {
  if (!allowedMime.has(file.type)) return `Format invalide. Formats acceptes : ${ACCEPTED_FILE_LABEL}.`;

  const sizeMb = file.size / (1024 * 1024);
  if (sizeMb > MAX_FILE_MB) return `Fichier trop volumineux. Taille max : ${MAX_FILE_MB} MB.`;

  return null;
}

export function guessTitleFromFilename(name: string): string {
  return name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ").trim();
}
