import { httpClient } from "./httpClient";
import type { Conversation } from "../models/conversation.models";
import type { Document, ImportDocumentForm, ImportDocumentResponse } from "../models/document.models";

export async function importDocument(form: ImportDocumentForm): Promise<ImportDocumentResponse> {
  if (!form.file) {
    throw new Error("Fichier obligatoire.");
  }

  const data = new FormData();
  data.append("file", form.file);
  data.append("title", form.title);
  data.append("category", form.category);
  data.append("description", form.description);

  const res = await httpClient.post<ImportDocumentResponse>("/admin/documents/import", data, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return res.data;
}

export async function listDocuments(): Promise<Document[]> {
  const res = await httpClient.get<unknown>("/admin/documents");
  const payload = res.data as
    | Document[]
    | { documents?: Document[]; data?: Document[]; items?: Document[] }
    | null
    | undefined;

  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.documents)) return payload.documents;
  if (payload && Array.isArray(payload.data)) return payload.data;
  if (payload && Array.isArray(payload.items)) return payload.items;
  return [];
}

export async function listConversations(): Promise<Conversation[]> {
  const res = await httpClient.get<Conversation[]>("/admin/conversations");
  return Array.isArray(res.data) ? res.data : [];
}
