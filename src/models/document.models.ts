export type DocumentCategory =
  | "LOI_DES_FINANCES"
  | "RECUEILS_DES_TEXTES_FISCAUX"
  | "NOTE_COMMUNES"
  | "CONVENTIONS_DE_NON_DOUBLE_IMPOSITION";

export type DocumentStatus = "INDEXED" | "FAILED";

export interface Document {
  id: number;
  title: string;
  category: DocumentCategory;
  description: string;
  documentStatus: DocumentStatus;
  filePath: string;
  fileSize: number;
  fileType: string;
  createdAt: string;
  deletedAt?: string;
}

export interface ImportDocumentForm {
  file: File | null;
  title: string;
  category: DocumentCategory | "";
  description: string;
}

export interface ImportDocumentResponse {
  documentId: number;
  filename: string;
  status: DocumentStatus;
}
