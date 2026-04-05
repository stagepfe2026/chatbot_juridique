import { httpClient } from "./httpClient";
import type { Conversation } from "../models/conversation.models";
import type { Document, ImportDocumentForm, ImportDocumentResponse } from "../models/document.models";
import type { AuditLog } from "../admin/pages/AuditLogs/auditLogs.types";

export interface ReindexDocumentResponse {
  documentId: string;
  status: "INDEXED";
  chunksCount: number;
}

export async function importDocument(form: ImportDocumentForm): Promise<ImportDocumentResponse> {
  if (!form.file) {
    throw new Error("Fichier obligatoire.");
  }

  const data = new FormData();
  data.append("file", form.file);
  data.append("title", form.title);
  data.append("category", form.category);
  data.append("realizedAt", form.realizedAt);
  data.append("description", form.description);

  const res = await httpClient.post<ImportDocumentResponse>("/admin/documents/import", data, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return res.data;
}

export async function deleteDocument(documentId: string): Promise<void> {
  await httpClient.delete(`/admin/documents/${documentId}`);
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

export async function reindexDocument(documentId: string): Promise<ReindexDocumentResponse> {
  const res = await httpClient.post<ReindexDocumentResponse>(`/admin/documents/${documentId}/index`);
  return res.data;
}

export function getAdminDocumentDownloadUrl(documentId: string): string {
  return `/api/admin/documents/${documentId}/download`;
}

export async function listConversations(): Promise<Conversation[]> {
  const res = await httpClient.get<Conversation[]>("/admin/conversations");
  return Array.isArray(res.data) ? res.data : [];
}

export async function listAuditLogs(limit = 200): Promise<AuditLog[]> {
  const res = await httpClient.get<AuditLog[]>(`/admin/audit-logs?limit=${limit}`);
  return Array.isArray(res.data) ? res.data : [];
}
