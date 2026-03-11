import { httpClient } from "./httpClient";
import type { DocumentFavoriteResponse, DocumentSearchResult } from "../models/document.models";

export async function searchDocuments(query: string, limit = 20): Promise<DocumentSearchResult[]> {
  const res = await httpClient.get<DocumentSearchResult[]>("/user/documents/search", {
    params: { query, limit },
  });
  return Array.isArray(res.data) ? res.data : [];
}

export async function listFavoriteDocuments(limit = 50): Promise<DocumentSearchResult[]> {
  const res = await httpClient.get<DocumentSearchResult[]>("/user/documents/favorites", {
    params: { limit },
  });
  return Array.isArray(res.data) ? res.data : [];
}

export async function setDocumentFavorite(documentId: string, isFavored: boolean): Promise<DocumentFavoriteResponse> {
  const res = await httpClient.patch<DocumentFavoriteResponse>(`/user/documents/${documentId}/favorite`, {
    isFavored,
  });
  return res.data;
}
