const MAX_MB = 20;
const allowedMime = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export function validateFile(file: File): string | null {
  if (!allowedMime.has(file.type)) return "Format invalide. Formats acceptés : PDF, DOC, DOCX.";
  const sizeMb = file.size / (1024 * 1024);
  if (sizeMb > MAX_MB) return `Fichier trop volumineux. Taille max : ${MAX_MB} MB.`;
  return null;
}

export function guessTitleFromFilename(name: string): string {
  return name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ").trim();
}