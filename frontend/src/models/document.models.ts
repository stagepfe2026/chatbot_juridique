export type DocumentCategory =
  | "LOI_DES_FINANCES"
  | "RECUEILS_DES_TEXTES_FISCAUX"
  | "NOTE_COMMUNES"
  | "CONVENTIONS_DE_NON_DOUBLE_IMPOSITION";

export type DocumentStatus = "PROCESSING" | "INDEXED" | "FAILED";

export interface Document {
  id: string;
  title: string;
  category: DocumentCategory;
  description: string;
  documentStatus: DocumentStatus;
  realizedAt?: string | null;
  filePath: string;
  fileSize: number;
  fileType: string;
  createdAt: string;
  deletedAt?: string | null;
  indexedAt?: string | null;
  chunksCount?: number | null;
  indexError?: string | null;
  isFavored?: boolean;
}

export interface DocumentSearchResult {
  id: string;
  title: string;
  category: DocumentCategory;
  description: string;
  excerpt: string;
  isFavored: boolean;
  downloadUrl: string;
  createdAt?: string | null;
  realizedAt?: string | null;
}

export interface DocumentFavoriteResponse {
  documentId: string;
  isFavored: boolean;
}

export interface ImportDocumentForm {
  file: File | null;
  title: string;
  category: DocumentCategory | "";
  realizedAt: string;
  description: string;
}

export interface ImportDocumentResponse {
  documentId: string;
  filename: string;
  status: DocumentStatus;
  error?: string | null;
}
