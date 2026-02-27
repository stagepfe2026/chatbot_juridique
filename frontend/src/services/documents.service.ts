import { httpClient } from "./httpClient";
import type { ImportDocumentForm, ImportDocumentResponse } from "../models/document.models";

export async function uploadDocument(form: ImportDocumentForm): Promise<ImportDocumentResponse> {
  if (!form.file) throw new Error("Aucun fichier sélectionné.");

  const data = new FormData();
  data.append("file", form.file);
  data.append("title", form.title);
  data.append("category", form.category);
  data.append("description", form.description);

  const res = await httpClient.post<ImportDocumentResponse>(
    "/admin/documents/import",
    data,
    { headers: { "Content-Type": "multipart/form-data" } }
  );

  return res.data;
}
