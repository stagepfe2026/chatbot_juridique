import { httpClient } from "./httpClient";
import type { DocumentCategory, DocumentFavoriteResponse, DocumentSearchResponse, DocumentSearchResult } from "../models/document.models";

export interface SearchDocumentsParams {
  query: string;
  limit?: number;
  page?: number;
  category?: DocumentCategory | "ALL";
  dateFrom?: string;
  dateTo?: string;
  sortField?: "date" | "title";
  sortDir?: "desc" | "asc";
}

export async function searchDocuments(params: SearchDocumentsParams): Promise<DocumentSearchResponse> {
  const { query, limit = 20, page = 1, category = "ALL", dateFrom, dateTo, sortField = "date", sortDir = "desc" } = params;
  const res = await httpClient.get<DocumentSearchResponse>("/user/documents/search", {
    params: {
      query,
      limit,
      page,
      category: category === "ALL" ? undefined : category,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      sortField,
      sortDir,
    },
  });

  return {
    items: Array.isArray(res.data?.items) ? res.data.items : [],
    total: typeof res.data?.total === "number" ? res.data.total : 0,
    page: typeof res.data?.page === "number" ? res.data.page : page,
    limit: typeof res.data?.limit === "number" ? res.data.limit : limit,
  };
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

export async function getFavoriteDocumentsCount(): Promise<number> {
  const res = await httpClient.get<{ count: number }>("/user/documents/favorites/count");
  return typeof res.data?.count === "number" ? res.data.count : 0;
}
